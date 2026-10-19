import { BrandStar } from "@/components/brand";

interface RatingBreakdownProps {
  averageRating: number;
  totalReviews: number;
  distribution: Record<number, number>;
}

const STAR_ROWS = [5, 4, 3, 2, 1] as const;

/** Brand-kit rating summary: score + stars + count on the left, 5-row distribution bars on the right. */
export const RatingBreakdown = ({ averageRating, totalReviews, distribution }: RatingBreakdownProps) => {
  const hasReviews = totalReviews > 0;
  const displayRating = hasReviews ? averageRating : 0;
  const filledStars = Math.round(displayRating);
  const scoreLabel = displayRating.toFixed(1);

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-stat tabular-nums text-dark">{scoreLabel}</span>
        <span className="flex gap-[2px]" role="img" aria-label={`Rated ${scoreLabel} out of 5`}>
          {[1, 2, 3, 4, 5].map((star) => (
            <BrandStar key={star} size={12} filled={star <= filledStars} />
          ))}
        </span>
        <span className="text-caption text-dark-300">
          {totalReviews} {totalReviews === 1 ? "review" : "reviews"}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {STAR_ROWS.map((stars) => {
          const count = distribution[stars] || 0;
          const percentage = totalReviews > 0 ? Math.min(100, (count / totalReviews) * 100) : 0;
          return (
            <div key={stars} className="flex items-center gap-[10px]">
              <span className="w-[44px] shrink-0 text-label-xsm text-dark-300">
                {stars} {stars === 1 ? "star" : "stars"}
              </span>
              <span
                className="h-[5px] min-w-0 flex-1 overflow-hidden rounded-card bg-light-550"
                role="img"
                aria-label={`${count} of ${totalReviews} reviews gave ${stars} ${stars === 1 ? "star" : "stars"}`}
              >
                <span className="block h-full rounded-card bg-primary" style={{ width: `${percentage}%` }} />
              </span>
              <span className="w-5 shrink-0 text-right text-caption text-dark-300">
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
