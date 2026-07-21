/**
 * useCoachAvailability Hook
 * Manages coach availability data fetching and mutations
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getWeekStart } from '@/utils/dateHelpers';
import { QUERY_KEYS as SHARED_QUERY_KEYS } from '@/utils/db';
import { fetchPeriodWithOverrides } from '@/api/availability';
import type {
  CoachAvailability,
  CoachAvailabilitySlot,
  SlotFormData,
  DayOfWeek,
} from '@/types/availability';

// Local query key builders for coach-specific queries
const QUERY_KEYS = {
  availability: (coachId: string) => ['coach-availability', coachId],
  slots: (availabilityId: string) => ['availability-slots', availabilityId],
};

interface CreateAvailabilityPayload {
  coach_id: string;
  start_date: string;
  end_date: string;
  slots: Array<SlotFormData & { day_of_week: DayOfWeek }>;
}

/**
 * Fetch coach availability with all slots
 */
export const useCoachAvailabilityList = (coachId: string | null) => {
  return useQuery({
    queryKey: QUERY_KEYS.availability(coachId || ''),
    queryFn: async () => {
      if (!coachId) return null;

      const { data, error } = await supabase.rpc('get_coach_availability_v2' as any, {
        coach_id_param: coachId,
      });

      if (error) {
        console.error('Error fetching availability:', error);
        throw new Error(error.message);
      }

      return data as CoachAvailability[];
    },
    enabled: !!coachId,
  });
};

// Legacy export for backward compatibility
export const useCoachAvailability = useCoachAvailabilityList;

/**
 * Create new availability with slots
 */
export const useCreateAvailability = () => {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  return useMutation({
    mutationFn: async (payload: CreateAvailabilityPayload) => {
      // Insert availability period
      const { data: availabilityInserted, error: availabilityError } = await supabase
        .from('coach_availability_v2' as any)
        .insert({
          coach_id: payload.coach_id,
          start_date: payload.start_date,
          end_date: payload.end_date,
        })
        .select('id')
        .single();

      if (availabilityError) {
        setError(availabilityError.message);
        throw new Error(availabilityError.message);
      }

      const availabilityId = (availabilityInserted as any).id as string;

      // Prepare slots with pillar_slot
      const slotsToInsert = payload.slots
        .filter((slot) => slot.is_enabled)
        .map((slot) => ({
          availability_id: availabilityId,
          day_of_week: slot.day_of_week,
          session_name: slot.session_name,
          price: parseFloat(slot.price.toString()),
          duration_minutes: slot.duration_minutes,
          start_time: slot.start_time,
          end_time: slot.end_time,
          session_type: slot.session_type,
          location: slot.location,
          pillar_slot: slot.pillar_slot || null,
          is_enabled: true,
        }));

      if (slotsToInsert.length > 0) {
        const { error: slotsError } = await supabase
          .from('coach_availability_slots_v2' as any)
          .insert(slotsToInsert);

        if (slotsError) {
          setError(slotsError.message);
          throw new Error(slotsError.message);
        }
      }

      return { availabilityId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.availability(variables.coach_id),
      });
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });
};

/**
 * Update complete availability period (dates and slots)
 */
export const useUpdateAvailability = () => {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  return useMutation({
    mutationFn: async (payload: CreateAvailabilityPayload & { availabilityId: string }) => {
      // Update the availability period dates
      const { error: updateError } = await supabase
        .from('coach_availability_v2' as any)
        .update({
          start_date: payload.start_date,
          end_date: payload.end_date,
        })
        .eq('id', payload.availabilityId);

      if (updateError) throw updateError;

      // Delete existing slots
      const { error: deleteError } = await supabase
        .from('coach_availability_slots_v2' as any)
        .delete()
        .eq('availability_id', payload.availabilityId);

      if (deleteError) throw deleteError;

      // Convert slots to JSONB format
      const slotsJsonb = payload.slots
        .filter((slot) => slot.is_enabled)
        .map((slot) => ({
          day_of_week: slot.day_of_week,
          session_name: slot.session_name,
          price: parseFloat(slot.price.toString()),
          duration_minutes: slot.duration_minutes,
          start_time: slot.start_time,
          end_time: slot.end_time,
          session_type: slot.session_type,
          location: slot.location,
          pillar_slot: slot.pillar_slot || null,
          is_enabled: true,
        }));

      // Insert new slots
      const { error: insertError } = await supabase
        .from('coach_availability_slots_v2' as any)
        .insert(
          slotsJsonb.map((slot) => ({
            availability_id: payload.availabilityId,
            ...slot,
          }))
        );

      if (insertError) throw insertError;

      return { availabilityId: payload.availabilityId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.availability(variables.coach_id),
      });
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });
};

/**
 * Update availability slots
 */
export const useUpdateAvailabilitySlots = () => {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  return useMutation({
    mutationFn: async ({
      availabilityId,
      slots,
    }: {
      availabilityId: string;
      slots: CoachAvailabilitySlot[];
    }) => {
      // Delete existing slots
      const { error: deleteError } = await supabase
        .from('coach_availability_slots_v2' as any)
        .delete()
        .eq('availability_id', availabilityId);

      if (deleteError) throw deleteError;

      // Insert new slots
      const { error: insertError } = await supabase
        .from('coach_availability_slots_v2' as any)
        .insert(
          slots.map((slot) => ({
            availability_id: availabilityId,
            day_of_week: slot.day_of_week,
            session_name: slot.session_name,
            price: slot.price,
            duration_minutes: slot.duration_minutes,
            start_time: slot.start_time,
            end_time: slot.end_time,
            session_type: slot.session_type,
            location: slot.location,
            pillar_slot: slot.pillar_slot || null,
            is_enabled: slot.is_enabled,
          }))
        );

      if (insertError) throw insertError;

      return availabilityId;
    },
    onSuccess: (availabilityId) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.slots(availabilityId),
      });
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });
};

/**
 * Delete availability and associated slots
 */
export const useDeleteAvailability = () => {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  return useMutation({
    mutationFn: async ({
      availabilityId,
      coachId,
    }: {
      availabilityId: string;
      coachId: string;
    }) => {
      const { error: deleteError } = await supabase
        .from('coach_availability_v2' as any)
        .delete()
        .eq('id', availabilityId);

      if (deleteError) throw deleteError;

      return { availabilityId, coachId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.availability(variables.coachId),
      });
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });
};

/**
 * Check for overlapping time slots
 */
export const useCheckSlotOverlap = () => {
  const [overlap, setOverlap] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);

  const check = useCallback(
    async (
      availabilityId: string,
      dayOfWeek: DayOfWeek,
      startTime: string,
      endTime: string,
      excludeSlotId?: string
    ) => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase.rpc('check_slot_overlap_v2' as any, {
          availability_id_param: availabilityId,
          day_of_week_param: dayOfWeek,
          start_time_param: startTime,
          end_time_param: endTime,
          exclude_slot_id: excludeSlotId,
        });

        if (error) {
          console.error('Error checking overlap:', error);
          setOverlap(false);
          return false;
        }

        setOverlap(data as boolean);
        return data;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { check, overlap, isLoading };
};

/**
 * Update individual slot
 */
export const useUpdateSlot = () => {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  return useMutation({
    mutationFn: async ({
      slotId,
      session_name,
      price,
      duration_minutes,
      start_time,
      end_time,
      session_type,
      location,
      is_enabled,
    }: {
      slotId: string;
      session_name: string;
      price: number;
      duration_minutes: number;
      start_time: string;
      end_time: string;
      session_type: 'individual' | 'group';
      location: 'online' | 'in-person';
      is_enabled: boolean;
    }) => {
      const { data, error: updateError } = await supabase
        .from('coach_availability_slots_v2' as any)
        .update({
          session_name,
          price,
          duration_minutes,
          start_time,
          end_time,
          session_type,
          location,
          is_enabled,
          updated_at: new Date().toISOString(),
        })
        .eq('id', slotId)
        .select();

      if (updateError) throw updateError;
      return data;
    },
    onSuccess: () => {
      // Invalidate all availability lists to refresh with updated slots
      queryClient.invalidateQueries({
        queryKey: ['coach-availability'],
      });
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });
};

/**
 * Fetch a period and merge overrides from the FIRST WEEK only
 * This ensures ManageAvailabilityModal shows the latest edited values for each day
 * Uses API layer for all database interactions
 */
export const usePeriodWithOverrides = (period: CoachAvailability | null) => {
  return useQuery({
    queryKey: ['period-with-overrides', period?.id],
    queryFn: async () => {
      const response = await fetchPeriodWithOverrides(period);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    enabled: !!period,
  });
};

/**
 * Export query client invalidation helpers
 */
export const availabilityQueryHelpers = {
  invalidateAvailability: (
    queryClient: ReturnType<typeof useQueryClient>,
    coachId: string
  ) => {
    queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.availability(coachId),
    });
  },

  invalidateSlots: (
    queryClient: ReturnType<typeof useQueryClient>,
    availabilityId: string
  ) => {
    queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.slots(availabilityId),
    });
  },

  invalidateAllAvailabilityQueries: (
    queryClient: ReturnType<typeof useQueryClient>
  ) => {
    // Invalidate all shared availability-related queries
    queryClient.invalidateQueries({ queryKey: SHARED_QUERY_KEYS.WEEKLY_AVAILABILITY_RESOLVED });
    queryClient.invalidateQueries({ queryKey: SHARED_QUERY_KEYS.PERIOD_WITH_OVERRIDES });
    queryClient.invalidateQueries({ queryKey: SHARED_QUERY_KEYS.COACH_AVAILABILITY });
  },
};
