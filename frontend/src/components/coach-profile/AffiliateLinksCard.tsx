import { useState } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { coachesAPI } from "@/api/coaches";
import type { Json } from "@/integrations/supabase/types";
import {
  MAX_AFFILIATE_LINKS,
  parseAffiliateLinks,
  toAffiliateUrl,
  type AffiliateLink,
} from "@/utils/affiliateLinks";
import { CoachProfileButton, CoachProfileCard, CoachProfileCardHeader } from "./CoachProfileCard";

type DraftLink = { brand: string; url: string; code: string };

const emptyDraft = (): DraftLink => ({ brand: "", url: "", code: "" });

interface AffiliateLinksCardProps {
  coachId: string;
  /** Raw coaches.affiliate_links value. */
  links: unknown;
  /** Owner view: shows the card even when empty, with an Edit button. */
  editable?: boolean;
  onSaved?: () => void;
}

export function AffiliateLinksCard({ coachId, links, editable = false, onSaved }: AffiliateLinksCardProps) {
  const { toast } = useToast();
  const saved = parseAffiliateLinks(links);
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<DraftLink[]>([]);
  const [saving, setSaving] = useState(false);

  if (!editable && saved.length === 0) return null;

  const openEditor = () => {
    setDrafts(
      saved.length > 0
        ? saved.map((link) => ({ brand: link.brand, url: link.url, code: link.code ?? "" }))
        : [emptyDraft()]
    );
    setOpen(true);
  };

  const updateDraft = (index: number, field: keyof DraftLink, value: string) =>
    setDrafts((current) => current.map((draft, i) => (i === index ? { ...draft, [field]: value } : draft)));

  const handleSave = async () => {
    const filled = drafts.filter((draft) => draft.brand.trim() || draft.url.trim() || draft.code.trim());
    const invalid = filled.find((draft) => !draft.brand.trim() || !toAffiliateUrl(draft.url));
    if (invalid) {
      toast({
        title: "Check your links",
        description: "Each link needs a brand name and a valid web address.",
        variant: "destructive",
      });
      return;
    }
    const next: AffiliateLink[] = parseAffiliateLinks(filled);

    setSaving(true);
    const response = await coachesAPI.updateCoach(coachId, { affiliate_links: next as unknown as Json });
    setSaving(false);
    if (response.error) {
      toast({ title: "Couldn't save links", description: response.error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Affiliate links saved" });
    setOpen(false);
    onSaved?.();
  };

  return (
    <CoachProfileCard>
      <CoachProfileCardHeader
        title="Shop my gear"
        actions={editable ? <CoachProfileButton onClick={openEditor}>Edit</CoachProfileButton> : undefined}
      />

      {saved.length === 0 ? (
        <p className="text-[14px] leading-[18px] tracking-[-0.42px] text-[#767980]">
          Share brands you partner with and any discount codes for your athletes.
        </p>
      ) : (
        <ul className="flex flex-col gap-[10px]">
          {saved.map((link, index) => (
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
      )}

      {editable ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[90vh] max-w-lg gap-0 overflow-hidden p-0 font-sans tracking-[-0.03em] text-[#1A202C] [&>button]:right-[17px] [&>button]:top-[19px]">
            <DialogHeader className="space-y-1.5 px-[25px] py-5 pr-14 text-left">
              <DialogTitle className="text-[24px] font-semibold leading-[30px] tracking-[-0.05em] text-[#1A202C]">
                Affiliate links
              </DialogTitle>
              <DialogDescription className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
                Up to {MAX_AFFILIATE_LINKS} brands. They show on your public profile.
              </DialogDescription>
            </DialogHeader>

            <div className="h-px bg-[#EAEADF]" />

            <div className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto px-[25px] py-5">
              {drafts.map((draft, index) => (
                <fieldset key={index} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <legend className="text-[14px] font-medium text-[#1A202C]">Link {index + 1}</legend>
                    <button
                      type="button"
                      onClick={() => setDrafts((current) => current.filter((_, i) => i !== index))}
                      className="inline-flex size-7 items-center justify-center rounded-[6px] text-[#767980] hover:text-[#1A202C]"
                      aria-label={`Remove link ${index + 1}`}
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
                      Link
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
                  <Plus className="size-4" /> Add link
                </Button>
              ) : null}
            </div>

            <div className="h-px bg-[#EAEADF]" />

            <DialogFooter className="px-[25px] py-4">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save links"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </CoachProfileCard>
  );
}
