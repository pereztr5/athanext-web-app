/**
 * useWeeklyAvailability
 * Resolves weekly availability by merging base slots with one-off overrides for the selected week
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CoachAvailability, CoachAvailabilitySlot, CoachAvailabilitySlotOverride } from '@/types/availability';
import { toLocalISODate } from '@/utils/dateHelpers';

const weekKey = (availabilityId: string, weekStartISO: string) => [
  'weekly-availability-resolved',
  availabilityId,
  weekStartISO,
] as const;

function toISODate(d: Date): string {
  return toLocalISODate(d);
}

function getWeekDates(weekStart: Date): string[] {
  const days: string[] = [];
  const cur = new Date(weekStart);
  for (let i = 0; i < 7; i++) {
    days.push(toISODate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export function useWeeklyAvailability(
  period: CoachAvailability | null,
  weekStart: Date | null
) {
  const weekStartISO = useMemo(() => (weekStart ? toISODate(weekStart) : ''), [weekStart]);

  return useQuery({
    queryKey: weekKey(period?.id || '', weekStartISO || ''),
    enabled: !!period && !!weekStart,
    queryFn: async (): Promise<CoachAvailabilitySlot[]> => {
      if (!period || !weekStart) return [];

      const weekDates = getWeekDates(weekStart);
      const slotIds = (period.slots || []).map((s) => s.id);

      if (slotIds.length === 0) return [];

      // Fetch overrides for this week's dates and relevant slots
      const { data: overrides, error } = await supabase
        .from('coach_availability_slot_overrides' as any)
        .select('*')
        .in('slot_id', slotIds)
        .gte('override_date', weekDates[0])
        .lte('override_date', weekDates[6]);

      if (error) {
        console.error('Error fetching slot overrides:', error);
        // Fail-soft: show all base slots (including disabled)
        return period.slots;
      }

      const bySlotDate = new Map<string, any>();
      (overrides || []).forEach((ov: any) => {
        bySlotDate.set(`${ov.slot_id}:${ov.override_date}`, ov);
      });

      // For each base slot, find the matching day in this week and apply override if present
      const resolved: CoachAvailabilitySlot[] = [];
      for (const slot of period.slots) {
        // identify the specific calendar date in this week for the slot's day_of_week
        // WeekStart is Monday; DayOfWeek type: 1=Mon ... 7=Sun
        const dateForDay = new Date(weekStart);
        const offset = slot.day_of_week - 1; // 0-based offset from Monday
        dateForDay.setDate(dateForDay.getDate() + offset);
        const dateISO = toISODate(dateForDay);

        const ov = bySlotDate.get(`${slot.id}:${dateISO}`);
        if (ov) {
          // Apply override (whether enabled or disabled)
          resolved.push({
            ...slot,
            session_name: ov.session_name ?? slot.session_name,
            price: ov.price ?? slot.price,
            duration_minutes: (ov.duration_minutes ?? slot.duration_minutes) as any,
            start_time: ov.start_time ?? slot.start_time,
            end_time: ov.end_time ?? slot.end_time,
            session_type: (ov.session_type ?? slot.session_type) as any,
            location: (ov.location ?? slot.location) as any,
            pillar_slot: ov.pillar_slot ?? slot.pillar_slot,
            is_enabled: ov.is_enabled ?? slot.is_enabled,
          });
        } else {
          // Always include the base slot (enabled or disabled)
          resolved.push(slot);
        }
      }

      // Sort by day for consistent display
      resolved.sort((a, b) => a.day_of_week - b.day_of_week);
      return resolved;
    },
  });
}

export default useWeeklyAvailability;
