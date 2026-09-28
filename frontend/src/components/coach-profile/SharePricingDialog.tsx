import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import type { CoachPackage } from "@/hooks/useCoachPackages";
import { renameCoachSlug, recordCoachShareEvent } from "@/api/coachShare";
import {
  coachPricingLinkLabel,
  coachPricingUrl,
} from "@/utils/coachSlug";
import { formatWholePrice } from "@/utils/sessionFormatting";
import { isPublicCoachRatingVisible } from "@/utils/publicRating";
import { cn } from "@/lib/utils";
import {
  PricingShareCard,
  buildPricingSharePackages,
} from "./PricingShareCard";

type ShareFormat = "post" | "story";

interface SharePricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coach: {
    id: string;
    name: string;
    slug: string;
    sport?: string | null;
    coach_position?: string | null;
    position?: string | null;
    specialties?: string[] | null;
    session_types?: string[] | null;
    hourly_rate?: number | null;
    profile_image_url?: string | null;
    image_url?: string | null;
    is_verified?: boolean | null;
  };
  packages: CoachPackage[];
  averageRating: number;
  totalReviews: number;
  canEditSlug?: boolean;
  onSlugUpdated?: (slug: string) => void;
}

export function SharePricingDialog({
  open,
  onOpenChange,
  coach,
  packages,
  averageRating,
  totalReviews,
  canEditSlug = true,
  onSlugUpdated,
}: SharePricingDialogProps) {
  const { toast } = useToast();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [format, setFormat] = useState<ShareFormat>("post");
  const [showSessions, setShowSessions] = useState(true);
  const [showPackages, setShowPackages] = useState(true);
  const [showSpecialties, setShowSpecialties] = useState(true);
  const [showRating, setShowRating] = useState(true);
  const [slugDraft, setSlugDraft] = useState(coach.slug);
  const [slug, setSlug] = useState(coach.slug);
  const [savingSlug, setSavingSlug] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const ratingAllowed = isPublicCoachRatingVisible(totalReviews, averageRating);

  useEffect(() => {
    if (!open) return;
    setSlug(coach.slug);
    setSlugDraft(coach.slug);
  }, [open, coach.slug]);

  const sessions = useMemo(() => {
    if (!coach.hourly_rate) return [];
    const types = (coach.session_types || [])
      .map((t) => t.replace(/-/g, " "))
      .map((t) => t.charAt(0).toUpperCase() + t.slice(1));
    const metaParts = ["60 min"];
    if (types.length) metaParts.push(types.join(" or "));
    const position = coach.coach_position || coach.position || "Training";
    return [
      {
        title: `1-on-1 ${position}`,
        meta: metaParts.join(" · "),
        price: formatWholePrice(coach.hourly_rate),
      },
    ];
  }, [coach]);

  const sharePackages = useMemo(
    () => buildPricingSharePackages(packages),
    [packages]
  );

  const cardCoach = {
    name: coach.name,
    sport: coach.sport || "Sports",
    position: coach.coach_position || coach.position || "Coach",
    photo: coach.profile_image_url || coach.image_url,
    rating: averageRating.toFixed(1),
    reviews: totalReviews,
    slug,
    specialties: coach.specialties || [],
    verified: Boolean(coach.is_verified),
  };

  const pricingUrl = coachPricingUrl(slug);
  const pricingLabel = coachPricingLinkLabel(slug);
  const effectiveShowRating = showRating && ratingAllowed;

  const copyPricingLink = async () => {
    await navigator.clipboard.writeText(pricingUrl);
    void recordCoachShareEvent(coach.id, "pricing_copy");
    toast({ title: "Pricing link copied" });
  };

  const handleSaveSlug = async () => {
    if (!canEditSlug || slugDraft === slug) return;
    setSavingSlug(true);
    try {
      const next = await renameCoachSlug(coach.id, slugDraft);
      setSlug(next);
      setSlugDraft(next);
      onSlugUpdated?.(next);
      toast({ title: "Share link updated" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not update that link.";
      toast({
        title: "Could not update link",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSavingSlug(false);
    }
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, {
        scale: 1,
        useCORS: true,
        backgroundColor: "#1a202c",
        width: format === "story" ? 1080 : 1080,
        height: format === "story" ? 1920 : 1350,
      });
      const link = document.createElement("a");
      link.download = `${slug}-pricing-${format}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      void recordCoachShareEvent(coach.id, "pricing_download");
      toast({ title: "PNG downloaded" });
    } catch (error) {
      console.error(error);
      toast({
        title: "Download failed",
        description: "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleInstagram = async () => {
    await copyPricingLink();
    toast({
      title: "Link ready for Instagram",
      description: "Paste it into your Instagram post or story.",
    });
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(
      `Book coaching with ${coach.name}: ${pricingUrl}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`Coaching with ${coach.name}`);
    const body = encodeURIComponent(
      `Here is my pricing and booking link:\n\n${pricingUrl}`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[920px] overflow-y-auto border-[#EAEADF] bg-[#F7F7F0] p-0 sm:rounded-[12px]">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-5 border-b border-[#EAEADF] p-6 lg:border-b-0 lg:border-r">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="text-[24px] font-semibold tracking-[-0.05em] text-[#1A202C]">
                Share pricing
              </DialogTitle>
              <DialogDescription className="text-[14px] tracking-[-0.03em] text-[#767980]">
                Pick a format, choose what to show, then download or copy your link.
              </DialogDescription>
            </DialogHeader>

            <div className="flex gap-2">
              {(
                [
                  ["post", "Post 4:5"],
                  ["story", "Story 9:16"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFormat(value)}
                  className={cn(
                    "h-9 rounded-[8px] border px-3 text-[14px] font-medium tracking-[-0.03em]",
                    format === value
                      ? "border-[#6698D2] bg-[#0054B4] text-[#F1F1E6]"
                      : "border-[#EAEADF] bg-[#F4F4EB] text-[#1A202C]"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <ToggleRow
                label="Sessions"
                checked={showSessions}
                onCheckedChange={setShowSessions}
              />
              <ToggleRow
                label="Packages"
                checked={showPackages}
                onCheckedChange={setShowPackages}
              />
              <ToggleRow
                label="Specialties"
                checked={showSpecialties}
                onCheckedChange={setShowSpecialties}
              />
              <ToggleRow
                label="Rating"
                checked={showRating}
                onCheckedChange={setShowRating}
                hint={!ratingAllowed ? "Needs 3+ athlete ratings" : undefined}
              />
            </div>

            <div className="flex justify-center overflow-hidden rounded-[10px] border border-[#EAEADF] bg-[#11151d] p-4">
              <div
                className="origin-top"
                style={{
                  transform: format === "story" ? "scale(0.22)" : "scale(0.28)",
                  height: format === "story" ? 422 : 378,
                }}
              >
                <PricingShareCard
                  coach={cardCoach}
                  sessions={sessions}
                  packages={sharePackages}
                  showSessions={showSessions}
                  showPackages={showPackages}
                  showSpecialties={showSpecialties}
                  showRating={effectiveShowRating}
                  className={format === "story" ? "h-[1920px]" : undefined}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5 p-6">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="flex h-10 items-center justify-center rounded-[8px] border border-[#6698D2] bg-[#0054B4] px-4 text-[16px] font-medium tracking-[-0.03em] text-[#F1F1E6] disabled:opacity-60"
            >
              {downloading ? "Preparing…" : "Download PNG"}
            </button>

            <div className="space-y-2">
              <Label className="text-[12px] text-[#767980]">Pricing link</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={pricingLabel}
                  className="border-[#EAEADF] bg-[#F4F4EB] text-[13px]"
                />
                <button
                  type="button"
                  onClick={copyPricingLink}
                  className="h-10 shrink-0 rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] px-3 text-[14px] font-medium"
                >
                  Copy
                </button>
              </div>
              <p className="text-[12px] leading-[16px] text-[#767980]">
                Clicks and bookings from this link show up in Analytics.
              </p>
            </div>

            {canEditSlug ? (
              <div className="space-y-2">
                <Label className="text-[12px] text-[#767980]">Profile link name</Label>
                <div className="flex gap-2">
                  <Input
                    value={slugDraft}
                    onChange={(e) =>
                      setSlugDraft(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, "-")
                          .replace(/-+/g, "-")
                      )
                    }
                    className="border-[#EAEADF] bg-[#F4F4EB] text-[13px]"
                    maxLength={60}
                  />
                  <button
                    type="button"
                    onClick={handleSaveSlug}
                    disabled={savingSlug || slugDraft === slug || slugDraft.length < 3}
                    className="h-10 shrink-0 rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] px-3 text-[14px] font-medium disabled:opacity-50"
                  >
                    {savingSlug ? "Saving…" : "Save"}
                  </button>
                </div>
                <p className="text-[12px] text-[#767980]">
                  Changing this keeps the old link redirecting here.
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-3 gap-2">
              <ShareAction label="Instagram" onClick={handleInstagram} />
              <ShareAction label="WhatsApp" onClick={handleWhatsApp} />
              <ShareAction label="Email" onClick={handleEmail} />
            </div>
          </div>
        </div>

        {/* Off-screen render target for PNG export */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed left-[-10000px] top-0"
        >
          <div ref={cardRef}>
            <PricingShareCard
              coach={cardCoach}
              sessions={sessions}
              packages={sharePackages}
              showSessions={showSessions}
              showPackages={showPackages}
              showSpecialties={showSpecialties}
              showRating={effectiveShowRating}
              className={format === "story" ? "h-[1920px]" : undefined}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({
  label,
  checked,
  onCheckedChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] px-3 py-2">
      <div>
        <div className="text-[14px] font-medium tracking-[-0.03em] text-[#1A202C]">
          {label}
        </div>
        {hint ? <div className="text-[11px] text-[#767980]">{hint}</div> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function ShareAction({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 items-center justify-center rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] text-[13px] font-medium tracking-[-0.03em] text-[#1A202C]"
    >
      {label}
    </button>
  );
}
