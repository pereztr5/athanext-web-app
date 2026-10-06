/**
 * The coach's page for one session (ATH-80): details, reschedule and cancel.
 */
import { supabase } from "@/integrations/supabase/client";

type Row = Record<string, any>;

export interface CoachSessionBooking {
  id: string;
  athleteId: string;
  name: string;
  imageUrl: string | null;
  status: "requested" | "pending_payment" | "booked" | "completed" | "no_show" | "canceled";
  paymentStatus: string;
  attendance: "present" | "absent" | "no_show" | null;
  notes: string | null;
}

export interface CoachSessionDetail {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  sessionType: "individual" | "group";
  sessionName: string;
  pillar: string | null;
  price: number;
  capacity: number;
  location: "online" | "in-person";
  place: string | null;
  isEnabled: boolean;
  started: boolean;
  ended: boolean;
  bookings: CoachSessionBooking[];
  feedback: { summary: string | null; noShow: boolean; editCount: number; score: number | null } | null;
  lastSummary: { date: string; summary: string } | null;
}

export const coachSessionAPI = {
  async get(occurrenceId: string): Promise<CoachSessionDetail> {
    const { data, error } = await supabase.rpc("get_coach_session", { p_occurrence_id: occurrenceId });
    if (error) throw error;
    const raw = (data ?? {}) as Row;
    return {
      id: raw.id,
      date: raw.date,
      startTime: raw.start_time,
      endTime: raw.end_time,
      durationMinutes: Number(raw.duration_minutes) || 60,
      sessionType: raw.session_type === "group" ? "group" : "individual",
      sessionName: raw.session_name || "Session",
      pillar: raw.pillar ?? null,
      price: Number(raw.price) || 0,
      capacity: Number(raw.capacity) || 1,
      location: raw.location === "online" ? "online" : "in-person",
      place: raw.place ?? null,
      isEnabled: Boolean(raw.is_enabled),
      started: Boolean(raw.started),
      ended: Boolean(raw.ended),
      bookings: ((raw.bookings as Row[]) ?? []).map((b) => ({
        id: b.id,
        athleteId: b.athlete_id,
        name: b.name || "Athlete",
        imageUrl: b.image_url ?? null,
        status: b.status,
        paymentStatus: b.payment_status,
        attendance: b.attendance ?? null,
        notes: b.notes ?? null,
      })),
      feedback: raw.feedback
        ? {
            summary: raw.feedback.summary ?? null,
            noShow: Boolean(raw.feedback.no_show),
            editCount: Number(raw.feedback.edit_count) || 0,
            score: raw.feedback.score != null ? Number(raw.feedback.score) : null,
          }
        : null,
      lastSummary: raw.last_summary?.summary ? { date: raw.last_summary.date, summary: raw.last_summary.summary } : null,
    };
  },

  /** New Eastern date and "HH:MM". Each booked family gets the message. Returns how many were told. */
  async reschedule(occurrenceId: string, date: string, start: string, message: string): Promise<number> {
    const { data, error } = await supabase.rpc("schedule_reschedule_session", {
      p_occurrence_id: occurrenceId,
      p_date: date,
      p_start: start,
      p_message: message,
    });
    if (error) throw error;
    return Number(data) || 0;
  },

  async cancel(occurrenceId: string, message: string): Promise<number> {
    const { data, error } = await supabase.rpc("schedule_cancel_session", { p_occurrence_id: occurrenceId, p_message: message });
    if (error) throw error;
    return Number(data) || 0;
  },
};
