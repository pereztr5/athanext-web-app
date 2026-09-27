export const PUBLIC_COACH_RATING_MINIMUM = 3;

export const isPublicCoachRatingVisible = (
  totalReviews: number | null | undefined,
  rating?: number | null
) => {
  return (totalReviews ?? 0) >= PUBLIC_COACH_RATING_MINIMUM && (rating ?? 0) > 0;
};

export const publicCoachRatingLabel = (
  rating: number | null | undefined,
  totalReviews?: number | null
) => {
  if (!isPublicCoachRatingVisible(totalReviews, rating) || typeof rating !== "number") {
    return "New";
  }
  return rating.toFixed(1);
};
