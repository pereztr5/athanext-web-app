/**
 * useCoachSessionFeedback Hook
 * React Query hooks for coach session feedback data and mutations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCoachSessionFeedbackScreen,
  upsertSlotAttendance,
  upsertSlotFeedback,
  upsertSessionFeedback,
} from '@/api/sessions';
import type { SessionFeedbackRPCRow } from '@/utils/sessionFeedbackHelpers';

/**
 * Query key factory for session feedback
 */
const SESSION_FEEDBACK_KEYS = {
  all: ['sessionFeedback'] as const,
  detail: (slotId: string) => ['sessionFeedback', slotId] as const,
};

/**
 * Hook to fetch session feedback screen data
 */
export const useCoachSessionFeedback = (slotId: string | undefined) => {
  return useQuery({
    queryKey: SESSION_FEEDBACK_KEYS.detail(slotId || ''),
    queryFn: async () => {
      if (!slotId) return [];
      const response = await getCoachSessionFeedbackScreen(slotId);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return (response.data || []) as SessionFeedbackRPCRow[];
    },
    enabled: Boolean(slotId),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook to upsert attendance
 */
export const useUpsertSlotAttendance = (slotId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      payload: Array<{
        booking_id: string;
        slot_id: string;
        athlete_id: string;
        attendance: 'present' | 'absent';
        reason_absent?: string | null;
      }>
    ) => {
      const response = await upsertSlotAttendance(payload);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: () => {
      if (slotId) {
        queryClient.invalidateQueries({
          queryKey: SESSION_FEEDBACK_KEYS.detail(slotId),
        });
      }
    },
  });
};

/**
 * Hook to upsert athlete feedback
 */
export const useUpsertSlotFeedback = (slotId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      payload: Array<{
        booking_id: string;
        slot_id: string;
        athlete_id: string;
        coach_rating_of_athlete?: number | null;
        highlighted_skills?: string[] | null;
        feedback_to_athlete?: string | null;
        coach_only_notes?: string | null;
      }>
    ) => {
      const response = await upsertSlotFeedback(payload);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: () => {
      if (slotId) {
        queryClient.invalidateQueries({
          queryKey: SESSION_FEEDBACK_KEYS.detail(slotId),
        });
      }
    },
  });
};

/**
 * Hook to upsert session feedback
 */
export const useUpsertSessionFeedback = (slotId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      slot_id: string;
      session_rating: number;
      session_summary?: string | null;
      coach_notes?: string | null;
    }) => {
      const response = await upsertSessionFeedback(payload);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: () => {
      if (slotId) {
        queryClient.invalidateQueries({
          queryKey: SESSION_FEEDBACK_KEYS.detail(slotId),
        });
      }
      queryClient.invalidateQueries({
        queryKey: ['sessions'],
      });
    },
  });
};
