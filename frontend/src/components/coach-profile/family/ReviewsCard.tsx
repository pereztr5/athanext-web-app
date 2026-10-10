import { useState } from "react";
import type { Review } from "@/api/reviews";
import { secondaryButton, smallButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { CoachProfileCard } from "../CoachProfileCard";
import { Stars } from "./Stars";
import { caption, cardGap, initialsOf, lbl, medium, plural, sectionTitle } from "./styles";

export const REVIEWS_ANCHOR = "coach-reviews";

/** Reviewers show as first name and last initial ("Casey S."). */
const shortName = (name?: string) => {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "A family";
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
};

/** "Parent of a U16 athlete" or "Athlete, 18+", from the athlete's age when they reviewed. */
const reviewerContext = (age: number | null | undefined) => {
  if (age == null || !Number.isFinite(age)) return "";
  return age >= 18 ? "Athlete, 18+" : `Parent of a U${age + 1} athlete`;
};

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const ReviewRow = ({ review, first }: { review: Review; first: string }) => {
  const name = shortName(review.reviewer_name);
  const line = [reviewerContext(review.athlete_age), shortDate(review.created_at)].filter(Boolean).join(" · ");
  return (
    <div className="flex flex-col gap-2.5 py-[14px]">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#F1F1E6] text-[12px] font-medium text-[#484D56]">
            {initialsOf(name)}
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className={cn(medium, "truncate")}>{name}</span>
            <span className={caption}>{line}</span>
          </span>
        </span>
        <Stars value={review.rating} size={12} />
      </div>
      {review.review_text ? (
        <p className="text-[14px] leading-[20px] tracking-[-0.03em] text-[#484D56]">{review.review_text}</p>
      ) : null}
      {review.coach_reply?.trim() ? (
        <div className="flex flex-col gap-1.5 rounded-[8px] bg-[#F4F4EB] px-3 py-2.5">
          <span className={lbl}>Reply from {first}</span>
          <span className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#1A202C]">{review.coach_reply}</span>
        </div>
      ) : null}
    </div>
  );
};

/** Reviews (Working Copy `.sp2-rv`, `.sp2-reply`): two reviews, then "See all N reviews". */
export const ReviewsCard = ({
  first,
  reviews,
  rating,
  totalReviews,
  showRating,
}: {
  first: string;
  reviews: Review[];
  rating: number;
  totalReviews: number;
  showRating: boolean;
}) => {
  const [all, setAll] = useState(false);
  const count = Math.max(totalReviews, reviews.length);
  const shown = all ? reviews : reviews.slice(0, 2);

  return (
    <CoachProfileCard id={REVIEWS_ANCHOR} className={cn(cardGap, "scroll-mt-24")} aria-label="Reviews">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={sectionTitle}>Reviews</h2>
        {showRating ? (
          <span className="flex items-center gap-1.5">
            <Stars value={rating} size={13} />
            <b className={medium}>{rating.toFixed(1)}</b>
            <span className={caption}>· {plural(count, "review")}</span>
          </span>
        ) : null}
      </div>
      {shown.length ? (
        <div className="flex flex-col divide-y divide-[#EAEADF]">
          {shown.map((review) => (
            <ReviewRow key={review.id} review={review} first={first} />
          ))}
        </div>
      ) : (
        <p className={caption}>Written reviews show here once families leave them.</p>
      )}
      {reviews.length > 2 ? (
        <button type="button" onClick={() => setAll((v) => !v)} className={cn(secondaryButton, smallButton, "self-start")}>
          {all ? "Show fewer" : `See all ${plural(count, "review")}`}
        </button>
      ) : null}
    </CoachProfileCard>
  );
};
