/**
 * My Profile when not editing (Working Copy c-profile, `AN.simpleProfile`): one 720px column with
 * who (completeness strip, hero, Edit and Share, facts), About, Sessions and pricing, Reviews and More.
 */
import { Link } from "react-router-dom";
import { BadgeCheck, Check, Eye, Pencil, Plus, Share2 } from "lucide-react";
import type { CoachProfileExtras, ProfileService } from "@/api/coachProfile";
import type { CoachPackage } from "@/hooks/useCoachPackages";
import { BrandPill } from "@/components/brand";
import { CoachIntroCallCard } from "@/components/intro-calls";
import { card, primaryButton, secondaryButton, textButton } from "@/components/schedule/styles";
import { sanitizePathwayTags } from "@/constants/pathwayTags";
import { cn } from "@/lib/utils";
import { formatRichTextForRender } from "@/utils/richText";
import "@/styles/richText.css";
import type { CoachProfileData, ProfileReview } from "./CoachProfileView";
import type { CoachFaqItem } from "./FAQSection";
import { OrganizationsCard } from "./OrganizationsCard";
import { organizationsForProfile } from "./organizationLogos";
import { CompletenessNudge } from "./own/Completeness";
import { MoreList } from "./own/MoreList";
import { OwnReviews } from "./own/OwnReviews";
import { PricingSection } from "./own/PricingSection";
import type { StepName } from "./own/hooks";
import { Avatar, Stars } from "./own/parts";
import { agesLine, caption, coachesLine, money, plural, repliesLabel, sectionTitle, sp2Card } from "./own/shared";

const tagRow = "grid grid-cols-[72px_minmax(0,1fr)] items-start gap-[10px]";
const tagLabel = "pt-1 text-[12px] font-medium leading-[13px] text-[#767980]";

export const OwnProfilePreview = ({
  coach,
  packages,
  services,
  extras,
  averageRating,
  totalReviews,
  showRating,
  reviews,
  locationLabel,
  organization,
  faqs,
  brands,
  brandNames,
  cancellation,
  completeness,
  previewHref,
  onStep,
  onStartEdit,
  onShare,
}: {
  coach: CoachProfileData & { image_url?: string | null; profile_image_url?: string | null };
  packages: CoachPackage[];
  /** Session types families see, base 1-on-1 row first. */
  services: ProfileService[];
  extras: CoachProfileExtras | undefined;
  averageRating: number;
  totalReviews: number;
  showRating: boolean;
  reviews: ProfileReview[];
  locationLabel: string;
  organization: { name: string; to: string } | null;
  faqs: CoachFaqItem[];
  brands: { id: string; name: string; logo_url: string | null }[];
  brandNames: string[];
  cancellation: string;
  completeness: { steps: [StepName, boolean][]; done: number; next: StepName | null };
  previewHref: string;
  onStep: (step: StepName) => void;
  onStartEdit: () => void;
  onShare: () => void;
}) => {
  const first = coach.name.split(" ")[0] || coach.name;
  const role = coach.coach_position || coach.position || "Coach";
  const individual = services.filter((s) => s.format === "individual" && s.price > 0);
  const from = individual.length ? Math.min(...individual.map((s) => s.price)) : 0;
  const places = (coach.locations ?? []).filter((l) => l && l !== "Video call").join(", ");
  const facts = [
    ["1-on-1 from", from ? money(from) : ""],
    ["Where", places || locationLabel],
    ["Replies", repliesLabel(coach.response_time_hours)],
    ["Speaks", (coach.languages ?? []).filter(Boolean).join(", ")],
  ].filter(([, v]) => v);
  const levels = sanitizePathwayTags(coach.pathway_tags);
  const pillars = coach.specialties ?? [];
  const coaches = coachesLine(coach);
  const ages = agesLine(coach);
  const bioHtml = formatRichTextForRender(coach.bio);
  const creds = (coach.certifications ?? []).map((c) => c.certification_name).filter(Boolean) as string[];

  const scrollToReviews = () => document.getElementById("own-reviews")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-[10px]">
        <BrandPill tone="sunk">
          <Eye strokeWidth={1.5} aria-hidden="true" />
          This is what families see
        </BrandPill>
        <Link to={previewHref} className={textButton}>
          Preview as a family
        </Link>
      </div>

      <section aria-label="Coach" className={cn(card, sp2Card)}>
        <CompletenessNudge {...completeness} onStep={onStep} />
        <div className="flex items-center gap-4">
          <Avatar name={coach.name} src={coach.profile_image_url || coach.image_url} size={76} className="max-md:!size-16" />
          <div className="flex min-w-0 flex-col gap-2">
            <span className="flex items-center gap-1.5">
              <h1 className="text-[22px] font-bold leading-[24px] tracking-[-0.05em] text-[#1A202C] md:text-[26px] md:leading-[28px]">{coach.name}</h1>
              {coach.is_verified ? <BadgeCheck className="size-5 shrink-0 fill-[#0054B4] text-[#F7F7F0]" aria-label="Verified" /> : null}
            </span>
            <span className={caption}>
              {[role, locationLabel].filter(Boolean).join(" · ")}
              {organization ? (
                <>
                  {" · "}
                  <Link to={organization.to} className="font-medium text-[#0054B4] hover:underline">
                    {organization.name}
                  </Link>
                </>
              ) : null}
            </span>
            {showRating ? (
              <span className="flex items-center gap-1.5">
                <Stars value={averageRating} />
                <b className="text-[14px] font-medium">{averageRating.toFixed(1)}</b>
                <button type="button" className={cn(caption, "hover:underline")} onClick={scrollToReviews}>
                  {plural(totalReviews, "review")}
                </button>
              </span>
            ) : totalReviews ? (
              <button type="button" className={cn(caption, "self-start hover:underline")} onClick={scrollToReviews}>
                {plural(totalReviews, "review")}
              </button>
            ) : (
              <span className={caption}>No reviews yet</span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={primaryButton} onClick={onStartEdit}>
            <Pencil strokeWidth={1.5} aria-hidden="true" />
            Edit profile
          </button>
          <button type="button" className={secondaryButton} onClick={onShare}>
            <Share2 strokeWidth={1.5} aria-hidden="true" />
            Share profile
          </button>
        </div>
        <CoachIntroCallCard coachId={coach.id} mode="own" coachFirstName={first} />
        {facts.length ? (
          <div className="grid grid-cols-2 gap-y-[14px] border-t border-[#EAEADF] pt-4 md:grid-cols-4 md:gap-y-0">
            {facts.map(([label, value], i) => (
              <div
                key={label}
                className={cn(
                  "flex min-w-0 flex-col gap-1.5 pr-[10px]",
                  i > 0 && "border-l border-[#EAEADF] pl-[14px]",
                  i === 2 && "max-md:border-l-0 max-md:pl-0"
                )}
              >
                <span className={caption}>{label}</span>
                <span className="break-words text-[14px] font-medium leading-[18px] text-[#1A202C]">{value}</span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <OrganizationsCard brands={organizationsForProfile(coach.id, brands)} />

      <section aria-label="About" className={cn(card, sp2Card)}>
        <h2 className={sectionTitle}>About</h2>
        <div className="flex flex-col gap-[10px]">
          {coaches || ages ? (
            <div className={tagRow}>
              <span className={tagLabel}>Coaches</span>
              <div className="flex flex-wrap gap-1.5">
                {coaches ? <BrandPill tone="teal">{coaches}</BrandPill> : null}
                {ages ? <BrandPill tone="sunk">{ages}</BrandPill> : null}
              </div>
            </div>
          ) : null}
          {levels.length ? (
            <div className={tagRow}>
              <span className={tagLabel}>Levels</span>
              <div className="flex flex-wrap gap-1.5">
                {levels.map((l) => (
                  <BrandPill key={l} className="border border-[#D9D9CF] bg-[#F1F1E6] text-[#1A202C]">
                    {l}
                  </BrandPill>
                ))}
              </div>
            </div>
          ) : null}
          {pillars.length ? (
            <div className={tagRow}>
              <span className={tagLabel}>Pillars</span>
              <div className="flex flex-wrap gap-1.5">
                {pillars.map((p) => (
                  <BrandPill key={p} tone="blue">
                    {p}
                  </BrandPill>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        {bioHtml ? (
          <div
            className="rich-text-content text-[16px] leading-[22px] tracking-[-0.03em] text-[#1A202C]"
            dangerouslySetInnerHTML={{ __html: bioHtml }}
          />
        ) : (
          <button type="button" className={cn(textButton, "self-start")} onClick={onStartEdit}>
            <Plus strokeWidth={1.5} aria-hidden="true" />
            Add a short bio
          </button>
        )}
        {creds.length ? (
          <div className="flex flex-wrap gap-x-[18px] gap-y-2">
            {creds
              .filter((name) => name.trim().toLowerCase() !== "background check")
              .map((name, i) => (
              <span key={`${name}-${i}`} className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#484D56]">
                <Check className="size-4 text-[#1E7431]" strokeWidth={2} aria-hidden="true" />
                {name}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <PricingSection
        coachId={coach.id}
        packages={packages}
        services={services}
        mostBookedId={extras?.mostBookedPackageId ?? null}
        cancellation={cancellation}
        onEdit={onStartEdit}
      />

      <OwnReviews coachId={coach.id} averageRating={averageRating} totalReviews={totalReviews} showRating={showRating} fallback={reviews} />

      <MoreList coachId={coach.id} firstName={first} faqs={faqs} links={coach.affiliate_links} dealsEnabled={coach.deals_enabled} brandNames={brandNames} />
    </div>
  );
};
