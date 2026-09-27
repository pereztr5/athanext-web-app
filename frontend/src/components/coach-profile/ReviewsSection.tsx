import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { RatingBreakdown } from "@/components/reviews/RatingBreakdown";
import { isPublicCoachRatingVisible } from "@/utils/publicRating";

interface Review {
  id: string;
  coach_id: string;
  rating: number;
  review_text?: string;
  created_at: string;
  reviewer_name?: string;
}

interface ReviewsSectionProps {
  averageRating: number;
  totalReviews: number;
  distribution: Record<number, number>;
  reviews: Review[];
  iconColor: string;
  onLeaveReview: () => void;
  publicDisplay?: boolean;
}

export function ReviewsSection({ 
  averageRating, 
  totalReviews,
  distribution,
  reviews,
  iconColor,
  onLeaveReview,
  publicDisplay = false,
}: ReviewsSectionProps) {
  const showPublicRating = !publicDisplay || isPublicCoachRatingVisible(totalReviews, averageRating);
  const publicReviews = showPublicRating ? reviews : [];

  if (publicDisplay && !showPublicRating) {
    return (
      <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className={`h-5 w-5 ${iconColor}`} />
            Reviews & Ratings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-5xl font-bold">New</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Ratings and comments appear after 3 athlete reviews.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Star className={`h-5 w-5 ${iconColor}`} />
            Reviews & Ratings
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <RatingBreakdown
          averageRating={averageRating}
          totalReviews={totalReviews}
          distribution={distribution}
        />

        {totalReviews === 0 && (
          <div className="mt-4 text-sm text-muted-foreground">
            No ratings submitted yet.
          </div>
        )}
        
        {/* Individual Reviews */}
        {publicReviews.length > 0 && (
          <div className="mt-6 space-y-4">
            {publicReviews.slice(0, 3).map((review) => (
              <div key={review.id} className="border-t pt-4 first:border-t-0 first:pt-0">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-primary">
                      {review.reviewer_name?.charAt(0).toUpperCase() || 'A'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">{review.reviewer_name || 'Anonymous'}</span>
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star 
                            key={i} 
                            className={`h-4 w-4 ${
                              i < review.rating 
                                ? 'fill-yellow-400 text-yellow-400' 
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    {review.review_text && (
                      <p className="text-sm text-muted-foreground">{review.review_text}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(review.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            
            {publicReviews.length > 3 && (
              <Button variant="outline" className="w-full mt-4">
                Load More Reviews
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
