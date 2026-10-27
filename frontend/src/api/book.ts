/**
 * Athlete Book a Session (ATH-73). What a family can book comes from security definer RPCs
 * that apply drafts, visibility, busy times and capacity for the signed-in family.
 */
import { supabase } from "@/integrations/supabase/client";
import { functionPaymentError, paymentErrorMessage } from "@/utils/paymentErrors";

type Row = Record<string, any>;

export interface BookingCoach {
  id: string;
  name: string;
  slug: string | null;
  imageUrl: string | null;
  specialties: string[];
  positions: string[];
  hourlyRate: number | null;
  locations: string[];
  rating: number | null;
  totalReviews: number;
  /** Has a booked or completed session, or a confirmed referral: books instantly. */
  isClient: boolean;
  /** New family and the coach approves new families first. */
  needsRequest: boolean;
  credits: number;
  /**
   * Legacy booking-only (ATH-86): every booking is paid to the coach outside AthaNext.
   * WC4 replaces this with card always on + optional offline for invited clients.
   */
  paysDirect: boolean;
  payNote: string | null;
  /** Coach accepts Cash/Zelle/Venmo from invited clients (WC4 offline pay). */
  offlinePayAvailable: boolean;
  nextSession: { date: string; startTime: string } | null;
  nextOpen: { date: string; startTime: string } | null;
  nextGroup: { date: string; startTime: string; spotsLeft: number; capacity: number; name: string } | null;
  groupFrom: number | null;
  oneOnOneFrom: number | null;
}

export interface BookableSession {
  id: string;
  coachId: string;
  /** Eastern date and wall times. */
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  sessionType: "individual" | "group";
  sessionName: string;
  price: number;
  capacity: number;
  location: "online" | "in-person";
  place: string | null;
  pillar: string | null;
  position: string | null;
  details: { about?: string[]; level?: string; ages?: string; bring?: string };
  bookedCount: number;
  /** The family's own live booking on this session, if any. */
  myStatus: string | null;
}

const mapCoach = (row: Row): BookingCoach => ({
  id: row.id,
  name: row.name || "Coach",
  slug: row.slug ?? null,
  imageUrl: row.image_url ?? null,
  specialties: row.specialties ?? [],
  positions: row.positions ?? [],
  hourlyRate: row.hourly_rate != null ? Number(row.hourly_rate) : null,
  locations: (row.locations ?? []).filter(Boolean),
  rating: row.rating != null ? Number(row.rating) : null,
  totalReviews: Number(row.total_reviews) || 0,
  isClient: Boolean(row.is_client),
  needsRequest: Boolean(row.needs_request),
  credits: Number(row.credits) || 0,
  paysDirect: row.pay_mode === "self",
  payNote: row.pay_note ?? null,
  offlinePayAvailable: Boolean(row.offline_pay_available),
  nextSession: row.next_session ? { date: row.next_session.date, startTime: row.next_session.start_time } : null,
  nextOpen: row.next_open ? { date: row.next_open.date, startTime: row.next_open.start_time } : null,
  nextGroup: row.next_group
    ? {
        date: row.next_group.date,
        startTime: row.next_group.start_time,
        spotsLeft: Number(row.next_group.spots_left) || 0,
        capacity: Number(row.next_group.capacity) || 0,
        name: row.next_group.name || "Group session",
      }
    : null,
  groupFrom: row.group_from != null ? Number(row.group_from) : null,
  oneOnOneFrom: row.one_on_one_from != null ? Number(row.one_on_one_from) : null,
});

const mapSession = (row: Row): BookableSession => ({
  id: row.id,
  coachId: row.coach_id,
  date: row.occurrence_date,
  startTime: row.start_time,
  endTime: row.end_time,
  durationMinutes: Number(row.duration_minutes) || 60,
  sessionType: row.session_type === "group" ? "group" : "individual",
  sessionName: row.session_name || "Session",
  price: Number(row.price) || 0,
  capacity: Number(row.capacity) || 1,
  location: row.location === "online" ? "online" : "in-person",
  place: row.place ?? null,
  pillar: row.pillar ?? null,
  position: row.position ?? null,
  details: row.details ?? {},
  bookedCount: Number(row.booked_count) || 0,
  myStatus: row.my_status ?? null,
});

export const bookAPI = {
  async myCoaches(): Promise<BookingCoach[]> {
    const { data, error } = await supabase.rpc("get_my_coaches");
    if (error) throw error;
    return ((data as Row[]) ?? []).map(mapCoach);
  },

  /** Eastern dates, inclusive; at most 35 days. */
  async sessions(coachId: string, from: string, to: string): Promise<{ coach: BookingCoach | null; sessions: BookableSession[] }> {
    const { data, error } = await supabase.rpc("get_bookable_sessions", { p_coach_id: coachId, p_from: from, p_to: to });
    if (error) throw error;
    const raw = (data ?? {}) as Row;
    return {
      coach: raw.coach ? mapCoach(raw.coach) : null,
      sessions: ((raw.sessions as Row[]) ?? []).map(mapSession),
    };
  },

  /** A shared session link (`?session=`): the one session a family can book. */
  async sessionForBooking(occurrenceId: string): Promise<BookableSession | null> {
    const { data, error } = await supabase.rpc("get_session_for_booking", { p_occurrence_id: occurrenceId });
    if (error) throw error;
    if (!data) return null;
    const row = data as Row;
    return mapSession({
      ...row,
      capacity: row.capacity ?? row.max_bookings_per_slot,
      pillar: row.pillar ?? row.pillar_slot,
    });
  },

  async pillarCoaches(pillar: string, position: string | null): Promise<BookingCoach[]> {
    const { data, error } = await supabase.rpc("get_pillar_coaches", { p_pillar: pillar, p_position: position ?? undefined });
    if (error) throw error;
    return ((data as Row[]) ?? []).map(mapCoach);
  },

  /** Asks for a time that isn't listed (Eastern date and "HH:MM"). Nothing is charged until the coach accepts. */
  async requestTime(coachId: string, date: string, start: string, note: string, pillar: string | null): Promise<void> {
    const { error } = await supabase.rpc("request_session_time", {
      p_coach_id: coachId,
      p_date: date,
      p_start: start,
      p_note: note,
      p_pillar: pillar ?? undefined,
    });
    if (error) throw error;
  },

  /**
   * One call for sessions paid the same way, across coaches (ATH-94): paid now (credits used
   * first, then one Stripe checkout), requests (card held on Stripe's page, ATH-85) or paid to
   * the coach directly (booking only, ATH-86).
   */
  async checkout(
    occurrenceIds: string[],
    athleteId: string,
    useCredits = true,
    payOffline = false
  ): Promise<{
    url?: string;
    requested?: boolean;
    direct?: boolean;
    offline?: boolean;
    booked?: boolean;
    creditsUsed: number;
    bookingIds: string[];
  }> {
    const { data, error } = await supabase.functions.invoke("create-booking-payment-v0", {
      body: {
        occurrence_ids: occurrenceIds,
        athlete_id: athleteId,
        use_credits: useCredits,
        ...(payOffline ? { pay_offline: true } : {}),
      },
    });
    if (error) throw new Error(await functionPaymentError(error, "Couldn't book these sessions. Please try again."));
    if (data?.error) throw new Error(paymentErrorMessage(data.error, "Couldn't book these sessions. Please try again."));
    return {
      url: data?.url,
      requested: Boolean(data?.requested),
      direct: Boolean(data?.direct),
      offline: Boolean(data?.offline),
      booked: Boolean(data?.booked),
      creditsUsed: Number(data?.credits_used) || 0,
      /** Credits-only and pay-direct calls return the bookings they made; Stripe ones don't. */
      bookingIds: Array.isArray(data?.booking_ids) ? (data.booking_ids as unknown[]).map(String) : [],
    };
  },
};
