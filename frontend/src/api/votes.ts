/**
 * Votes/Polls API Endpoints
 * Handles sports voting and poll interactions
 */

import { apiClient, type ApiResponse } from '@/api/client';

export interface Vote {
  id: string;
  user_id: string;
  sport: string;
  timestamp: string;
}

export interface VoteStats {
  sport: string;
  count: number;
  percentage: number;
}

export interface SubmitVoteInput {
  sportOptionId: string;
}

export const votesAPI = {
  /**
   * Submit a sports vote
   * @param data - Vote data including sport selection
   * @returns ApiResponse with submitted vote
   */
  async submitVote(data: SubmitVoteInput): Promise<ApiResponse<Vote>> {
    return apiClient.invoke(
      'submit-sports-vote',
      data as unknown as Record<string, unknown>,
      'Submit sports vote'
    );
  },

  /**
   * Check if user already voted
   * @returns ApiResponse with boolean indicating vote status
   */
  async hasUserVoted(): Promise<ApiResponse<boolean>> {
    const user = await apiClient.getSupabaseClient().auth.getUser();
    
    if (!user.data.user) {
      return {
        data: false,
        error: null,
      };
    }

    const response = await apiClient.query<Vote[]>(
      async (client) => client
        .from('sports_votes')
        .select('id')
        .eq('user_id', user.data.user!.id)
        .limit(1),
      'Check if user voted'
    );

    return {
      data: response.error ? false : (response.data?.length ?? 0) > 0,
      error: response.error,
    };
  },

  /**
   * Get user's vote
   * @returns ApiResponse with user's current vote
   */
  async getUserVote(): Promise<ApiResponse<Vote | null>> {
    const user = await apiClient.getSupabaseClient().auth.getUser();
    
    if (!user.data.user) {
      return {
        data: null,
        error: {
          code: 'AUTH_ERROR',
          message: 'User not authenticated',
          status: 401,
        },
      };
    }

    return apiClient.query(
      async (client) => client
        .from('sports_votes')
        .select('*')
        .eq('user_id', user.data.user!.id)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single(),
      'Fetch user vote'
    );
  },

  /**
   * Get all votes for a sport
   * @param sport - Sport name to filter votes
   * @returns ApiResponse with votes for specified sport
   */
  async getVotesForSport(sport: string): Promise<ApiResponse<Vote[]>> {
    return apiClient.query(
      async (client) => client
        .from('sports_votes')
        .select('*')
        .eq('sport', sport)
        .order('timestamp', { ascending: false }),
      `Fetch votes for sport: ${sport}`
    );
  },

  /**
   * Delete user's vote
   * @returns ApiResponse with deletion result
   */
  async deleteVote(): Promise<ApiResponse<null>> {
    const user = await apiClient.getSupabaseClient().auth.getUser();
    
    if (!user.data.user) {
      return {
        data: null,
        error: {
          code: 'AUTH_ERROR',
          message: 'User not authenticated',
          status: 401,
        },
      };
    }

    return apiClient.mutate(
      async (client) => client
        .from('sports_votes')
        .delete()
        .eq('user_id', user.data.user!.id),
      'Delete user vote'
    );
  },
};
