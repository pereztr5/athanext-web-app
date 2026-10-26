/**
 * The athlete's page for one of their sessions (ATH-97).
 */
import { chatAPI } from "@/api/chat";
import { toSessionCamp, type SessionCamp } from "@/api/coachSession";
import { supabase } from "@/integrations/supabase/client";
import { buildId } from "@/utils/chatHelpers";

type Row = Record<string, any>;

/** until types are regenerated after the migration is applied */
const rpc = supabase.rpc as unknown as (
  fn: string,
  args?: Record<string, unknown>
) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;

export class MissingRpcError extends Error {
  constructor() {
    super("Reschedule isn't available yet");
    this.name = "MissingRpcError";
  }
}

/** PostgREST / Postgres when reschedule_my_booking is not deployed yet. */
export const isMissingRpc = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: string }).code ?? "") : "";
  if (code === "42883" || code === "PGRST202") return true;
  const message = "message" in error ? String((error as { message?: string }).message ?? "") : "";
  return /reschedule_my_booking/i.test(message) && /could not find|does not exist|schema cache/i.test(message);
};

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
  /** Coach cancellation window. 24 until get_athlete_session returns the field. */
  cancelNoticeHours: number;
  coach: { id: string; name: string; slug: string | null; photo: string | null; paysDirect: boolean; payNote: string | null };
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
  /** The coach's 1 to 10 session score, shown with the summary. */
  score: number | null;
  /** "<Athlete> was marked as missed for …" when the coach marked them as missed. */
  missedMessage: string | null;
  note: string | null;
  /** A camp day: booked through the camp registration, managed by the coach. */
  camp: SessionCamp | null;
}

/** Confirmed bookings whose price must stay put. pending_offline is not settled yet. */
export const RESCHEDULABLE_PAYMENTS = new Set(["paid", "credit", "direct", "outside"]);

export interface RescheduleResult {
  occurrenceId: string;
  notified: boolean;
}

/** Posts into the same direct thread the Message button opens. False if that thread can't be written. */
const tellCoach = async (coachId: string, coachName: string, body: string): Promise<boolean> => {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return false;
  const { data: coachProfile, error: profileError } = await chatAPI.getCoachUserProfile(coachId);
  if (profileError || !coachProfile?.id || coachProfile.id === userId) return false;
  const { data: existing, error: existingError } = await chatAPI.findConversationBetweenUsers(userId, coachProfile.id);
  if (existingError) return false;
  let conversationId = existing?.id ?? null;
  if (!conversationId) {
    conversationId = buildId();
    const { error } = await chatAPI.createConversation({
      id: conversationId,
      created_by: userId,
      title: coachName,
      is_group: false,
    });
    if (error) return false;
    const { error: participantsError } = await chatAPI.addParticipants([
      { conversation_id: conversationId, user_id: userId, role: "owner" },
      { conversation_id: conversationId, user_id: coachProfile.id, role: "member" },
    ]);
    if (participantsError) return false;
  }
  const { error: sendError } = await chatAPI.sendMessage(conversationId, userId, body);
  if (sendError) return false;
  await chatAPI.updateConversationMetadata(conversationId, {
    last_message_at: new Date().toISOString(),
    last_message_text: body.slice(0, 200),
  });
  return true;
};

export const athleteSessionAPI = {
  /** Cancels the family's booking. With the coach's notice hours a paid session comes back as a credit. */
  async cancel(bookingId: string, reason?: string): Promise<{ credit: boolean }> {
    const { data, error } = await supabase.rpc("cancel_my_booking", {
      p_booking_id: bookingId,
      p_reason: reason?.trim() || undefined,
    });
    if (error) throw error;
    // If a share was already sent before the hold model, finish the Stripe reversal.
    void supabase.functions.invoke("stripe-payouts", {
      body: { action: "reverse_bookings", booking_ids: [bookingId] },
    });
    return { credit: Boolean((data as { credit?: boolean } | null)?.credit) };
  },

  /** Drops a request, then tells the coach in the direct thread when that thread can be opened. */
  async withdraw(bookingId: string, coachId: string, coachName: string, when: string): Promise<{ told: boolean }> {
    await this.cancel(bookingId, "Request withdrawn");
    const told = await tellCoach(
      coachId,
      coachName,
      `I withdrew my request for ${when}. I no longer need this time. Nothing was charged.`
    );
    return { told };
  },

  /**
   * Moves this booking onto another open occurrence. Payment stays on the booking.
   * A missing RPC (migration not applied) throws MissingRpcError.
   */
  async reschedule(bookingId: string, occurrenceId: string, message: string): Promise<RescheduleResult> {
    const { data, error } = await rpc("reschedule_my_booking", {
      p_booking_id: bookingId,
      p_new_occurrence_id: occurrenceId,
      p_message: message.trim() || null,
    });
    if (error) {
      if (isMissingRpc(error)) throw new MissingRpcError();
      throw new Error(error.message || "That didn't save. Try again");
    }
    const row = (data ?? {}) as { occurrence_id?: string; notified?: boolean };
    if (!row.occurrence_id) throw new Error("That didn't save. Try again");
    return { occurrenceId: row.occurrence_id, notified: Boolean(row.notified) };
  },

  async get(occurrenceId: string): Promise<AthleteSession> {
    const { data, error } = await supabase.rpc("get_athlete_session", { p_occurrence_id: occurrenceId });
    if (error) throw error;
    const raw = (data ?? {}) as Row;
    const coach = (raw.coach ?? {}) as Row;
    const booking = (raw.booking ?? {}) as Row;
    const notice = Number(raw.cancel_notice_hours);
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
      cancelNoticeHours: Number.isFinite(notice) && notice > 0 ? notice : 24,
      coach: {
        id: coach.id,
        name: coach.name ?? "Coach",
        slug: coach.slug ?? null,
        photo: coach.photo ?? null,
        paysDirect: coach.pay_mode === "self",
        payNote: coach.pay_note ?? null,
      },
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
      score: raw.score != null ? Number(raw.score) || null : null,
      missedMessage: raw.missed_message ?? null,
      note: raw.note ?? null,
      camp: toSessionCamp(raw.camp),
    };
  },
};
