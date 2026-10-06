import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ExternalLink, Plus, Tag, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { coachesAPI } from "@/api/coaches";
import { isShopifyConfigured } from "@/api/shopify";
import { GearProductCard } from "@/components/gear/GearProductCard";
import { useGearProducts } from "@/hooks/useGear";
import type { Json } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import {
  MAX_AFFILIATE_LINKS,
  parseAffiliateLinks,
  toAffiliateUrl,
  visibleDeals,
  type AffiliateLink,
} from "@/utils/affiliateLinks";
import { pickCoachGear } from "@/utils/gear";
import { CoachProfileCard, CoachProfileCardHeader, CoachProfileChip } from "./CoachProfileCard";

type DraftLink = { brand: string; url: string; code: string };

const emptyDraft = (): DraftLink => ({ brand: "", url: "", code: "" });

const caption = "text-[12px] leading-[14px] tracking-[-0.36px] text-[#767980]";

interface GearAndDealsCardProps {
  coachId: string;
  coachName: string;
  /** Raw coaches.affiliate_links value. */
  links: unknown;
  /** coaches.deals_enabled; families see no deals when it is off. */
  dealsEnabled: boolean | null | undefined;
  brandNames: string[];
  /** The coach looking at their own profile ("I use" instead of their name). */
  isOwner?: boolean;
  /** Edit profile mode: the deals switch and editor show, and the box shows even when empty. */
  editing?: boolean;
  onDealsEnabledChange?: (enabled: boolean) => void;
  onSaved?: () => void;
  /** Family view (ATH-95): the box starts folded at the bottom of the profile. */
  folded?: boolean;
}

/**
 * Gear and deals (ATH-88): one box with the coach's brand deals on top and the gear store
 * carousel under it. Hidden from families when there is nothing to show.
 */
export function GearAndDealsCard({
  coachId,
  coachName,
  links,
  dealsEnabled,
  brandNames,
  isOwner = false,
  editing = false,
  onDealsEnabledChange,
  onSaved,
  folded = false,
}: GearAndDealsCardProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [open, setOpen] = useState(!folded);
  const { data: products = [] } = useGearProducts();
  const gear = isShopifyConfigured ? pickCoachGear(products, brandNames) : [];
  const allDeals = parseAffiliateLinks(links);
  const deals = editing ? allDeals : visibleDeals(links, dealsEnabled);
  const dealsOn = dealsEnabled !== false;

  if (!editing && deals.length === 0 && gear.length === 0) return null;

  const first = coachName.trim().split(/\s+/)[0] || "Your coach";

  if (folded && !open) {
    return (
      <CoachProfileCard className="gap-0">
        <button type="button" className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={false} onClick={() => setOpen(true)}>
          <span className="text-[20px] font-medium leading-[22px] tracking-[-1px] text-[#1A202C]">Gear {first} uses</span>
          <span className="inline-flex items-center gap-1.5 text-[12px] text-[#767980]">
            {[deals.length ? `${deals.length} ${deals.length === 1 ? "deal" : "deals"}` : "", gear.length ? `${gear.length} ${gear.length === 1 ? "product" : "products"}` : ""]
              .filter(Boolean)
              .join(" · ")}
            <ChevronDown className="size-4" strokeWidth={1.5} aria-hidden="true" />
          </span>
        </button>
      </CoachProfileCard>
    );
  }

  return (
    <CoachProfileCard className="gap-4">
      <CoachProfileCardHeader
        title="Gear and deals"
        actions={editing ? <CoachProfileChip label="Optional" /> : undefined}
      />
      <p className={cn(caption, "-mt-2")}>
        {isOwner
          ? "Gear I use with players. I may earn a commission when you buy through these links."
          : `Gear ${first} uses with players. ${first} may earn a commission when you buy through these links.`}
      </p>

      {editing ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#1A202C]">Brand deals</span>
            <span className={caption}>Affiliate links and discount codes</span>
          </div>
          <Switch
            checked={dealsOn}
            onCheckedChange={(checked) => onDealsEnabledChange?.(checked)}
            aria-label="Show brand deals"
          />
        </div>
      ) : null}

      {deals.length ? (
        <div
          className={cn(
            "flex flex-col gap-[10px] rounded-[10px] border border-[#EAEADF] bg-[#F4F4EB] p-[12px]",
            editing && !dealsOn && "opacity-50"
          )}
        >
          <p className="flex items-center gap-2 text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#1A202C]">
            <Tag className="size-4 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
            Deals from brands {isOwner ? "I use" : `${first} uses`}
          </p>
          <ul className="flex flex-col gap-[8px]">
            {deals.map((link, index) => (
              <li key={`${index}-${link.url}`}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="sponsored noopener noreferrer"
                  className="flex items-center justify-between gap-3 rounded-[8px] border border-[#EAEADF] bg-[#FCFCFA] px-[12px] py-[10px] transition-colors hover:border-[#CCDDF0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]"
                >
                  <span className="flex min-w-0 flex-col gap-[3px]">
                    <span className="truncate text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#1A202C]">
                      {link.brand}
                    </span>
                    {link.code ? (
                      <span className="w-fit rounded-[4px] border border-[#CCDDF0] bg-[#E5EDF7] px-2 py-[2px] text-[12px] font-medium leading-[13px] tracking-[-0.36px] text-[#0054B4]">
                        Code {link.code}
                      </span>
                    ) : null}
                  </span>
                  <ExternalLink className="size-4 shrink-0 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
          {editing && !dealsOn ? <p className={caption}>Hidden from families while brand deals are off.</p> : null}
        </div>
      ) : null}

      {editing ? (
        <button
          type="button"
          onClick={() => setEditorOpen(true)}
          className="inline-flex w-fit items-center gap-1 text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#0054B4] hover:underline"
        >
          <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
          {allDeals.length ? "Edit deals" : "Add a deal"}
        </button>
      ) : null}

      {gear.length ? (
        <div className="flex flex-col gap-[10px] border-t border-[#EAEADF] pt-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#1A202C]">Gear</span>
            <Link
              to={ROUTES.GEAR}
              className="text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#0054B4] hover:underline"
            >
              Shop all
            </Link>
          </div>
          <div className="-mx-1 flex snap-x snap-mandatory gap-[10px] overflow-x-auto px-1 pb-1" aria-label="Gear">
            {gear.map((product) => (
              <div key={product.id} className="w-[150px] shrink-0 snap-start">
                <GearProductCard product={product} />
              </div>
            ))}
          </div>
        </div>
      ) : editing ? (
        <p className={cn(caption, "border-t border-[#EAEADF] pt-4")}>
          Gear from the AthaNext store shows here, starting with your brands.
        </p>
      ) : null}

      {editing ? (
        <DealsEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          coachId={coachId}
          saved={allDeals}
          onSaved={onSaved}
        />
      ) : null}
    </CoachProfileCard>
  );
}

function DealsEditor({
  open,
  onOpenChange,
  coachId,
  saved,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coachId: string;
  saved: AffiliateLink[];
  onSaved?: () => void;
}) {
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<DraftLink[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDrafts(
      saved.length > 0
        ? saved.map((link) => ({ brand: link.brand, url: link.url, code: link.code ?? "" }))
        : [emptyDraft()]
    );
    // Seed once per open; later refetches of saved shouldn't wipe what the coach is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const updateDraft = (index: number, field: keyof DraftLink, value: string) =>
    setDrafts((current) => current.map((draft, i) => (i === index ? { ...draft, [field]: value } : draft)));

  const close = () => onOpenChange(false);

  const handleSave = async () => {
    const filled = drafts.filter((draft) => draft.brand.trim() || draft.url.trim() || draft.code.trim());
    const invalid = filled.find((draft) => !draft.brand.trim() || !toAffiliateUrl(draft.url));
    if (invalid) {
      toast({
        title: "Check your deals",
        description: "Each deal needs a brand name and a valid web address.",
        variant: "destructive",
      });
      return;
    }
    const next: AffiliateLink[] = parseAffiliateLinks(filled);

    setSaving(true);
    const response = await coachesAPI.updateCoach(coachId, { affiliate_links: next as unknown as Json });
    setSaving(false);
    if (response.error) {
      toast({ title: "Couldn't save deals", description: response.error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Deals saved" });
    close();
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-h-[90vh] max-w-lg gap-0 overflow-hidden p-0 font-sans tracking-[-0.03em] text-[#1A202C] [&>button]:right-[17px] [&>button]:top-[19px]">
        <DialogHeader className="space-y-1.5 px-[25px] py-5 pr-14 text-left">
          <DialogTitle className="text-[24px] font-semibold leading-[30px] tracking-[-0.05em] text-[#1A202C]">
            Brand deals
          </DialogTitle>
          <DialogDescription className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
            Up to {MAX_AFFILIATE_LINKS} deals. A disclosure line always shows with them.
          </DialogDescription>
        </DialogHeader>

        <div className="h-px bg-[#EAEADF]" />

        <div className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto px-[25px] py-5">
          {drafts.map((draft, index) => (
            <fieldset key={index} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <legend className="text-[14px] font-medium text-[#1A202C]">Deal {index + 1}</legend>
                <button
                  type="button"
                  onClick={() => setDrafts((current) => current.filter((_, i) => i !== index))}
                  className="inline-flex size-7 items-center justify-center rounded-[6px] text-[#767980] hover:text-[#1A202C]"
                  aria-label={`Remove deal ${index + 1}`}
                >
                  <Trash2 className="size-4" strokeWidth={1.5} />
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`aff-brand-${index}`} className="text-[12px] font-medium text-[#767980]">
                    Brand
                  </Label>
                  <Input
                    id={`aff-brand-${index}`}
                    value={draft.brand}
                    onChange={(e) => updateDraft(index, "brand", e.target.value)}
                    placeholder="e.g. Nike"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`aff-code-${index}`} className="text-[12px] font-medium text-[#767980]">
                    Discount code (optional)
                  </Label>
                  <Input
                    id={`aff-code-${index}`}
                    value={draft.code}
                    onChange={(e) => updateDraft(index, "code", e.target.value)}
                    placeholder="e.g. COACH15"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`aff-url-${index}`} className="text-[12px] font-medium text-[#767980]">
                  Affiliate link
                </Label>
                <Input
                  id={`aff-url-${index}`}
                  value={draft.url}
                  onChange={(e) => updateDraft(index, "url", e.target.value)}
                  placeholder="https://"
                  inputMode="url"
                />
              </div>
            </fieldset>
          ))}

          {drafts.length < MAX_AFFILIATE_LINKS ? (
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              onClick={() => setDrafts((current) => [...current, emptyDraft()])}
            >
              <Plus className="size-4" /> Add a deal
            </Button>
          ) : null}
        </div>

        <div className="h-px bg-[#EAEADF]" />

        <DialogFooter className="px-[25px] py-4">
          <Button variant="outline" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save deals"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
