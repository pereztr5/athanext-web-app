import { apiClient, type ApiResponse } from '@/api/client';

export type AthleteProfileStats = {
  sessions_completed: number;
  hours_trained: number;
  coaches_worked_with: number;
  average_rating: number;
};

const EMPTY_STATS: AthleteProfileStats = {
  sessions_completed: 0,
  hours_trained: 0,
  coaches_worked_with: 0,
  average_rating: 0,
};

/**
 * Fetch athlete profile stats via Supabase RPC
 */
export const athletesAPI = {
  async getProfileStats(athleteId: string): Promise<ApiResponse<AthleteProfileStats>> {
    const { data, error } = await apiClient.rpc<AthleteProfileStats | AthleteProfileStats[]>(
      'get_athlete_profile_stats',
      { p_athlete_id: athleteId },
      'get_athlete_profile_stats'
    );

    if (error) {
      return { data: null, error };
    }

    const row = Array.isArray(data) ? data?.[0] : data;

    return {
      data: {
        sessions_completed: Number(row?.sessions_completed ?? EMPTY_STATS.sessions_completed),
        hours_trained: Number(row?.hours_trained ?? EMPTY_STATS.hours_trained),
        coaches_worked_with: Number(row?.coaches_worked_with ?? EMPTY_STATS.coaches_worked_with),
        average_rating: Number(row?.average_rating ?? EMPTY_STATS.average_rating),
      },
      error: null,
    };
  },
};
