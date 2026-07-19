import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QUERY_KEYS } from '@/utils/db';

export interface UpsertOverridePayload {
  slot_id: string;
  override_date: string; // YYYY-MM-DD
  session_name?: string | null;
  price?: number | null;
  duration_minutes?: number | null;
  start_time?: string | null; // HH:mm
  end_time?: string | null; // HH:mm
  session_type?: 'individual' | 'group' | null;
  location?: 'online' | 'in-person' | null;
  pillar_slot?: string | null;
  is_enabled?: boolean | null;
}

export function useUpsertSlotOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpsertOverridePayload) => {
      const { data, error } = await supabase
        .from('coach_availability_slot_overrides' as any)
        .upsert(payload, { onConflict: 'slot_id,override_date' })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate all related queries to refresh data
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.WEEKLY_AVAILABILITY_RESOLVED });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PERIOD_WITH_OVERRIDES });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COACH_AVAILABILITY });
    },
  });
}

export function useDeleteSlotOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ slot_id, override_date }: { slot_id: string; override_date: string }) => {
      const { error } = await supabase
        .from('coach_availability_slot_overrides' as any)
        .delete()
        .eq('slot_id', slot_id)
        .eq('override_date', override_date);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      // Invalidate all related queries to refresh data
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.WEEKLY_AVAILABILITY_RESOLVED });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PERIOD_WITH_OVERRIDES });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COACH_AVAILABILITY });
    },
  });
}
