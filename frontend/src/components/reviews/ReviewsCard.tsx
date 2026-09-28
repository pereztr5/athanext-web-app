import { Fragment } from "react";
import { BrandPill, BrandStar } from "@/components/brand";
import { CoachProfileCard } from "@/components/coach-profile/CoachProfileCard";
import { RatingBreakdown } from "./RatingBreakdown";
import { cn } from "@/lib/utils";

export interface ReviewsCardReview {
  id: string;
  rating?: number | null;
  review_text?: string | null;
  created_at?: string | null;
  reviewer_name?: string | null;
}

interface ReviewsCardProps {
  averageRating: number;
  totalReviews: number;
  distribution: Record<number, number>;
  reviews: ReviewsCardReview[];
  /** False while the coach is below the public rating threshold. */
  showRating: boolean;
  /** Only pass a handler that actually submits a review; the link is hidden otherwise. */
  onWriteReview?: () => void;
  className?: string;
}

const MAX_LISTED_REVIEWS = 5;

const AVATAR_TINTS = ["bg-[#E5EDF7] text-[#0054B4]", "bg-[#E7F4F8] text-[#1599BC]"];

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "A";

const formatReviewDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
};

const mutedLine = "text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]";

/** Brand-kit reviews card shared by every coach-profile reviews surface. */
export function ReviewsCard({
  averageRating,
  totalReviews,
  distribution,
  reviews,
  showRating,
  onWriteReview,
  className,
}: ReviewsCardProps) {
  const hasRatings = showRating && totalReviews > 0;
  const listed = hasRatings
    ? reviews.filter((review) => review.review_text?.trim()).slice(0, MAX_LISTED_REVIEWS)
    : [];

  return (
    <CoachProfileCard className={className}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[20px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]">Reviews</h2>
          {hasRatings ? <BrandPill tone="neutral">{totalReviews}</BrandPill> : null}
        </div>
        {onWriteReview ? (
          <button
            type="button"
            onClick={onWriteReview}
            className="text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#0054B4] hover:text-[#004390]"
          >
            Write a review
          </button>
        ) : null}
      </div>

      {!showRating ? (
        <p className={mutedLine}>Ratings and comments appear after 3 athlete reviews.</p>
      ) : totalReviews === 0 ? (
        <p className={mutedLine}>No ratings submitted yet.</p>
      ) : (
        <>
          <RatingBreakdown averageRating={averageRating} totalReviews={totalReviews} distribution={distribution} />
          {listed.map((review, index) => {
            const name = review.reviewer_name?.trim() || "Athlete";
            const rating = typeof review.rating === "number" ? Math.round(review.rating) : 0;
            const date = formatReviewDate(review.created_at);
            return (
              <Fragment key={review.id}>
                <div className="h-px w-full bg-[#EAEADF]" />
                <div className="flex flex-col gap-[10px]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-[10px]">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-medium",
                          AVATAR_TINTS[index % AVATAR_TINTS.length],
                        )}
                      >
                        {getInitials(name)}
                      </span>
                      <span className="min-w-0 truncate text-[16px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]">
                        {name}
                      </span>
                      {rating > 0 ? (
                        <span className="flex gap-[2px]" role="img" aria-label={`Rated ${rating} out of 5`}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <BrandStar key={star} size={12} filled={star <= rating} />
                          ))}
                        </span>
                      ) : null}
                    </div>
                    {date ? (
                      <span className="shrink-0 text-[12px] leading-[14px] tracking-[-0.03em] text-[#A3A6AB]">
                        {date}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#484D56] [text-wrap:pretty]">
                    {review.review_text}
                  </p>
                </div>
              </Fragment>
            );
          })}
        </>
      )}
    </CoachProfileCard>
  );
}
