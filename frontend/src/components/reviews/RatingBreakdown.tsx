import { Star } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { colors } from "@/config/colors";

interface RatingBreakdownProps {
  averageRating: number;
  totalReviews: number;
  distribution: Record<number, number>;
}

export const RatingBreakdown = ({ averageRating, totalReviews, distribution }: RatingBreakdownProps) => {
  const hasReviews = totalReviews > 0;
  const displayRating = hasReviews ? averageRating : 0;
  const displayTotal = totalReviews;
  const displayDistribution = distribution;

  return (
    <div className="space-y-4">
      {/* Average Rating Display */}
      <div className="flex items-center gap-6">
        <div>
          <div className="text-5xl font-bold">
            {averageRating.toFixed(1)} <span className="text-3xl text-muted-foreground">({totalReviews} reviews)</span>
          </div>
          <div className="flex items-center gap-1 mt-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-4 w-4`}
                style={{
                  fill: star <= Math.round(displayRating) ? colors.status.warning : colors.neutral.border,
                  color: star <= Math.round(displayRating) ? colors.status.warning : colors.neutral.border,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Rating Distribution Bars */}
      <div className="space-y-2">
        {[5, 4, 3, 2, 1].map((rating) => {
          const count = displayDistribution[rating] || 0;
          const percentage = displayTotal > 0 ? (count / displayTotal) * 100 : 0;

          return (
            <div key={rating} className="flex items-center gap-3">
              <div className="flex items-center gap-1 w-20">
                <span className="text-sm font-medium">{rating} stars</span>
              </div>
              <div className="flex-1">
                <Progress 
                  value={percentage} 
                  className="h-2"
                />
              </div>
              <span className="text-sm text-muted-foreground w-12 text-right">
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
