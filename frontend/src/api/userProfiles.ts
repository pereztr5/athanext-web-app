/**
 * User Profiles API Endpoints
 * Centralized API calls for all user profile operations
 */

import { apiClient, type ApiResponse } from '@/api/client';
import type { Database } from '@/integrations/supabase/types';

export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type UserProfileInsert = Database['public']['Tables']['user_profiles']['Insert'];
export type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update'];

/**
 * User Profiles API
 */
export const userProfilesAPI = {
  /**
   * Get user profile by ID
   * @param userId - User ID to fetch profile for
   * @returns ApiResponse with user profile
   */
  async getUserProfile(userId: string): Promise<ApiResponse<UserProfile>> {
    return apiClient.query<UserProfile>(
      async (client) => client
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle(),
      `Fetch user profile: ${userId}`
    );
  },

  /**
   * Get user profile by email
   * @param email - User email to fetch profile for
   * @returns ApiResponse with user profile
   */
  async getUserProfileByEmail(email: string): Promise<ApiResponse<UserProfile>> {
    return apiClient.query<UserProfile>(
      async (client) => client
        .from('user_profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle(),
      `Fetch user profile by email: ${email}`
    );
  },

  /**
   * Create a new user profile
   * @param profile - User profile data
   * @returns ApiResponse with created user profile
   */
  async createUserProfile(profile: UserProfileInsert): Promise<ApiResponse<UserProfile>> {
    return apiClient.mutate<UserProfile>(
      async (client) => client
        .from('user_profiles')
        .insert(profile)
        .select()
        .single(),
      'Create user profile'
    );
  },

  /**
   * Create or update a user profile (by id conflict)
   * @param profile - User profile data
   * @returns ApiResponse with upserted user profile
   */
  async upsertUserProfile(profile: UserProfileInsert): Promise<ApiResponse<UserProfile>> {
    return apiClient.mutate<UserProfile>(
      async (client) => client
        .from('user_profiles')
        .upsert(profile, { onConflict: 'id' })
        .select()
        .single(),
      `Upsert user profile: ${profile.id ?? profile.email}`
    );
  },

  /**
   * Update user profile
   * @param userId - User ID to update
   * @param updates - Profile updates
   * @returns ApiResponse with updated user profile
   */
  async updateUserProfile(
    userId: string,
    updates: UserProfileUpdate
  ): Promise<ApiResponse<UserProfile>> {
    return apiClient.mutate<UserProfile>(
      async (client) => client
        .from('user_profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single(),
      `Update user profile: ${userId}`
    );
  },

  /**
   * Delete user profile
   * @param userId - User ID to delete
   * @returns ApiResponse
   */
  async deleteUserProfile(userId: string): Promise<ApiResponse<void>> {
    const response = await apiClient.mutate<UserProfile>(
      async (client) => client
        .from('user_profiles')
        .delete()
        .eq('id', userId),
      `Delete user profile: ${userId}`
    );

    return {
      data: undefined,
      error: response.error,
    };
  },

  /**
   * Get all user profiles (admin only)
   * @returns ApiResponse with all user profiles
   */
  async getAllUserProfiles(): Promise<ApiResponse<UserProfile[]>> {
    return apiClient.query<UserProfile[]>(
      async (client) => client
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false }),
      'Fetch all user profiles'
    );
  },

  /**
   * Get user profiles by persona type
   * @param personaType - Persona type to filter by (coach, athlete, etc.)
   * @returns ApiResponse with filtered user profiles
   */
  async getUserProfilesByPersonaType(personaType: string): Promise<ApiResponse<UserProfile[]>> {
    return apiClient.query<UserProfile[]>(
      async (client) => client
        .from('user_profiles')
        .select('*')
        .eq('persona_type', personaType)
        .order('created_at', { ascending: false }),
      `Fetch user profiles by persona type: ${personaType}`
    );
  },
};
