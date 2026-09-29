import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const QUERY_KEY = (availabilityId: string) => ['locked-occurrence-ids', availabilityId] as const;
const LOCKED_BOOKING_STATUSES = ['requested', 'pending_payment', 'booked'] as const;

export const useLockedOccurrenceIds = (
  availabilityId: string | null,
  enabled: boolean = true
) => {
  const query = useQuery({
    queryKey: QUERY_KEY(availabilityId || ''),
    enabled: enabled && !!availabilityId,
    retry: false,
    queryFn: async (): Promise<string[]> => {
      if (!availabilityId) return [];

      const { data, error } = await supabase
        .from('coach_slot_bookings' as any)
        .select('occurrence_id')
        .eq('availability_id', availabilityId)
        .in('status', LOCKED_BOOKING_STATUSES as unknown as string[]);

      if (error) {
        console.error('Failed to load booked/reserved slots for locking', error);
        return [];
      }

      const ids = (((data as any[] | null) || [])
        .map((row: any) => row?.occurrence_id)
        .filter((id: any): id is string => Boolean(id)));

      return ids;
    },
  });

  const lockedOccurrenceIds = useMemo(
    () => new Set<string>(query.data || []),
    [query.data]
  );

  return {
    ...query,
    lockedOccurrenceIds,
  };
};

export default useLockedOccurrenceIds;
