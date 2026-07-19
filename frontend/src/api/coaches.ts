/**
 * Coaches API Endpoints
 * Centralized API calls for all coach-related operations
 */

import { apiClient, type ApiResponse } from '@/api/client';
import type { Database } from '@/integrations/supabase/types';

// Public coach type (without email for privacy)
// Extend table row omission to optionally include fields exposed via RPC (e.g., is_verified)
export type PublicCoach = Omit<Database['public']['Tables']['coaches']['Row'], "email"> & {
  is_verified?: boolean;
  position?: string | null;
  sport?: string | null;
};
export type CoachInsert = Database['public']['Tables']['coaches']['Insert'];
export type CoachUpdate = Database['public']['Tables']['coaches']['Update'];

/**
 * Fetch all public coaches
 * Uses secure RPC function to exclude sensitive data
 */
export const coachesAPI = {
  /**
   * Get all coaches for public view (secure RPC call)
   */
  async getPublicCoaches(): Promise<ApiResponse<PublicCoach[]>> {
    return apiClient.rpc('get_coaches_public', undefined, 'Fetch public coaches');
  },

  /**
   * Get coach by ID
   */
  async getCoachById(coachId: string): Promise<ApiResponse<PublicCoach | null>> {
    const response = await apiClient.rpc<PublicCoach[]>('get_coaches_public', undefined, `Fetch coach by ID: ${coachId}`);
    
    if (response.error || !response.data) {
      return {
        data: null,
        error: response.error,
      };
    }

    const coach = response.data.find(c => c.id === coachId) || null;
    return {
      data: coach,
      error: response.error ? response.error : null,
    };
  },

  /**
   * Get coach count (admin use)
   */
  async getCoachCount(): Promise<ApiResponse<number>> {
    const response = await apiClient.rpc<Array<{ count: number }>>(
      'get_coach_count',
      undefined,
      'Get total coach count'
    );

    if (response.error || !response.data) {
      return {
        data: 0,
        error: response.error,
      };
    }

    return {
      data: response.data.length,
      error: null,
    };
  },

  /**
   * Update coach profile
   * @param coachId - Coach ID to update
   * @param updates - Coach profile updates
   * @returns ApiResponse with updated coach profile
   */
  async updateCoach(
    coachId: string,
    updates: CoachUpdate
  ): Promise<ApiResponse<PublicCoach>> {
    return apiClient.mutate<PublicCoach>(
      async (client) => client
        .from('coaches')
        .update(updates)
        .eq('id', coachId)
        .select()
        .single(),
      `Update coach profile: ${coachId}`
    );
  },

  /**
   * Create coach profile
   * @param payload - Coach profile payload
   * @returns ApiResponse with created coach profile
   */
  async createCoach(payload: CoachInsert): Promise<ApiResponse<PublicCoach>> {
    return apiClient.mutate<PublicCoach>(
      async (client) =>
        client
          .from('coaches')
          .insert(payload)
          .select()
          .single(),
      "Create coach profile"
    );
  },
};
