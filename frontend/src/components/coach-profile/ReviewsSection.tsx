import { ReviewsCard } from "@/components/reviews/ReviewsCard";
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
  /** @deprecated no longer used by the brand-kit card */
  iconColor: string;
  /**
   * Not wired to the card yet: the review flows behind it don't submit
   * (CoachProfile's submitReview throws), so "Write a review" stays hidden.
   */
  onLeaveReview: () => void;
  publicDisplay?: boolean;
}

export function ReviewsSection({
  averageRating,
  totalReviews,
  distribution,
  reviews,
  publicDisplay = false,
}: ReviewsSectionProps) {
  const showRating = !publicDisplay || isPublicCoachRatingVisible(totalReviews, averageRating);

  return (
    <ReviewsCard
      averageRating={averageRating}
      totalReviews={totalReviews}
      distribution={distribution}
      reviews={reviews}
      showRating={showRating}
    />
  );
}
