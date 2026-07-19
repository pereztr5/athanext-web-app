import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CoachAvailabilityWithOccurrences } from '@/types/availabilityWithOccurrences';

const QUERY_KEY = (coachId: string) => ['coach-availability', coachId];

export const useCoachAvailabilityWithOccurrences = (coachId: string | null) => {
  return useQuery({
    queryKey: QUERY_KEY(coachId || ''),
    enabled: !!coachId,
    queryFn: async (): Promise<CoachAvailabilityWithOccurrences[] | null> => {
      if (!coachId) return null;
      const { data, error } = await supabase.rpc('get_coach_availability' as any, {
        coach_id_param: coachId,
      });
      if (error) {
        console.error('Error fetching availability:', error);
        throw new Error(error.message);
      }
      return (data || []) as CoachAvailabilityWithOccurrences[];
    },
  });
};

export default useCoachAvailabilityWithOccurrences;
