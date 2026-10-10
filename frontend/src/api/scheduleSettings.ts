/**
 * Schedule settings page (Working Copy c-availability): booking rules beyond what My Schedule
 * reads, and every upcoming day off. RPCs from 20261010210000_schedule_settings.sql.
 */
import { supabase } from "@/integrations/supabase/client";
import type { NewFamilyBooking, TimeOffDay } from "@/api/schedule";

export interface ScheduleSettings {
  newFamilyBooking: NewFamilyBooking;
  bookingWindowWeeks: number;
  /** Null: fall back to cancellationPolicy, then 24 hours. */
  cancelNoticeHours: number | null;
  cancellationPolicy: string | null;
  travelMiles: number | null;
  travelZip: string | null;
  groupMin: number | null;
  homeZip: string | null;
  timeOff: TimeOffDay[];
}

export interface BookingRulesInput {
  newFamilyBooking: NewFamilyBooking;
  bookingWindowWeeks: number;
  cancelNoticeHours: number | null;
  travelMiles: number | null;
  travelZip: string | null;
  groupMin: number | null;
}

type Row = Record<string, any>;

const num = (v: unknown) => (v == null || v === "" ? null : Number(v) || null);

const rpc = (name: string, args?: Record<string, unknown>) =>
  supabase.rpc(name as never, args as never) as unknown as Promise<{ data: unknown; error: Error | null }>;

export const scheduleSettingsAPI = {
  async get(): Promise<ScheduleSettings> {
    const { data, error } = await rpc("get_schedule_settings");
    if (error) throw error;
    const raw = (data ?? {}) as Row;
    return {
      newFamilyBooking: raw.new_family_booking === "instant" ? "instant" : "request",
      bookingWindowWeeks: Number(raw.booking_window_weeks) || 4,
      cancelNoticeHours: num(raw.cancel_notice_hours),
      cancellationPolicy: raw.cancellation_policy?.trim() || null,
      travelMiles: num(raw.travel_miles),
      travelZip: raw.travel_zip || null,
      groupMin: num(raw.group_min),
      homeZip: raw.home_zip || null,
      timeOff: ((raw.time_off as Row[]) ?? []).map((t) => ({ date: t.date, note: t.note ?? null })),
    };
  },

  async setRules(rules: BookingRulesInput): Promise<void> {
    const { error } = await rpc("schedule_set_booking_rules", {
      p_new_family_booking: rules.newFamilyBooking,
      p_booking_window_weeks: rules.bookingWindowWeeks,
      p_cancel_notice_hours: rules.cancelNoticeHours,
      p_travel_miles: rules.travelMiles,
      p_travel_zip: rules.travelZip,
      p_group_min: rules.groupMin,
    });
    if (error) throw error;
  },
};
