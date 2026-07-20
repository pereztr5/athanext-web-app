import { apiClient, type ApiResponse } from "@/api/client";
import type { Database } from "@/integrations/supabase/types";

export type AthleteProfile = Database["public"]["Tables"]["athlete_profiles"]["Row"];
export type AthleteProfileInsert = Database["public"]["Tables"]["athlete_profiles"]["Insert"];
export type AthleteProfileUpdate = Database["public"]["Tables"]["athlete_profiles"]["Update"];

export const athleteProfilesAPI = {
  /**
   * Create athlete profile
   * @param payload - Athlete profile payload
   * @returns ApiResponse with created athlete profile
   */
  async createAthleteProfile(
    payload: AthleteProfileInsert
  ): Promise<ApiResponse<AthleteProfile>> {
    return apiClient.mutate<AthleteProfile>(
      async (client) =>
        client
          .from("athlete_profiles")
          .insert(payload)
          .select()
          .single(),
      "Create athlete profile"
    );
  },

  /**
   * Update athlete profile
   * @param athleteId - Athlete profile id
   * @param updates - Athlete profile updates
   * @returns ApiResponse with updated athlete profile
   */
  async updateAthleteProfile(
    athleteId: string,
    updates: AthleteProfileUpdate
  ): Promise<ApiResponse<AthleteProfile>> {
    return apiClient.mutate<AthleteProfile>(
      async (client) =>
        client
          .from("athlete_profiles")
          .update(updates)
          .eq("id", athleteId)
          .select()
          .single(),
      `Update athlete profile: ${athleteId}`
    );
  },
};
