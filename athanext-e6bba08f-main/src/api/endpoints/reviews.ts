/**
 * Reviews API Endpoints
 * Centralized API calls for coach reviews
 */

import { apiClient, type ApiResponse } from '@/api/client';

export interface Review {
  id: string;
  coach_id: string;
  rating: number;
  review_text?: string;
  created_at: string;
  reviewer_name?: string;
  athlete_id?: string;
}

export interface ReviewSummary {
  averageRating: number;
  totalReviews: number;
  distribution: Record<number, number>;
}

export interface SubmitReviewInput {
  coach_id: string;
  user_id: string;
  rating: number;
  review_text: string;
}

/**
 * Reviews API endpoints
 */
export const reviewsAPI = {
  /**
   * Get all reviews for a coach (public view)
   */
  async getCoachReviews(coachId: string): Promise<ApiResponse<Review[]>> {
    return apiClient.rpc(
      'get_coach_reviews_public',
      { coach_uuid: coachId },
      `Fetch reviews for coach: ${coachId}`
    );
  },

  /**
   * Get aggregated rating stats for a coach from slot_feedback
   */
  async getCoachRatingStats(coachId: string): Promise<ApiResponse<ReviewSummary>> {
    const { data, error } = await apiClient.rpc<
      | {
          average_rating: number;
          total_reviews: number;
          five_star: number;
          four_star: number;
          three_star: number;
          two_star: number;
          one_star: number;
        }
      | Array<{
          average_rating: number;
          total_reviews: number;
          five_star: number;
          four_star: number;
          three_star: number;
          two_star: number;
          one_star: number;
        }>
    >(
      'get_coach_rating_stats',
      { p_coach_id: coachId },
      `Fetch rating stats for coach: ${coachId}`
    );

    if (error) {
      return { data: null, error };
    }

    const row = Array.isArray(data) ? data?.[0] : data;

    const distribution = {
      5: Number(row?.five_star ?? 0),
      4: Number(row?.four_star ?? 0),
      3: Number(row?.three_star ?? 0),
      2: Number(row?.two_star ?? 0),
      1: Number(row?.one_star ?? 0),
    };

    return {
      data: {
        averageRating: Number(row?.average_rating ?? 0),
        totalReviews: Number(row?.total_reviews ?? 0),
        distribution,
      },
      error: null,
    };
  },

  /**
   * Submit or update a review
   */
  async submitReview(data: SubmitReviewInput): Promise<ApiResponse<Review>> {
    return apiClient.mutate(
      (client) => {
        return client
          .from('coach_reviews')
          .upsert({
            coach_id: data.coach_id,
            user_id: data.user_id,
            rating: data.rating,
            review_text: data.review_text,
          }, {
            onConflict: 'user_id,coach_id',
          })
          .select()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .single() as unknown as Promise<any>;
      },
      `Submit review for coach: ${data.coach_id}`
    );
  },

  /**
   * Delete a review
   */
  async deleteReview(reviewId: string): Promise<ApiResponse<null>> {
    return apiClient.mutate(
      (client) => {
        return client
          .from('coach_reviews')
          .delete()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .eq('id', reviewId) as unknown as Promise<any>;
      },
      `Delete review: ${reviewId}`
    );
  },

  /**
   * Get user's review for a specific coach
   */
  async getUserReview(userId: string, coachId: string): Promise<ApiResponse<Review | null>> {
    return apiClient.query(
      (client) => {
        return client
          .from('coach_reviews')
          .select('*')
          .eq('user_id', userId)
          .eq('coach_id', coachId)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .single() as unknown as Promise<any>;
      },
      `Fetch user review for coach: ${coachId}`
    );
  },
};
