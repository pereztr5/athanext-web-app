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
      const periods = (data || []) as CoachAvailabilityWithOccurrences[];
      // The RPC predates ATH-28, so read the repeat flag separately (a missing column reads as off).
      const { data: flags } = await supabase
        .from('coach_availability' as any)
        .select('id, repeats_weekly')
        .eq('coach_id', coachId);
      const repeating = new Set(
        ((flags as any[] | null) || []).filter((row) => row?.repeats_weekly).map((row) => row.id)
      );
      return periods.map((period) => ({ ...period, repeats_weekly: repeating.has(period.id) }));
    },
  });
};

export default useCoachAvailabilityWithOccurrences;
