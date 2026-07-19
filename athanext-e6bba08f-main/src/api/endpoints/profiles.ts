/**
 * Profiles API Endpoints
 * Centralized API calls for user profile operations
 */

import { apiClient, type ApiResponse } from "@/api/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type UserProfile = Tables<"user_profiles">;
export type UserProfileUpsert = TablesInsert<"user_profiles">;

export const profilesAPI = {
  /**
   * Fetch a user profile by user id
   */
  async getProfileById(userId: string): Promise<ApiResponse<UserProfile | null>> {
    return apiClient.query(
      async (client) =>
        client
          .from("user_profiles")
          .select("id, email, name, persona_type, phone_number, sport, position, date_of_birth, instagram_handle, website, coach_id, athlete_id, created_at, updated_at, is_profile_completed")
          .eq("id", userId)
          .maybeSingle(),
      `Fetch profile for user: ${userId}`
    );
  },

  /**
   * Create or update a user profile
   */
  async upsertProfile(profile: UserProfileUpsert): Promise<ApiResponse<UserProfile>> {
    return apiClient.mutate(
      async (client) =>
        client
          .from("user_profiles")
          .upsert(profile)
          .select()
          .single(),
      `Upsert profile for user: ${profile.id ?? profile.email}`
    );
  },
};
