/**
 * My Profile for coaches (ATH-88). One Edit profile mode makes every section editable in
 * place; there are no per-section Edit buttons. Done saves the draft in one go. Packages,
 * credentials, brands and deals have their own editors, which save as soon as they close.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, ChevronDown, Eye, Pencil, Plus, Share2, SquareCheck, Trash2 } from "lucide-react";
import { formatRichTextForRender } from "@/utils/richText";
import "@/styles/richText.css";
import { fetchLocationFromZipCode, formatLocationDisplay } from "@/utils/geolocation";
import { useFAQItems } from "@/hooks/useFAQItems";
import type { CoachPackage } from "@/hooks/useCoachPackages";
import { useToast } from "@/hooks/use-toast";
import { useCoachBrands } from "@/hooks/useBrands";
import { ToastAction } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { ReviewsCard } from "@/components/reviews/ReviewsCard";
import { BrandStar } from "@/components/brand";
import { PathwayTagChips } from "@/components/common/PathwayTagChips";
import { input, primaryButton, secondaryButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { isPublicCoachRatingVisible, publicCoachRatingLabel } from "@/utils/publicRating";
import { coachProfilePath, coachProfileUrl } from "@/utils/coachSlug";
import { recordCoachShareEvent } from "@/api/coachShare";
import type { Brand } from "@/utils/brands";
import type { PathwayTag } from "@/constants/pathwayTags";
import { CoachProfileButton, CoachProfileCard, CoachProfileCardHeader, CoachProfileChip } from "./CoachProfileCard";
import { AvailabilitySummaryCard } from "./AvailabilitySummaryCard";
import { BrandLogos } from "./BrandLogos";
import { CoachBioEditor } from "./CoachBioEditor";
import { GearAndDealsCard } from "./GearAndDealsCard";
import { ManageBrandsDialog } from "./ManageBrandsDialog";
import { ProfileStrengthMeter } from "./ProfileStrengthMeter";
import { SharePricingDialog } from "./SharePricingDialog";
import type { CoachFaqItem } from "./FAQSection";
import type { CoachProfileData, ProfileReview } from "./CoachProfileView";

const NO_BRANDS: Brand[] = [];
const RESPONSE_TIMES = [1, 2, 4, 12, 24, 48];
const SESSION_TYPES = [
  ["virtual", "Virtual"],
  ["in-person", "In person"],
] as const;

const sectionTitle = "text-[20px] font-medium leading-[18px] tracking-[-1px] text-[#1A202C]";
const fieldLabel = "text-[12px] font-medium leading-[14px] tracking-[-0.36px] text-[#767980]";
const editInput = cn(input, "bg-white");

/** The coach's editable fields while Edit profile is on. */
export type CoachDraft = Partial<CoachProfileData> & {
  profile_faqs?: CoachFaqItem[] | null;
  deals_enabled?: boolean | null;
};

interface CoachOwnProfileProps {
  coach: CoachProfileData;
  packages: CoachPackage[];
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
  reviews: ProfileReview[];
  pillarOptions: { id: string; title: string }[];
  editing: boolean;
  draft: CoachDraft | null;
  saving: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onDone: () => void;
  onField: (field: string, value: unknown) => void;
  onPhotoSelect: (file: File) => void;
  onEditPackage: (pkg: CoachPackage | null) => void;
  onEditCertifications: () => void;
  onCoachUpdated: () => void;
}

export function CoachOwnProfile({
  coach,
  packages,
  averageRating,
  totalReviews,
  ratingDistribution,
  reviews,
  pillarOptions,
  editing,
  draft,
  saving,
  onStartEdit,
  onCancelEdit,
  onDone,
  onField,
  onPhotoSelect,
  onEditPackage,
  onEditCertifications,
  onCoachUpdated,
}: CoachOwnProfileProps) {
  const { toast } = useToast();
  const c: CoachProfileData & CoachDraft = editing && draft ? { ...coach, ...draft } : coach;
  const [locationLabel, setLocationLabel] = useState(coach.locations?.[0] || "Location not set");
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [sharePricingOpen, setSharePricingOpen] = useState(false);
  const [brandsOpen, setBrandsOpen] = useState(false);
  const [slug, setSlug] = useState(coach.slug || "");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [languagesDraft, setLanguagesDraft] = useState("");
  const { data: platformFaqs = [] } = useFAQItems("general");
  const { data: brands = NO_BRANDS } = useCoachBrands(coach.id);
  const showPublicRating = isPublicCoachRatingVisible(totalReviews, averageRating);

  useEffect(() => setSlug(coach.slug || ""), [coach.slug]);

  useEffect(() => {
    if (editing) setLanguagesDraft((coach.languages || []).join(", "));
    else setPhotoPreview(null);
  }, [editing, coach.languages]);

  useEffect(() => {
    let cancelled = false;
    if (!coach.zip_code) {
      setLocationLabel(coach.locations?.[0] || "Location not set");
      return;
    }
    fetchLocationFromZipCode(coach.zip_code).then((info) => {
      if (!cancelled) setLocationLabel(info ? formatLocationDisplay(info) : coach.locations?.[0] || "Location not set");
    });
    return () => {
      cancelled = true;
    };
  }, [coach.zip_code, coach.locations]);

  const rawFaqs = c.profile_faqs;
  const ownFaqs: CoachFaqItem[] = useMemo(() => (Array.isArray(rawFaqs) ? (rawFaqs as CoachFaqItem[]) : []), [rawFaqs]);
  const shownFaqs = useMemo(() => {
    const owned = ownFaqs.filter((faq) => faq.question?.trim());
    if (owned.length) return owned;
    return platformFaqs.slice(0, 5).map((faq) => ({
      id: faq.id,
      question: faq.question?.en || Object.values(faq.question || {})[0] || "Question",
      answer: faq.answer?.en || Object.values(faq.answer || {})[0] || "",
    }));
  }, [ownFaqs, platformFaqs]);

  const photoUrl = photoPreview || coach.profile_image_url || coach.image_url;
  const pillars = c.specialties || [];
  const position = c.coach_position || c.position || "Coach";
  const responseTime = c.response_time_hours ?? 24;
  const sessionTypes = c.session_types || [];
  const sessionTypesLabel = sessionTypes.length
    ? sessionTypes.map((t) => t.replace(/-/g, " ")).map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(" & ")
    : "Virtual & In-person";
  const headerRating = showPublicRating ? `${publicCoachRatingLabel(averageRating, totalReviews)} (${totalReviews})` : "No reviews yet";
  const bioHtml = formatRichTextForRender(c.bio);
  const initials = coach.name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");

  const handleShare = async () => {
    const url = slug ? coachProfileUrl(slug) : coachProfileUrl(coach.id);
    try {
      await navigator.clipboard.writeText(url);
      void recordCoachShareEvent(coach.id, "profile_share");
      toast({ title: "Profile link copied" });
    } catch {
      toast({ title: "Could not copy link", variant: "destructive" });
    }
  };

  const togglePillar = (title: string) => {
    const on = pillars.includes(title);
    if (on && pillars.length === 1) {
      toast({ title: "Keep at least one pillar" });
      return;
    }
    onField("specialties", on ? pillars.filter((p) => p !== title) : [...pillars, title]);
  };

  const toggleSessionType = (value: string) => {
    const on = sessionTypes.includes(value);
    if (on && sessionTypes.length === 1) return;
    onField("session_types", on ? sessionTypes.filter((t) => t !== value) : [...sessionTypes, value]);
  };

  const setFaqs = (next: CoachFaqItem[]) => onField("profile_faqs", next);
  const addFaq = () => {
    const id = `faq-${Date.now()}`;
    setFaqs([...ownFaqs, { id, question: "", answer: "" }]);
    setTimeout(() => document.getElementById(`faq-q-${id}`)?.focus(), 0);
  };
  const removeFaq = (index: number) => {
    const before = ownFaqs;
    setFaqs(ownFaqs.filter((_, i) => i !== index));
    toast({
      title: "Question removed",
      action: (
        <ToastAction altText="Undo remove question" onClick={() => setFaqs(before)}>
          Undo
        </ToastAction>
      ),
    });
  };
  const updateFaq = (index: number, patch: Partial<CoachFaqItem>) =>
    setFaqs(ownFaqs.map((faq, i) => (i === index ? { ...faq, ...patch } : faq)));

  return (
    <div className="overflow-x-hidden px-4 pb-16 md:px-10">
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
        {editing ? (
          <div className="sticky top-2 z-20 flex flex-wrap items-center gap-3 rounded-[10px] border border-[#CCDDF0] bg-[#E5EDF7] px-4 py-3 shadow-[0_0_15px_rgba(0,0,0,0.05)]">
            <Pencil className="size-4 text-[#0054B4]" strokeWidth={1.5} aria-hidden="true" />
            <p className="min-w-0 flex-1 text-[14px] leading-[18px] tracking-[-0.42px] text-[#1A202C]">
              <b className="font-medium">Editing your profile.</b> Done saves your changes for families to see.
            </p>
            <button type="button" className={secondaryButton} onClick={onCancelEdit} disabled={saving}>Cancel</button>
            <button type="button" className={primaryButton} onClick={onDone} disabled={saving}>{saving ? "Saving…" : "Done"}</button>
          </div>
        ) : null}

        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-[10px]">
            <h1 className="text-[32px] font-bold leading-[28px] tracking-[-1.6px] text-[#1A202C]">My Profile</h1>
            <p className="text-[16px] leading-[18px] text-[#767980]">
              {editing ? "Update anything families see. Turn off what you don't want shown." : "This is what families see when they find you."}
            </p>
          </div>
          {!editing ? (
            <div className="flex flex-wrap gap-2">
              <Link to={coachProfilePath(slug || coach.id)} className={secondaryButton}>
                <Eye strokeWidth={1.5} aria-hidden="true" />
                Preview as a family
              </Link>
              <button type="button" className={secondaryButton} onClick={handleShare}>
                <Share2 strokeWidth={1.5} aria-hidden="true" />
                Share profile
              </button>
              <button type="button" className={primaryButton} onClick={onStartEdit}>
                <Pencil strokeWidth={1.5} aria-hidden="true" />
                Edit profile
              </button>
            </div>
          ) : null}
        </header>

        {!editing ? <ProfileStrengthMeter coach={coach} onEdit={onStartEdit} variant="card" /> : null}

        <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-[147px_minmax(0,1fr)_minmax(0,1fr)_147px] lg:items-stretch">
          <div className="flex flex-col items-start gap-2">
            <div className="relative aspect-square w-[179px] overflow-hidden rounded-[10px] border border-[#EAEADF] bg-[#C1C1B8] lg:w-full">
              {photoUrl ? (
                <img src={photoUrl} alt={coach.name} className="absolute inset-0 size-full object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center text-[20px] font-medium text-[#484D56]">{initials || "C"}</span>
              )}
            </div>
            {editing ? (
              <label className="cursor-pointer text-[14px] font-medium leading-[18px] text-[#0054B4] hover:underline">
                {photoUrl ? "Change photo" : "Add photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    onPhotoSelect(file);
                    setPhotoPreview(URL.createObjectURL(file));
                  }}
                />
              </label>
            ) : null}
          </div>

          <CoachProfileCard className="justify-between gap-5">
            {editing ? (
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className={fieldLabel}>Name</span>
                  <input className={editInput} value={c.name ?? ""} onChange={(e) => onField("name", e.target.value)} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={fieldLabel}>Title</span>
                  <input
                    className={editInput}
                    placeholder="Private coach"
                    value={c.coach_position ?? ""}
                    onChange={(e) => onField("coach_position", e.target.value)}
                  />
                </label>
              </div>
            ) : (
              <div className="flex flex-col gap-[10px]">
                <div className="flex items-end gap-[2px]">
                  <h2 className="text-[32px] font-bold leading-[28px] tracking-[-1.6px] text-[#1A202C]">{coach.name}</h2>
                  {coach.is_verified ? <BadgeCheck className="size-4 shrink-0 fill-[#0054B4] text-white" aria-label="Verified" /> : null}
                </div>
                <div className="flex flex-col gap-[2px] text-[12px] tracking-[-0.36px] text-[#767980]">
                  <p className="font-normal leading-[14px]">{locationLabel}</p>
                  <p className="font-medium leading-[13px]">{position}</p>
                </div>
              </div>
            )}
            <span className="inline-flex items-center gap-[3px] text-[12px] leading-[14px] tracking-[-0.36px] text-[#767980]">
              <BrandStar size={8} />
              {headerRating}
            </span>
          </CoachProfileCard>

          <CoachProfileCard className="gap-6">
            <span className="text-[12px] leading-[14px] tracking-[-0.36px] text-[#767980]">{editing ? "Pillars you coach" : "Pillars"}</span>
            <div className="flex flex-wrap gap-[10px]">
              {editing ? (
                (pillarOptions.length ? pillarOptions.map((o) => o.title) : pillars).map((title) => {
                  const on = pillars.includes(title);
                  return (
                    <button
                      key={title}
                      type="button"
                      aria-pressed={on}
                      onClick={() => togglePillar(title)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-[12px] font-medium leading-[14px] tracking-[-0.36px] transition-colors",
                        on ? "border-[#6698D2] bg-[#E5EDF7] text-[#0054B4]" : "border-[#EAEADF] bg-[#F9F9F5] text-[#767980] hover:text-[#1A202C]"
                      )}
                    >
                      {title}
                    </button>
                  );
                })
              ) : pillars.length ? (
                pillars.slice(0, 6).map((pillar) => <CoachProfileChip key={pillar} label={pillar} />)
              ) : (
                <span className="text-[14px] text-[#A3A6AB]">No pillars set</span>
              )}
            </div>
            {editing || (c.pathway_tags || []).length ? (
              <div className="flex flex-col gap-2">
                <span className="text-[12px] leading-[14px] tracking-[-0.36px] text-[#767980]">Pathway</span>
                <PathwayTagChips
                  selected={(c.pathway_tags || []) as PathwayTag[]}
                  readOnly={!editing}
                  onChange={(tags) => onField("pathway_tags", tags)}
                />
              </div>
            ) : null}
          </CoachProfileCard>

          <CoachProfileCard className="gap-6">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[12px] leading-[14px] tracking-[-0.36px] text-[#767980]">Brands</span>
              {editing ? <CoachProfileButton onClick={() => setBrandsOpen(true)}>Manage</CoachProfileButton> : null}
            </div>
            <BrandLogos brands={brands} />
          </CoachProfileCard>
        </div>

        <AvailabilitySummaryCard coachId={coach.id} sessionTypes={c.session_types} />

        <div className="grid w-full grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_317px]">
          <div className="flex min-w-0 flex-col gap-6">
            <CoachProfileCard>
              <CoachProfileCardHeader
                title="Coaching packages"
                actions={
                  editing ? (
                    <CoachProfileButton variant="primary" onClick={() => onEditPackage(null)}>Add</CoachProfileButton>
                  ) : slug ? (
                    <CoachProfileButton onClick={() => setSharePricingOpen(true)}>Share pricing</CoachProfileButton>
                  ) : undefined
                }
              />
              {packages.length === 0 ? (
                <p className="text-[16px] leading-[18px] tracking-[-0.48px] text-[#767980]">No packages yet. Add one to get bookings.</p>
              ) : (
                <div className="flex flex-col gap-[10px]">
                  {packages.map((pkg) => {
                    const listCents = pkg.price_per_session > 0 && pkg.session_count > 0 ? pkg.price_per_session * pkg.session_count : 0;
                    const saveCents = listCents > pkg.total_price ? listCents - pkg.total_price : 0;
                    return (
                      <div
                        key={pkg.id}
                        className="flex flex-col gap-3 rounded-[10px] border border-[#EAEADF] bg-[#F1F1E6] p-5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className={cn("min-w-0", !pkg.is_active && "opacity-60")}>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[16px] leading-[18px] tracking-[-0.48px] text-[#1A202C]">{pkg.package_name}</p>
                            {!pkg.is_active ? <Badge variant="outline">Inactive</Badge> : null}
                          </div>
                          {pkg.description ? (
                            <p className="mt-[6px] text-[12px] leading-[14px] tracking-[-0.36px] text-[#A3A6AB]">{pkg.description}</p>
                          ) : null}
                        </div>
                        <div className="flex items-end gap-[10px]">
                          <p className="text-[32px] font-bold leading-[30px] tracking-[-0.96px] text-[#1A202C]">${(pkg.total_price / 100).toFixed(0)}</p>
                          {saveCents > 0 ? <CoachProfileChip label={`Save $${Math.round(saveCents / 100)}`} /> : null}
                          {editing ? <CoachProfileButton onClick={() => onEditPackage(pkg)}>Edit</CoachProfileButton> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CoachProfileCard>

            <CoachProfileCard className="gap-6">
              <h2 className={sectionTitle}>About {coach.name.split(" ")[0] || "you"}</h2>
              {editing ? (
                <CoachBioEditor
                  value={c.bio ?? ""}
                  onChange={(bio) => onField("bio", bio)}
                  placeholder="Your background, who you coach and how a session runs"
                />
              ) : bioHtml ? (
                <div
                  className="rich-text-content text-[14px] leading-[18px] tracking-[-0.42px] text-[#484D56]"
                  dangerouslySetInnerHTML={{ __html: bioHtml }}
                />
              ) : (
                <p className="text-[14px] leading-[18px] tracking-[-0.42px] text-[#484D56]">No biography added yet.</p>
              )}
            </CoachProfileCard>

            <CoachProfileCard>
              <CoachProfileCardHeader
                title="Certifications & credentials"
                actions={editing ? <CoachProfileButton variant="primary" onClick={onEditCertifications}>Add or edit</CoachProfileButton> : undefined}
              />
              {(coach.certifications || []).length === 0 ? (
                <p className="text-[16px] leading-[18px] tracking-[-0.48px] text-[#767980]">No certifications added yet.</p>
              ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {(coach.certifications || []).map((cert, idx) => (
                    <div key={cert.id || idx} className="flex items-start gap-[10px] rounded-[10px] border border-[#EAEADF] bg-[#F4F4EB] p-[15px]">
                      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[#CBE7D1] text-[#1E7431]">
                        <SquareCheck className="size-4" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[16px] font-medium leading-[18px] tracking-[-0.48px] text-[#1A202C]">{cert.certification_name || "Certification"}</p>
                        <p className="text-[12px] leading-[14px] tracking-[-0.36px] text-[#A3A6AB]">{cert.issuing_organization || "—"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CoachProfileCard>

            <ReviewsCard
              averageRating={averageRating}
              totalReviews={totalReviews}
              distribution={ratingDistribution}
              reviews={reviews}
              showRating={showPublicRating}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <CoachProfileCard>
              <h2 className={sectionTitle}>Quick info</h2>
              {editing ? (
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className={fieldLabel}>Response time</span>
                    <select
                      className={editInput}
                      value={String(responseTime)}
                      onChange={(e) => onField("response_time_hours", Number(e.target.value))}
                    >
                      {RESPONSE_TIMES.map((h) => (
                        <option key={h} value={h}>Within {h === 1 ? "an hour" : `${h} hours`}</option>
                      ))}
                    </select>
                  </label>
                  <div className="flex flex-col gap-1.5">
                    <span className={fieldLabel}>Session types</span>
                    <div className="flex gap-2">
                      {SESSION_TYPES.map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={sessionTypes.includes(value)}
                          onClick={() => toggleSessionType(value)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-[12px] font-medium",
                            sessionTypes.includes(value) ? "border-[#6698D2] bg-[#E5EDF7] text-[#0054B4]" : "border-[#EAEADF] bg-[#F9F9F5] text-[#767980]"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="flex flex-col gap-1.5">
                    <span className={fieldLabel}>Languages</span>
                    <input
                      className={editInput}
                      placeholder="English, Spanish"
                      value={languagesDraft}
                      onChange={(e) => {
                        setLanguagesDraft(e.target.value);
                        onField("languages", e.target.value.split(",").map((s) => s.trim()).filter(Boolean));
                      }}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className={fieldLabel}>ZIP code</span>
                    <input
                      className={editInput}
                      inputMode="numeric"
                      maxLength={5}
                      value={c.zip_code ?? ""}
                      onChange={(e) => onField("zip_code", e.target.value.replace(/\D/g, "").slice(0, 5))}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className={fieldLabel}>Cancellation policy</span>
                    <textarea
                      className={cn(editInput, "h-auto py-2 leading-[18px]")}
                      rows={2}
                      placeholder="Flexible cancellation up to 24 hours before session"
                      value={c.cancellation_policy ?? ""}
                      onChange={(e) => onField("cancellation_policy", e.target.value)}
                    />
                  </label>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-[10px] text-[14px] leading-[18px] tracking-[-0.42px]">
                    {[
                      ["Response Time", `Within ${responseTime} hour${responseTime === 1 ? "" : "s"}`],
                      ["Session Types", sessionTypesLabel],
                      ["Languages", c.languages?.join(", ") || "English"],
                      ["Location", locationLabel],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-start justify-between gap-3">
                        <span className="shrink-0 font-medium text-[#484D56]">{label}</span>
                        <span className="text-right text-[#767980]">{value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-[4px] border border-[#EAEADF] bg-[#F4F4EB] p-[10px]">
                    <p className="text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#767980]">
                      {c.cancellation_policy || "Flexible cancellation up to 24 hours before session"}
                    </p>
                  </div>
                </>
              )}
            </CoachProfileCard>

            <CoachProfileCard>
              <h2 className={sectionTitle}>FAQ</h2>
              {editing ? (
                <div className="flex flex-col gap-3">
                  {!ownFaqs.length ? (
                    <p className="text-[12px] leading-[14px] text-[#767980]">Families see AthaNext's general questions until you add your own.</p>
                  ) : null}
                  {ownFaqs.map((faq, index) => (
                    <div key={faq.id} className="flex flex-col gap-2 rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] p-[10px]">
                      <div className="flex items-center gap-2">
                        <input
                          id={`faq-q-${faq.id}`}
                          className={editInput}
                          placeholder="Question"
                          aria-label="Question"
                          value={faq.question}
                          onChange={(e) => updateFaq(index, { question: e.target.value })}
                        />
                        <button
                          type="button"
                          className="inline-flex size-8 shrink-0 items-center justify-center rounded-[6px] text-[#767980] hover:text-[#1A202C]"
                          aria-label="Remove question"
                          onClick={() => removeFaq(index)}
                        >
                          <Trash2 className="size-4" strokeWidth={1.5} />
                        </button>
                      </div>
                      <textarea
                        className={cn(editInput, "h-auto py-2 leading-[18px]")}
                        rows={2}
                        placeholder="Answer"
                        aria-label="Answer"
                        value={faq.answer}
                        onChange={(e) => updateFaq(index, { answer: e.target.value })}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addFaq}
                    className="inline-flex w-fit items-center gap-1 text-[14px] font-medium leading-[18px] text-[#0054B4] hover:underline"
                  >
                    <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
                    Add question
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-[10px]">
                  {shownFaqs.map((faq) => {
                    const open = openFaq === faq.id;
                    return (
                      <div key={faq.id}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 text-left"
                          onClick={() => setOpenFaq(open ? null : faq.id)}
                        >
                          <span className="text-[12px] leading-[14px] tracking-[-0.36px] text-[#1A202C]">{faq.question}</span>
                          <ChevronDown className={cn("size-4 shrink-0 text-[#1A202C] transition-transform", open && "rotate-180")} />
                        </button>
                        {open && faq.answer ? <p className="mt-2 text-[12px] leading-[14px] text-[#767980]">{faq.answer}</p> : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </CoachProfileCard>

            <GearAndDealsCard
              coachId={coach.id}
              coachName={coach.name}
              links={coach.affiliate_links}
              dealsEnabled={c.deals_enabled}
              brandNames={brands.map((brand) => brand.name)}
              isOwner
              editing={editing}
              onDealsEnabledChange={(on) => onField("deals_enabled", on)}
              onSaved={onCoachUpdated}
            />
          </div>
        </div>
      </div>

      <ManageBrandsDialog open={brandsOpen} onOpenChange={setBrandsOpen} coachId={coach.id} currentBrands={brands} />

      {slug ? (
        <SharePricingDialog
          open={sharePricingOpen}
          onOpenChange={setSharePricingOpen}
          coach={{
            id: coach.id,
            name: coach.name,
            slug,
            sport: coach.sport,
            coach_position: coach.coach_position,
            position: coach.position,
            specialties: coach.specialties,
            session_types: coach.session_types,
            hourly_rate: coach.hourly_rate,
            profile_image_url: coach.profile_image_url,
            image_url: coach.image_url,
            is_verified: coach.is_verified,
          }}
          packages={packages.filter((pkg) => pkg.is_active)}
          averageRating={averageRating}
          totalReviews={totalReviews}
          canEditSlug
          onSlugUpdated={setSlug}
        />
      ) : null}
    </div>
  );
}
