import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BadgeCheck, ChevronDown, Info, SquareCheck } from "lucide-react";
import { formatRichTextForRender } from "@/utils/richText";
import "@/styles/richText.css";
import type { ProfileData } from "@/utils/profileCompletion";
import { fetchLocationFromZipCode, formatLocationDisplay } from "@/utils/geolocation";
import { useFAQItems } from "@/hooks/useFAQItems";
import { normalizeCoachFaqs } from "./FAQSection";
import type { CoachPackage } from "@/hooks/useCoachPackages";
import {
  CoachProfileCard,
  CoachProfileChip,
} from "./CoachProfileCard";
import { GearAndDealsCard } from "./GearAndDealsCard";
import { ReviewsCard } from "@/components/reviews/ReviewsCard";
import { BrandStar } from "@/components/brand";
import { PathwayTagChips } from "@/components/common/PathwayTagChips";
import { ROUTES } from "@/routes";
import { cn } from "@/lib/utils";
import { isPublicCoachRatingVisible, publicCoachRatingLabel } from "@/utils/publicRating";
import { CommunityChannelButton } from "@/components/chat/CommunityChannelButton";
import { useCoachBrands } from "@/hooks/useBrands";
import type { Brand } from "@/utils/brands";
import { BrandLogos } from "./BrandLogos";

const NO_BRANDS: Brand[] = [];

export interface ProfileReview {
  id: string;
  coach_id: string;
  rating: number;
  review_text?: string;
  created_at: string;
  reviewer_name?: string;
}

export type CoachProfileData = ProfileData & {
    id: string;
    name: string;
    slug?: string;
    bio?: string;
    coach_position?: string;
    position?: string;
    specialties?: string[];
    pathway_tags?: string[];
    session_types?: string[];
    languages?: string[];
    locations?: string[];
    zip_code?: string;
    cancellation_policy?: string;
    response_time_hours?: number;
    profile_faqs?: { id: string; question: string; answer: string }[] | null;
    company?: string;
    affiliate_links?: unknown;
    is_verified?: boolean;
    hourly_rate?: number;
    sport?: string | null;
    certifications?: {
      id?: string;
      certification_name?: string;
      issuing_organization?: string | null;
    }[];
    rating?: number;
    deals_enabled?: boolean | null;
};

interface CoachProfileViewProps {
  coach: CoachProfileData;
  packages: CoachPackage[];
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
  reviews: ProfileReview[];
  onLeaveReview?: () => void;
  availability?: ReactNode;
  /** Guided "Book a session" action for the read-only header (ATH-28). */
  bookAction?: ReactNode;
}

export function CoachProfileView({
  coach,
  packages,
  averageRating,
  totalReviews,
  ratingDistribution,
  reviews,
  availability,
  bookAction,
}: CoachProfileViewProps) {
  const [locationLabel, setLocationLabel] = useState<string>(
    coach.locations?.[0] || "Location not set"
  );
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const { data: faqs = [] } = useFAQItems("general");
  const bioHtml = formatRichTextForRender(coach.bio);
  const position = coach.coach_position || coach.position || "Coach";
  const showPublicRating = isPublicCoachRatingVisible(totalReviews, averageRating);

  const photoUrl = coach.profile_image_url || coach.image_url;
  const pillars = (coach.specialties || []).slice(0, 6);
  const pathwayTags = coach.pathway_tags || [];
  // Brands are linked brand records with logos (ATH-56), separate from the coaches.company academy.
  const { data: brands = NO_BRANDS } = useCoachBrands(coach.id);
  const verified = Boolean(coach.is_verified);

  useEffect(() => {
    let cancelled = false;
    if (!coach.zip_code) {
      setLocationLabel(coach.locations?.[0] || "Location not set");
      return;
    }
    fetchLocationFromZipCode(coach.zip_code).then((info) => {
      if (cancelled) return;
      if (info) setLocationLabel(formatLocationDisplay(info));
      else setLocationLabel(coach.locations?.[0] || "Location not set");
    });
    return () => {
      cancelled = true;
    };
  }, [coach.zip_code, coach.locations]);

  const responseTime = coach.response_time_hours ?? 24;
  const sessionTypesLabel = coach.session_types?.length
    ? coach.session_types
        .map((t) => t.replace(/-/g, " "))
        .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
        .join(" & ")
    : "Virtual & In-person";
  const languagesLabel = coach.languages?.join(", ") || "English";

  const ownedFaqs = normalizeCoachFaqs(coach.profile_faqs);
  const faqItems =
    ownedFaqs.length > 0
      ? ownedFaqs
          .filter((faq) => faq.question?.trim())
          .map((faq) => ({
            id: faq.id,
            question: faq.question,
            answer: faq.answer || "",
          }))
      : faqs.length > 0
        ? faqs.slice(0, 5).map((faq) => ({
            id: faq.id,
            question: faq.question?.en || Object.values(faq.question || {})[0] || "Question",
            answer: faq.answer?.en || Object.values(faq.answer || {})[0] || "",
          }))
        : [
            { id: "1", question: "What age groups do you work with?", answer: "" },
            { id: "2", question: "Do you offer group training sessions?", answer: "" },
            { id: "3", question: "What about report of the lesson?", answer: "" },
            { id: "4", question: "How long until I see improvement?", answer: "" },
            { id: "5", question: "Do you provide remote training packages?", answer: "" },
          ];

  const sectionTitle = "text-[20px] font-medium leading-[18px] tracking-[-1px] text-[#1A202C]";
  const headerRating = showPublicRating
    ? `${publicCoachRatingLabel(averageRating, totalReviews)} (${totalReviews})`
    : "New";

  return (
    <div className="overflow-x-hidden px-4 pb-16 md:px-10">
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
        <Link
          to={ROUTES.COACHES}
          className="inline-flex w-fit items-center gap-1 text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#767980]"
        >
          <ArrowLeft className="size-[15px]" strokeWidth={1.75} />
          All coaches
        </Link>

        <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-[147px_minmax(0,1fr)_minmax(0,1fr)_147px] lg:items-stretch">
          <div className="relative aspect-square w-[165px] overflow-hidden rounded-[10px] border border-[#EAEADF] bg-[#C1C1B8] lg:w-full lg:self-start">
            {photoUrl ? (
              <img src={photoUrl} alt={coach.name} className="absolute inset-0 size-full object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center text-[20px] font-medium text-[#484D56]">
                {(coach.name || "C").slice(0, 1)}
              </span>
            )}
          </div>

          <div className="flex flex-col justify-center gap-5 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] py-[30px]">
            <div className="flex flex-col gap-[10px]">
              <div className="flex items-end gap-[2px]">
                <h1 className="text-[32px] font-bold leading-[28px] tracking-[-1.6px] text-[#1A202C]">
                  {coach.name}
                </h1>
                {verified ? (
                  <BadgeCheck className="size-5 shrink-0 fill-[#0054B4] text-white" aria-label="Verified" />
                ) : null}
              </div>
              <div className="flex flex-col gap-[2px] text-[12px] tracking-[-0.36px] text-[#767980]">
                <p className="font-normal leading-[14px]">{locationLabel}</p>
                <p className="font-medium leading-[13px]">{position}</p>
              </div>
            </div>
            {headerRating ? (
              <p className="flex items-center gap-[3px] text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#767980]">
                <BrandStar size={8} />
                {headerRating}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-[10px]">
              {bookAction}
              {/* Signed-in athletes join the coach's community here; renders nothing for coaches (ATH-21). */}
              <CommunityChannelButton coachId={coach.id} />
            </div>
          </div>

          <div className="flex flex-col gap-6 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] py-[30px]">
            <p className="text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#767980]">Pillars</p>
            <div className="flex flex-wrap gap-[10px]">
              {pillars.length > 0 ? (
                pillars.map((pillar) => <CoachProfileChip key={pillar} label={pillar} />)
              ) : (
                <span className="text-[14px] text-[#A3A6AB]">No pillars set</span>
              )}
            </div>
            {pathwayTags.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#767980]">Pathway</p>
                <PathwayTagChips selected={pathwayTags} readOnly />
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-6 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] py-[30px]">
            <p className="text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#767980]">Brands</p>
            <BrandLogos brands={brands} />
          </div>
        </div>

        {availability}

        <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_317px]">
          <div className="flex min-w-0 flex-col gap-6">
            <CoachProfileCard>
              <h2 className={sectionTitle}>Coaching packages</h2>
              {packages.length === 0 ? (
                <div className="flex items-center gap-[10px] rounded-[10px] border border-[#EAEADF] bg-[#F4F4EB] px-[25px] py-[30px]">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[#EAEADF] text-[#A3A6AB]">
                    <Info className="size-4" strokeWidth={1.75} />
                  </span>
                  <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#A3A6AB]">
                    No packages are currently provided by this coach.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-2">
                  {packages.map((pkg) => (
                    <div key={pkg.id} className="rounded-[10px] border border-[#EAEADF] bg-[#F4F4EB] p-[15px]">
                      <p className="text-[16px] font-medium leading-[18px] tracking-[-0.48px] text-[#1A202C]">
                        {pkg.package_name}
                      </p>
                      <p className="mt-2 text-[16px] font-medium text-[#1A202C]">
                        ${(pkg.total_price / 100).toFixed(0)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CoachProfileCard>

            <CoachProfileCard>
              <h2 className={sectionTitle}>About {coach.name.split(" ")[0] || "coach"}</h2>
              {bioHtml ? (
                <div
                  className="rich-text-content text-[14px] font-normal leading-[18px] tracking-[-0.42px] text-[#484D56]"
                  dangerouslySetInnerHTML={{ __html: bioHtml }}
                />
              ) : (
                <p className="text-[14px] text-[#A3A6AB]">No biography added yet.</p>
              )}
            </CoachProfileCard>
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <CoachProfileCard>
              <h2 className={sectionTitle}>Quick info</h2>
              <div className="flex flex-col gap-[10px] text-[14px] leading-[18px] tracking-[-0.42px]">
                {[
                  ["Response Time", `Within ${responseTime} hours`],
                  ["Session Types", sessionTypesLabel],
                  ["Languages", languagesLabel],
                  ["Location", locationLabel],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-3">
                    <span className="font-medium text-[#484D56]">{label}</span>
                    <span className="text-right font-normal text-[#767980]">{value}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-[4px] border border-[#EAEADF] bg-[#F4F4EB] p-[10px]">
                <p className="text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#767980]">
                  {coach.cancellation_policy || "Flexible cancellation up to 24 hours before session"}
                </p>
              </div>
            </CoachProfileCard>

            <CoachProfileCard>
              <h2 className={sectionTitle}>FAQ</h2>
              <div className="flex flex-col gap-[10px]">
                {faqItems.map((faq) => {
                  const open = openFaq === faq.id;
                  return (
                    <div key={faq.id}>
                      <button
                        type="button"
                        className="flex w-full items-start justify-between gap-2 text-left"
                        onClick={() => setOpenFaq(open ? null : faq.id)}
                      >
                        <span className="text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#1A202C]">
                          {faq.question}
                        </span>
                        <ChevronDown
                          className={cn("size-4 shrink-0 text-[#767980] transition-transform", open && "rotate-180")}
                        />
                      </button>
                      {open && faq.answer ? (
                        <p className="mt-2 text-[12px] leading-[14px] text-[#767980]">{faq.answer}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </CoachProfileCard>

            <GearAndDealsCard
              coachId={coach.id}
              coachName={coach.name}
              links={coach.affiliate_links}
              dealsEnabled={coach.deals_enabled}
              brandNames={brands.map((brand) => brand.name)}
            />
          </div>
        </div>

        <CoachProfileCard>
          <h2 className={sectionTitle}>Certifications & credentials</h2>
          {(coach.certifications || []).length === 0 ? (
            <p className="text-[16px] text-[#A3A6AB]">No certifications added yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {(coach.certifications || []).map((cert, idx) => (
                <div
                  key={cert.id || idx}
                  className="flex items-start gap-[10px] rounded-[10px] border border-[#EAEADF] bg-[#F4F4EB] p-[15px]"
                >
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[#CBE7D1] text-[#1E7431]">
                    <SquareCheck className="size-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[16px] font-medium leading-[18px] tracking-[-0.48px] text-[#1A202C]">
                      {cert.certification_name || "Certification"}
                    </p>
                    <p className="text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#A3A6AB]">
                      {cert.issuing_organization || "—"}
                    </p>
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
    </div>
  );
}
