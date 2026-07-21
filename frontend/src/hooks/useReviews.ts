import { useQuery } from "@tanstack/react-query";
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

type RatingDistribution = Record<number, number>;

interface ReviewsResult {
  reviews: Review[];
  averageRating: number;
  totalReviews: number;
  ratingDistribution: RatingDistribution;
}

const EMPTY_DISTRIBUTION: RatingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

export const useReviews = (coachId: string | undefined) => {
  const { toast } = useToast();

  const query = useQuery<ReviewsResult>({
    queryKey: ["reviews", coachId],
    queryFn: async () => {
      const fallback: ReviewsResult = {
        reviews: [],
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: EMPTY_DISTRIBUTION,
      };

      try {
        const statsResponse = await reviewsAPI.getCoachRatingStats(coachId as string);

        if (!statsResponse.error && statsResponse.data) {
          return {
            reviews: [], // No direct comments fetched
            averageRating: statsResponse.data.averageRating ?? 0,
            totalReviews: statsResponse.data.totalReviews ?? 0,
            ratingDistribution: (statsResponse.data.distribution as RatingDistribution) ?? EMPTY_DISTRIBUTION,
          };
        }

        // If stats RPC fails, leave defaults
        console.warn('Falling back to empty stats due to RPC error');
        return fallback;
      } catch (error) {
        console.error('Error fetching reviews:', error);
        toast({
          title: "Error",
          description: "Failed to load reviews",
          variant: "destructive",
        });
        return fallback;
      }
    },
    enabled: !!coachId,
    staleTime: Infinity, // Cache until explicitly invalidated (mirrors old clearReviewsCache behavior)
  });

  // Reviews are derived from slot_feedback_v2; direct submissions are not supported here.
  const submitReview = async () => ({
    error: new Error("Submitting reviews here is disabled; feedback is collected through session feedback."),
  });

  return {
    reviews: query.data?.reviews ?? [],
    loading: query.isLoading,
    averageRating: query.data?.averageRating ?? 0,
    totalReviews: query.data?.totalReviews ?? 0,
    ratingDistribution: query.data?.ratingDistribution ?? EMPTY_DISTRIBUTION,
    submitReview,
    refreshReviews: query.refetch,
  };
};
