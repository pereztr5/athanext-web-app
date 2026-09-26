import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BadgeCheck, ChevronDown, ExternalLink, Info, SquareCheck, Star } from "lucide-react";
import { formatRichTextForRender } from "@/utils/richText";
import "@/styles/richText.css";
import { calculateProfileProgress, type ProfileData } from "@/utils/profileCompletion";
import { fetchLocationFromZipCode, formatLocationDisplay } from "@/utils/geolocation";
import { useFAQItems } from "@/hooks/useFAQItems";
import type { CoachPackage } from "@/hooks/useCoachPackages";
import {
  CoachProfileButton,
  CoachProfileCard,
  CoachProfileCardHeader,
  CoachProfileChip,
} from "./CoachProfileCard";
import { AvailabilitySummaryCard } from "./AvailabilitySummaryCard";
import { ROUTES } from "@/routes";
import { cn } from "@/lib/utils";

interface Review {
  id: string;
  coach_id: string;
  rating: number;
  review_text?: string;
  created_at: string;
  reviewer_name?: string;
}

interface CoachProfileViewProps {
  coach: ProfileData & {
    id: string;
    name: string;
    bio?: string;
    coach_position?: string;
    position?: string;
    specialties?: string[];
    session_types?: string[];
    languages?: string[];
    locations?: string[];
    zip_code?: string;
    cancellation_policy?: string;
    response_time_hours?: number;
    company?: string;
    is_verified?: boolean;
    certifications?: {
      id?: string;
      certification_name?: string;
      issuing_organization?: string | null;
    }[];
    rating?: number;
  };
  packages: CoachPackage[];
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
  reviews: Review[];
  onEdit: () => void;
  onEditPackages: () => void;
  onEditCertifications: () => void;
  onLeaveReview?: () => void;
  readOnly?: boolean;
  availability?: ReactNode;
}

export function CoachProfileView({
  coach,
  packages,
  averageRating,
  totalReviews,
  ratingDistribution,
  reviews,
  onEdit,
  onEditPackages,
  onEditCertifications,
  readOnly = false,
  availability,
}: CoachProfileViewProps) {
  const [locationLabel, setLocationLabel] = useState<string>(
    coach.locations?.[0] || "Location not set"
  );
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const { data: faqs = [] } = useFAQItems("general");
  const profileStrength = useMemo(() => calculateProfileProgress(coach), [coach]);
  const bioHtml = formatRichTextForRender(coach.bio);
  const position = coach.coach_position || coach.position || "Coach";
  const hasRating = averageRating > 0 || Boolean(coach.rating);
  const ratingDisplay = hasRating
    ? `${(averageRating > 0 ? averageRating : Number(coach.rating)).toFixed(1).replace(".", ",")} (${totalReviews || 0})`
    : "No reviews";

  const photoUrl = coach.profile_image_url || coach.image_url;
  const pillars = (coach.specialties || []).slice(0, 6);
  const brands = coach.company ? [coach.company] : [];
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

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: coach.name, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // cancelled
    }
  };

  const trainingFormat = useMemo(() => {
    const types = (coach.session_types || []).map((t) => t.toLowerCase());
    const hasVirtual = types.some((t) => t.includes("virtual") || t.includes("online"));
    const hasInPerson = types.some(
      (t) => t.includes("in-person") || t.includes("in person") || t.includes("field")
    );
    const modes: string[] = [];
    if (hasVirtual) modes.push("Virtual");
    if (hasInPerson) modes.push("In person");
    const modeLabel = modes.length ? modes.join(" and ") : "Not specified";
    return `${modeLabel} - ${locationLabel}`;
  }, [coach.session_types, locationLabel]);

  const responseTime = coach.response_time_hours ?? 24;
  const sessionTypesLabel = coach.session_types?.length
    ? coach.session_types
        .map((t) => t.replace(/-/g, " "))
        .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
        .join(" & ")
    : "Virtual & In-person";
  const languagesLabel = coach.languages?.join(", ") || "English";

  const faqItems =
    faqs.length > 0
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
  const headerRating = hasRating
    ? `${(averageRating > 0 ? averageRating : Number(coach.rating)).toFixed(1).replace(".", ",")} (${totalReviews || 0})`
    : null;
  const reviewScore = (averageRating > 0 ? averageRating : Number(coach.rating) || 0).toFixed(1).replace(".", ",");
  const filledStars = Math.round(averageRating > 0 ? averageRating : Number(coach.rating) || 0);

  if (readOnly) {
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
            <div className="relative h-[165px] overflow-hidden rounded-[10px] border border-[#EAEADF] bg-[#C1C1B8] lg:h-auto lg:min-h-[165px]">
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
                  <Star className="size-[7px] fill-[#F0B144] text-[#F0B144]" />
                  {headerRating}
                </p>
              ) : null}
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
            </div>

            <div className="flex flex-col gap-6 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] py-[30px]">
              <p className="text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#767980]">Brands</p>
              <p className="text-[12px] font-medium leading-[13px] tracking-[-0.36px] text-[#484D56]">
                {brands.length > 0 ? brands.join(", ") : "—"}
              </p>
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
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-[#CBE7D1] bg-[#DEECE1] text-[#1B8A3B]">
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

          <CoachProfileCard>
            <h2 className={sectionTitle}>Reviews & ratings</h2>
            <div className="flex flex-col gap-5 rounded-[10px] border border-[#EAEADF] bg-[#F4F4EB] p-[15px]">
              <div className="flex items-end justify-between gap-3">
                <p className="flex items-end gap-[6px]">
                  <span className="text-[32px] font-bold leading-[30px] tracking-[-0.96px] text-[#1A202C]">
                    {reviewScore}
                  </span>
                  <span className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#767980]">
                    ({totalReviews || 0} reviews)
                  </span>
                </p>
                <span className="inline-flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "size-[12px]",
                        i < filledStars ? "fill-[#F0B144] text-[#F0B144]" : "fill-[#D9D9CF] text-[#D9D9CF]"
                      )}
                    />
                  ))}
                </span>
              </div>
              <div className="h-px w-full bg-[#EAEADF]" />
              <div className="flex flex-col gap-[10px]">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = ratingDistribution[stars] || 0;
                  const width = totalReviews > 0 ? `${(count / totalReviews) * 100}%` : "0%";
                  return (
                    <div key={stars} className="flex items-center gap-[17px]">
                      <span className="w-[50px] text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#1A202C]">
                        {stars} {stars === 1 ? "star" : "stars"}
                      </span>
                      <span className="h-[5px] min-w-0 flex-1 overflow-hidden rounded-[10px] bg-[#D9D9CF]">
                        <span className="block h-full rounded-[10px] bg-[#0054B4]" style={{ width }} />
                      </span>
                      <span className="w-5 text-right text-[12px] leading-[14px] text-[#1A202C]">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CoachProfileCard>
        </div>
      </div>
    );
  }

  const nameInitials = coach.name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  const maxReviewCount = Math.max(1, ...[5, 4, 3, 2, 1].map((star) => ratingDistribution[star] ?? 0));

  return (
    <div className="overflow-x-hidden px-4 pb-16 md:px-10">
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
      {profileStrength.completion < 100 && (
        <CoachProfileCard>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[20px] font-medium leading-[18px] tracking-[-1px] text-[#1A202C]">Profile strength</h2>
            <span className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#1A202C]">
              {profileStrength.completion}%
            </span>
          </div>
          <div className="h-[6px] w-full overflow-hidden rounded-[10px] bg-[#D9D9CF]">
            <div
              className="h-full rounded-[10px] bg-[#0054B4]"
              style={{ width: `${profileStrength.completion}%` }}
            />
          </div>
          <p className="text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#A3A6AB]">
            {profileStrength.completedFields} of {profileStrength.totalFields} fields completed.
            {profileStrength.missingFields.length > 0
              ? " Add the missing details to increase your visibility."
              : ""}
          </p>
          {profileStrength.missingFields.length > 0 && (
            <div className="flex flex-wrap items-center gap-[10px]">
              <span className="text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#A3A6AB]">Pending</span>
              {profileStrength.missingFields.map((field) => (
                <CoachProfileChip key={field} label={field} />
              ))}
            </div>
          )}
        </CoachProfileCard>
      )}

      <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-[147px_minmax(0,1fr)_minmax(0,1fr)_147px] lg:items-stretch">
        <div className="relative h-[179px] overflow-hidden rounded-[10px] border border-[#EAEADF] bg-[#C1C1B8] lg:h-auto lg:min-h-[179px]">
          {photoUrl ? (
            <img src={photoUrl} alt={coach.name} className="absolute inset-0 size-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center text-[20px] font-medium text-[#484D56]">
              {nameInitials || "C"}
            </span>
          )}
        </div>

        <CoachProfileCard className="justify-between gap-5">
          <div className="flex flex-col gap-[10px]">
            <div className="flex items-end gap-[2px]">
              <h1 className="text-[32px] font-bold leading-[28px] tracking-[-1.6px] text-[#1A202C]">{coach.name}</h1>
              {verified ? (
                <BadgeCheck className="size-4 shrink-0 fill-[#0054B4] text-white" aria-label="Verified" />
              ) : null}
            </div>
            <div className="flex flex-col gap-[2px] text-[12px] tracking-[-0.36px] text-[#767980]">
              <p className="font-normal leading-[14px]">{locationLabel}</p>
              <p className="font-medium leading-[13px]">{position}</p>
            </div>
          </div>
          <div className="flex items-end justify-between gap-3">
            <span className="inline-flex items-center gap-[3px] text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#767980]">
              <Star className="size-[7px] fill-[#F0B144] text-[#F0B144]" />
              {headerRating || "No reviews"}
            </span>
            <div className="flex items-center gap-[10px]">
              <CoachProfileButton onClick={handleShare}>
                Share
                <ExternalLink className="size-3" strokeWidth={1.75} />
              </CoachProfileButton>
              <CoachProfileButton onClick={onEdit}>Edit</CoachProfileButton>
            </div>
          </div>
        </CoachProfileCard>

        <CoachProfileCard className="justify-between gap-6">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#767980]">Pillars</span>
            <CoachProfileButton onClick={onEdit}>Edit</CoachProfileButton>
          </div>
          <div className="flex flex-wrap gap-x-[10px] gap-y-[10px]">
            {pillars.length > 0 ? (
              pillars.map((pillar) => <CoachProfileChip key={pillar} label={pillar} />)
            ) : (
              <span className="text-[14px] text-[#A3A6AB]">No pillars set</span>
            )}
          </div>
        </CoachProfileCard>

        <CoachProfileCard className="gap-6">
          <span className="text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#767980]">Brands</span>
          <p className="text-[12px] font-medium leading-[13px] tracking-[-0.36px] text-[#484D56]">
            {brands.length > 0 ? brands.join(", ") : "—"}
          </p>
        </CoachProfileCard>
      </div>

      <AvailabilitySummaryCard coachId={coach.id} sessionTypes={coach.session_types} />

      <div className="grid w-full grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_317px]">
        <div className="flex min-w-0 flex-col gap-6">
          <CoachProfileCard>
            <CoachProfileCardHeader
              title="Coaching packages"
              actions={
                <>
                  <CoachProfileButton onClick={onEditPackages}>Edit</CoachProfileButton>
                  <CoachProfileButton variant="primary" onClick={onEditPackages}>
                    Add
                  </CoachProfileButton>
                </>
              }
            />
            {packages.length === 0 ? (
              <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#767980]">
                No packages yet. Add one to get bookings.
              </p>
            ) : (
              <div className="flex flex-col gap-[10px]">
                {packages.map((pkg) => {
                  const listCents =
                    pkg.price_per_session > 0 && pkg.session_count > 0
                      ? pkg.price_per_session * pkg.session_count
                      : 0;
                  const saveCents = listCents > pkg.total_price ? listCents - pkg.total_price : 0;
                  return (
                    <div
                      key={pkg.id}
                      className="flex flex-col gap-3 rounded-[10px] border border-[#EAEADF] bg-[#F1F1E6] p-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#1A202C]">
                          {pkg.package_name}
                        </p>
                        {pkg.description ? (
                          <p className="mt-[6px] text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#A3A6AB]">
                            {pkg.description}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-end gap-[10px]">
                        <p className="text-[32px] font-bold leading-[30px] tracking-[-0.96px] text-[#1A202C]">
                          ${(pkg.total_price / 100).toFixed(0)}
                        </p>
                        {saveCents > 0 ? (
                          <CoachProfileChip label={`Save $${Math.round(saveCents / 100)}`} />
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CoachProfileCard>

          <CoachProfileCard className="gap-6">
            <CoachProfileCardHeader
              title={`About ${coach.name.split(" ")[0] || "coach"}`}
              actions={<CoachProfileButton onClick={onEdit}>Edit</CoachProfileButton>}
            />
            {bioHtml ? (
              <div
                className="rich-text-content text-[14px] font-normal leading-[18px] tracking-[-0.42px] text-[#484D56]"
                dangerouslySetInnerHTML={{ __html: bioHtml }}
              />
            ) : (
              <p className="text-[14px] font-normal leading-[18px] tracking-[-0.42px] text-[#484D56]">
                No biography added yet.
              </p>
            )}
          </CoachProfileCard>

          <CoachProfileCard>
            <CoachProfileCardHeader
              title="Certifications & credentials"
              actions={
                <>
                  <CoachProfileButton onClick={onEditCertifications}>Edit</CoachProfileButton>
                  <CoachProfileButton variant="primary" onClick={onEditCertifications}>
                    Add
                  </CoachProfileButton>
                </>
              }
            />
            {(coach.certifications || []).length === 0 ? (
              <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#767980]">
                No certifications added yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {(coach.certifications || []).map((cert, idx) => (
                  <div
                    key={cert.id || idx}
                    className="flex items-start gap-[10px] rounded-[10px] border border-[#EAEADF] bg-[#F4F4EB] p-[15px]"
                  >
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-[#CBE7D1] bg-[#DEECE1] text-[#3C7A4E]">
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

          <CoachProfileCard>
            <CoachProfileCardHeader
              title="Training specialization and format"
              actions={<CoachProfileButton onClick={onEdit}>Edit</CoachProfileButton>}
            />
            <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#1A202C]">Specializations</p>
            <div className="flex flex-wrap gap-2">
              {pillars.length > 0 ? (
                pillars.map((pillar) => <CoachProfileChip key={`spec-${pillar}`} label={pillar} />)
              ) : (
                <span className="text-[14px] text-[#A3A6AB]">None set</span>
              )}
            </div>
            <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#1A202C]">Training format</p>
            <p className="text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#A3A6AB]">{trainingFormat}</p>
          </CoachProfileCard>

          <CoachProfileCard>
            <h2 className="text-[20px] font-medium leading-[18px] tracking-[-1px] text-[#1A202C]">Reviews & ratings</h2>
            <div className="flex flex-col gap-5 rounded-[10px] border border-[#EAEADF] bg-[#F4F4EB] p-[15px]">
              <div className="flex items-end justify-between gap-3">
                <div className="flex items-end gap-[6px]">
                  <p className="text-[32px] font-bold leading-[30px] tracking-[-0.96px] text-[#1A202C]">
                    {hasRating ? reviewScore : "—"}
                  </p>
                  <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#767980]">
                    {totalReviews > 0 ? `(${totalReviews} reviews)` : "No verified ratings yet"}
                  </p>
                </div>
                <div className="flex items-center gap-[3px]" aria-hidden>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className="size-[11px]"
                      strokeWidth={1.5}
                      fill={star <= filledStars ? "#F0B144" : "none"}
                      color={star <= filledStars ? "#F0B144" : "#D9D9CF"}
                    />
                  ))}
                </div>
              </div>
              <div className="h-px w-full bg-[#EAEADF]" />
              <div className="flex flex-col gap-[10px]">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = ratingDistribution[star] ?? 0;
                  const width = totalReviews > 0 ? Math.round((count / maxReviewCount) * 100) : 0;
                  return (
                    <div key={star} className="flex items-center gap-[17px]">
                      <span className="w-[50px] shrink-0 text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#1A202C]">
                        {star} {star === 1 ? "star" : "stars"}
                      </span>
                      <span className="h-[5px] min-w-0 flex-1 overflow-hidden rounded-[10px] bg-[#D9D9CF]">
                        <span className="block h-[5px] rounded-[10px] bg-[#0054B4]" style={{ width: `${width}%` }} />
                      </span>
                      <span className="w-5 shrink-0 text-right text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#1A202C]">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CoachProfileCard>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <CoachProfileCard>
            <CoachProfileCardHeader
              title="Quick info"
              actions={<CoachProfileButton onClick={onEdit}>Edit</CoachProfileButton>}
            />
            <div className="flex flex-col gap-[10px] text-[14px] leading-[18px] tracking-[-0.42px]">
              {[
                ["Response Time", `Within ${responseTime} hours`],
                ["Session Types", sessionTypesLabel],
                ["Languages", languagesLabel],
                ["Location", locationLabel],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-3">
                  <span className="shrink-0 font-medium text-[#484D56]">{label}</span>
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
            <CoachProfileCardHeader
              title="FAQ"
              actions={<CoachProfileButton onClick={onEdit}>Edit</CoachProfileButton>}
            />
            <div className="flex flex-col gap-[10px]">
              {faqItems.map((faq) => {
                const open = openFaq === faq.id;
                return (
                  <div key={faq.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 text-left"
                      onClick={() => setOpenFaq(open ? null : faq.id)}
                    >
                      <span className="text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#1A202C]">
                        {faq.question}
                      </span>
                      <ChevronDown
                        className={cn("size-4 shrink-0 text-[#1A202C] transition-transform", open && "rotate-180")}
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
        </div>
      </div>
      </div>
    </div>
  );
}
