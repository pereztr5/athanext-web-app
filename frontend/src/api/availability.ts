import type { ApiResponse, ApiError } from './client';
import { supabase } from '@/integrations/supabase/client';
import type { CoachAvailability, CoachAvailabilitySlot } from '@/types/availability';
import type { CoachAvailabilityWithOccurrences, SlotOccurrence } from '@/types/availabilityWithOccurrences';
import { getWeekStart, toLocalISODate } from '@/utils/dateHelpers';

/**
 * Slot override type
 */
export interface SlotOverride {
  id: string;
  slot_id: string;
  override_date: string;
  session_name?: string | null;
  price?: number | null;
  duration_minutes?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  session_type?: string | null;
  location?: string | null;
  pillar_slot?: string | null;
  is_enabled?: boolean | null;
  created_at: string;
  updated_at: string;
}

const buildApiError = (code: string, message: string, status = 500, originalError?: unknown): ApiError => ({
  code,
  message,
  status,
  originalError,
});

/**
 * Fetch slot overrides for the first week of a period
 * Merges overrides with base slots to show latest edited values
 */
export async function fetchPeriodWithOverrides(
  period: CoachAvailability | null
): Promise<ApiResponse<CoachAvailability | null>> {
  try {
    if (!period) {
      return { data: null, error: null };
    }

    const slotIds = period.slots.map((s) => s.id);
    if (slotIds.length === 0) {
      return { data: period, error: null };
    }

    // Calculate first week's date range - align to Monday like CoachAvailabilitySection
    const periodStart = new Date(period.start_date);
    const weekStart = getWeekStart(periodStart);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const weekStartISO = toLocalISODate(weekStart);
    const weekEndISO = toLocalISODate(weekEnd);

    console.log('🔍 Fetching overrides for first week:', weekStartISO, 'to', weekEndISO);

    // Fetch overrides for the FIRST WEEK only
    const { data: overrides, error } = await supabase
      .from('coach_availability_slot_overrides' as any)
      .select('*')
      .in('slot_id', slotIds)
      .gte('override_date', weekStartISO)
      .lte('override_date', weekEndISO);

    if (error) {
      console.error('Error fetching overrides:', error);
      return {
        data: period,
        error: buildApiError('FETCH_OVERRIDES_ERROR', error.message, 500, error),
      };
    }

    console.log('📦 Found overrides:', overrides?.length || 0, overrides);

    // Map overrides by slot_id - keep the first one we find (for the slot's day of week in week 1)
    const overridesBySlotId = new Map<string, SlotOverride>();
    (overrides || []).forEach((ov: any) => {
      // For each slot, keep the first override we find (represents that slot's day in week 1)
      if (!overridesBySlotId.has(ov.slot_id)) {
        overridesBySlotId.set(ov.slot_id, ov);
      }
    });

    console.log('🗺️ Overrides by slot_id:', Object.fromEntries(overridesBySlotId));

    // Merge overrides with base slots
    const mergedSlots: CoachAvailabilitySlot[] = period.slots.map((slot: any) => {
      const override = overridesBySlotId.get(slot.id);
      if (!override) {
        console.log(`➡️ Slot ${slot.id} (${slot.day_of_week}): No override, using base`);
        return slot;
      }

      console.log(`✏️ Slot ${slot.id} (${slot.day_of_week}): Merging override`, override);

      // Apply override values to the base slot
      return {
        ...slot,
        session_name: override.session_name ?? slot.session_name,
        price: override.price ?? slot.price,
        duration_minutes: (override.duration_minutes ?? slot.duration_minutes) as any,
        start_time: override.start_time ?? slot.start_time,
        end_time: override.end_time ?? slot.end_time,
        session_type: override.session_type ?? slot.session_type,
        location: override.location ?? slot.location,
        pillar_slot: override.pillar_slot ?? slot.pillar_slot,
        is_enabled: override.is_enabled !== null ? override.is_enabled : slot.is_enabled,
      } as CoachAvailabilitySlot;
    });

    console.log('✅ Merged slots:', mergedSlots);

    return {
      data: {
        ...period,
        slots: mergedSlots,
      },
      error: null,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return {
      data: null,
      error: buildApiError('UNEXPECTED_ERROR', errorMessage, 500, err),
    };
  }
}

/**
 * Fetch availability v3 (periods + weekly slots + occurrences) for a coach
 */
export async function fetchCoachAvailability(
  coachId: string
): Promise<ApiResponse<CoachAvailabilityWithOccurrences[]>> {
  try {
    const { data, error } = await supabase.rpc('get_coach_availability' as any, {
      coach_id_param: coachId,
    });
    if (error) {
      return {
        data: [],
        error: buildApiError('FETCH_AVAILABILITY_V3_ERROR', error.message, 500, error),
      };
    }
    return { data: (data || []) as CoachAvailabilityWithOccurrences[], error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { data: [], error: buildApiError('UNEXPECTED_ERROR', message, 500, err) };
  }
}

/**
 * Fetch a single occurrence for a weekly slot on a given date
 */
export async function fetchOccurrenceForDate(
  weeklySlotId: string,
  occurrenceDate: string
): Promise<ApiResponse<SlotOccurrence | null>> {
  try {
    const { data, error } = await supabase
      .from('coach_availability_slot_occurrences' as any)
      .select('*')
      .eq('weekly_slot_id', weeklySlotId)
      .eq('occurrence_date', occurrenceDate)
      .maybeSingle();
    if (error) {
      return {
        data: null,
        error: buildApiError('FETCH_OCCURRENCE_ERROR', error.message, 500, error),
      };
    }
    return { data: (data as any) as SlotOccurrence || null, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { data: null, error: buildApiError('UNEXPECTED_ERROR', message, 500, err) };
  }
}
