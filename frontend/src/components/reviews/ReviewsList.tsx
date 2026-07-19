import { Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Review } from "@/hooks/useReviews";
import { colors } from "@/config/colors";
import { strings } from "@/config/strings";

interface ReviewsListProps {
  reviews: Review[];
  loading: boolean;
  averageRating: number;
  totalReviews?: number;
}

export const ReviewsList = ({ reviews, loading, averageRating, totalReviews }: ReviewsListProps) => {
  const reviewCount = totalReviews ?? reviews.length;

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Star className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">{strings.reviews.noReviews}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Be the first to review this coach!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Average Rating Summary */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-foreground">
                {averageRating.toFixed(1)}
              </div>
              <div className="flex gap-1 mt-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className="h-4 w-4"
                    style={{
                      fill: star <= Math.round(averageRating) ? colors.status.warning : colors.neutral.border,
                      color: star <= Math.round(averageRating) ? colors.status.warning : colors.neutral.border,
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="text-muted-foreground">
              <div className="text-sm">Based on {reviewCount} review{reviewCount !== 1 ? 's' : ''}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Reviews */}
      <div className="space-y-4">
        {reviews.map((review) => (
          <Card key={review.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold text-foreground">
                    {review.reviewer_name || 'Anonymous'}
                  </div>
                  <div className="flex gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className="h-4 w-4"
                        style={{
                          fill: star <= review.rating ? colors.status.warning : colors.neutral.border,
                          color: star <= review.rating ? colors.status.warning : colors.neutral.border,
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {new Date(review.created_at).toLocaleDateString()}
                </div>
              </div>
              {review.review_text && (
                <p className="text-muted-foreground">{review.review_text}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
