import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SlotOccurrence } from '@/types/availabilityWithOccurrences';

const QUERY_KEY = (availabilityId: string) => ['occurrences', availabilityId];

export const useOccurrencesV3 = (availabilityId: string | null) => {
  return useQuery({
    queryKey: QUERY_KEY(availabilityId || ''),
    enabled: !!availabilityId,
    queryFn: async (): Promise<SlotOccurrence[]> => {
      if (!availabilityId) return [];
      const { data, error } = await supabase
        .from('coach_availability_slot_occurrences' as any)
        .select('*')
        .eq('availability_id', availabilityId);
      if (error) {
        throw new Error(error.message);
      }
      return ((data as any) || []) as SlotOccurrence[];
    },
  });
};

export const useUpsertOccurrencesV3 = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { availabilityId: string; slots: any[] }) => {
      const { data, error } = await supabase.rpc('upsert_occurrences' as any, {
        p_availability_id: payload.availabilityId,
        p_slots: payload.slots,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['occurrences', variables.availabilityId] });
      queryClient.invalidateQueries({ queryKey: ['coach-availability'] });
    },
  });
};

export const useUpsertOccurrencesEditV3 = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { availabilityId: string; slots: any[] }) => {
      const { data, error } = await supabase.rpc('upsert_occurrences_edit' as any, {
        p_availability_id: payload.availabilityId,
        p_slots: payload.slots,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['occurrences', variables.availabilityId] });
      queryClient.invalidateQueries({ queryKey: ['coach-availability'] });
    },
  });
};

export default useOccurrencesV3;
