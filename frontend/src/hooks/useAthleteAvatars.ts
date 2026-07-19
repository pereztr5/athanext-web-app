/**
 * Hook to fetch athlete avatars by their IDs
 * Queries the athlete_profiles table for profile_image_url
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AthleteAvatarMap = Record<string, string | null>;

/**
 * Fetch athlete avatars for the given athlete IDs
 * Returns a map of athlete_id -> profile_image_url
 */
export const useAthleteAvatars = (athleteIds: string[] | undefined) => {
  return useQuery<AthleteAvatarMap>({
    queryKey: ['athlete-avatars', athleteIds?.join(',')],
    queryFn: async () => {
      if (!athleteIds || athleteIds.length === 0) {
        return {};
      }

      const { data, error } = await supabase
        .from('athlete_profiles')
        .select('id, profile_image_url')
        .in('id', athleteIds);

      if (error) {
        console.error('Error fetching athlete avatars:', error);
        return {};
      }

      // Build map of athlete_id -> profile_image_url
      const avatarMap: AthleteAvatarMap = {};
      data?.forEach((profile) => {
        avatarMap[profile.id] = profile.profile_image_url;
      });

      return avatarMap;
    },
    enabled: !!athleteIds && athleteIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Fetch athlete avatars by their full names.
 * Useful when session data does not include athlete IDs.
 */
export const useAthleteAvatarsByNames = (athleteNames: string[] | undefined) => {
  return useQuery<Record<string, string | null>>({
    queryKey: ['athlete-avatars-by-name', athleteNames?.join(',')],
    queryFn: async () => {
      if (!athleteNames || athleteNames.length === 0) {
        return {};
      }

      const { data, error } = await supabase
        .from('athlete_profiles')
        .select('full_name, profile_image_url')
        .in('full_name', athleteNames);

      if (error) {
        console.error('Error fetching athlete avatars by names:', error);
        return {};
      }

      const byName: Record<string, string | null> = {};
      data?.forEach((row: { full_name: string; profile_image_url: string | null }) => {
        byName[row.full_name] = row.profile_image_url;
      });
      return byName;
    },
    enabled: !!athleteNames && athleteNames.length > 0,
    staleTime: 1000 * 60 * 5,
  });
};
