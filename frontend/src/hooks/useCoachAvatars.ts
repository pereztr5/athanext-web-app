/**
 * Hook to fetch coach avatars by coach IDs
 * Queries coaches table for profile_image_url with image_url fallback.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type CoachAvatarMap = Record<string, string | null>;

export const useCoachAvatarsByIds = (coachIds: string[] | undefined) => {
  return useQuery<CoachAvatarMap>({
    queryKey: ['coach-avatars-by-id', coachIds?.join(',')],
    queryFn: async () => {
      if (!coachIds || coachIds.length === 0) {
        return {};
      }

      const { data, error } = await supabase
        .from('coaches')
        .select('id, profile_image_url, image_url')
        .in('id', coachIds);

      if (error) {
        console.error('Error fetching coach avatars by ids:', error);
        return {};
      }

      const byId: CoachAvatarMap = {};
      data?.forEach((row: { id: string; profile_image_url: string | null; image_url: string | null }) => {
        byId[row.id] = row.profile_image_url || row.image_url || null;
      });

      return byId;
    },
    enabled: !!coachIds && coachIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });
};

