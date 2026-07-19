import { useState, useEffect, useCallback, useRef } from "react";
import { reviewsAPI } from "@/api";
import { useToast } from "@/hooks/use-toast";

export interface Review {
  id: string;
  coach_id: string;
  rating: number;
  review_text?: string;
  created_at: string;
  reviewer_name?: string;
}

// Cache for reviews to prevent duplicate fetches
const reviewsCache = new Map<string, {
  reviews: Review[];
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
}>();

// Export function to clear cache
export const clearReviewsCache = () => {
  reviewsCache.clear();
};

export const useReviews = (coachId: string | undefined) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [averageRating, setAverageRating] = useState<number>(0);
  const [totalReviews, setTotalReviews] = useState<number>(0);
  const [ratingDistribution, setRatingDistribution] = useState<Record<number, number>>({
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0
  });
  const { toast } = useToast();

  const fetchReviews = useCallback(async () => {
    if (!coachId) return;

    // Check cache first
    const cached = reviewsCache.get(coachId);
    if (cached) {
      setReviews(cached.reviews);
      setAverageRating(cached.averageRating);
      setTotalReviews(cached.totalReviews || cached.reviews.length || 0);
      setRatingDistribution(cached.ratingDistribution);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const statsResponse = await reviewsAPI.getCoachRatingStats(coachId);

      const fallbackDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      let averageRatingValue = 0;
      let distributionValue = fallbackDistribution;
      let totalReviewsValue = 0;

      if (!statsResponse.error && statsResponse.data) {
        averageRatingValue = statsResponse.data.averageRating ?? 0;
        distributionValue = statsResponse.data.distribution as typeof fallbackDistribution;
        totalReviewsValue = statsResponse.data.totalReviews ?? 0;
      } else {
        // If stats RPC fails, leave defaults
        console.warn('Falling back to empty stats due to RPC error');
      }

      setReviews([]); // No direct comments fetched
      setAverageRating(averageRatingValue);
      setTotalReviews(totalReviewsValue);
      setRatingDistribution(distributionValue);

      reviewsCache.set(coachId, {
        reviews: [],
        averageRating: averageRatingValue,
        totalReviews: totalReviewsValue,
        ratingDistribution: distributionValue,
      });
    } catch (error) {
      console.error('Error fetching reviews:', error);
      toast({
        title: "Error",
        description: "Failed to load reviews",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [coachId, toast]);

  useEffect(() => {
    if (!coachId) {
      setLoading(false);
      return;
    }

    fetchReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachId]);

  // Reviews are derived from slot_feedback_v2; direct submissions are not supported here.
  const submitReview = async () => ({
    error: new Error("Submitting reviews here is disabled; feedback is collected through session feedback."),
  });

  return {
    reviews,
    loading,
    averageRating,
    totalReviews,
    ratingDistribution,
    submitReview,
    refreshReviews: fetchReviews
  };
};
