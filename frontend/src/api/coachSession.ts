/**
 * The coach's page for one session (ATH-80, Working Copy): details, move, cancel with a reason
 * (paid bookings come back as credits) and the note on a declined request.
 */
import { supabase } from "@/integrations/supabase/client";

type Row = Record<string, any>;
const rpc = (name: string, args: Record<string, unknown>) =>
  supabase.rpc(name as never, args as never) as unknown as Promise<{ data: unknown; error: Error | null }>;

export interface CoachSessionBooking {
  id: string;
  athleteId: string;
  name: string;
  imageUrl: string | null;
  status: "requested" | "pending_payment" | "booked" | "completed" | "no_show" | "canceled";
  paymentStatus: string;
  attendance: "present" | "absent" | "no_show" | null;
  notes: string | null;
  cancellationReason: string | null;
  canceledAt: string | null;
  age: number | null;
  parentName: string | null;
  creditsLeft: number;
  paidAmount: number | null;
  /** The coach's note for this athlete after the session. */
  note: string | null;
  /** A cancelled paid or credit booking came back as a credit. */
  creditBack: boolean;
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
  lastFocus: { date: string; text: string } | null;
  /** Set when the coach cancelled the session. */
  cancel: { at: string | null; reason: string | null; refund: string | null } | null;
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
        cancellationReason: b.cancellation_reason ?? null,
        canceledAt: b.canceled_at ?? null,
        age: b.age != null ? Number(b.age) : null,
        parentName: b.parent_name ?? null,
        creditsLeft: Number(b.credits_left) || 0,
        paidAmount: b.paid_amount != null ? Number(b.paid_amount) : null,
        note: b.note ?? null,
        creditBack: Boolean(b.credit_back),
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
      lastFocus: raw.last_focus?.text ? { date: raw.last_focus.date, text: raw.last_focus.text } : null,
      cancel: raw.cancel ? { at: raw.cancel.at ?? null, reason: raw.cancel.reason ?? null, refund: raw.cancel.refund ?? null } : null,
    };
  },

  /** Moves to a new Eastern date and "HH:MM", taking over open slots there. Returns how many families were told. */
  async move(occurrenceId: string, date: string, start: string, message: string): Promise<number> {
    const { data, error } = await rpc("coach_move_session", { p_occurrence_id: occurrenceId, p_date: date, p_start: start, p_message: message });
    if (error) throw error;
    return Number(data) || 0;
  },

  /** Cancels with a reason. Paid bookings come back as session credits; credit bookings get theirs back. */
  async cancel(occurrenceId: string, reason: string, message = ""): Promise<{ sent: number; credits: number }> {
    const { data, error } = await rpc("coach_cancel_session", { p_occurrence_id: occurrenceId, p_reason: reason, p_message: message });
    if (error) throw error;
    const row = (data ?? {}) as Row;
    return { sent: Number(row.sent) || 0, credits: Number(row.credits) || 0 };
  },

  /** After declining a request: keeps the reason and sends the family the message, if any. */
  async declineNote(bookingId: string, reason: string, message: string): Promise<void> {
    const { error } = await rpc("coach_decline_note", { p_booking_id: bookingId, p_reason: reason, p_message: message });
    if (error) throw error;
  },
};
