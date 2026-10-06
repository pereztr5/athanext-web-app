/**
 * The athlete's page for one of their sessions (ATH-97).
 */
import { supabase } from "@/integrations/supabase/client";

type Row = Record<string, any>;

export interface AthleteSession {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  sessionType: "individual" | "group";
  sessionName: string | null;
  pillar: string | null;
  price: number;
  location: string | null;
  place: string | null;
  started: boolean;
  ended: boolean;
  capacity: number;
  taken: number;
  coach: { id: string; name: string; slug: string | null; photo: string | null };
  booking: {
    id: string;
    status: string;
    paymentStatus: string;
    paidAmount: number | null;
    cancellationReason: string | null;
    expiresAt: string | null;
  };
  attendance: "present" | "absent" | "no_show" | null;
  summary: string | null;
  note: string | null;
}

export const athleteSessionAPI = {
  async get(occurrenceId: string): Promise<AthleteSession> {
    const { data, error } = await supabase.rpc("get_athlete_session", { p_occurrence_id: occurrenceId });
    if (error) throw error;
    const raw = (data ?? {}) as Row;
    const coach = (raw.coach ?? {}) as Row;
    const booking = (raw.booking ?? {}) as Row;
    return {
      id: raw.id,
      date: raw.date,
      startTime: raw.start_time,
      endTime: raw.end_time,
      durationMinutes: Number(raw.duration_minutes) || 60,
      sessionType: raw.session_type === "group" ? "group" : "individual",
      sessionName: raw.session_name ?? null,
      pillar: raw.pillar ?? null,
      price: Number(raw.price) || 0,
      location: raw.location ?? null,
      place: raw.place ?? null,
      started: Boolean(raw.started),
      ended: Boolean(raw.ended),
      capacity: Number(raw.capacity) || 1,
      taken: Number(raw.taken) || 0,
      coach: { id: coach.id, name: coach.name ?? "Coach", slug: coach.slug ?? null, photo: coach.photo ?? null },
      booking: {
        id: booking.id,
        status: booking.status ?? "booked",
        paymentStatus: booking.payment_status ?? "unpaid",
        paidAmount: booking.paid_amount != null ? Number(booking.paid_amount) : null,
        cancellationReason: booking.cancellation_reason ?? null,
        expiresAt: booking.expires_at ?? null,
      },
      attendance: raw.attendance ?? null,
      summary: raw.summary ?? null,
      note: raw.note ?? null,
    };
  },
};
