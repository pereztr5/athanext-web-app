/**
 * Booking requests (ATH-49, ATH-71).
 * Requests are coach_slot_bookings rows with status 'requested', held for 24 hours; the RPCs
 * are security definer and scoped to the calling coach.
 */
import { supabase } from '@/integrations/supabase/client';
import { sessionInstantISO } from '@/utils/viewerTime';

export interface BookingRequest {
  bookingId: string;
  occurrenceId: string;
  athleteId: string | null;
  athleteName: string;
  athletePhoto: string | null;
  sessionName: string;
  sessionType: 'individual' | 'group';
  location: string | null;
  place: string | null;
  price: number;
  date: string;
  start: string;
  end: string;
  notes: string | null;
  requestedAt: string | null;
  /** When the hold ends and the request expires (ATH-71). */
  expiresAt: string | null;
  /** Spots on the session and how many are already taken (ATH-85: "Group is full"). */
  capacity: number;
  taken: number;
  /** The preview a coach sees before accepting (ATH-92): position and birth date for the age group. */
  athletePosition: string | null;
  athleteBirthDate: string | null;
}

/** A time the coach suggested instead of a request, until the family books it (ATH-85). */
export interface WaitingSuggestion {
  occurrenceId: string;
  athleteId: string | null;
  athleteName: string;
  start: string;
  end: string;
  price: number;
}

export const bookingRequestsAPI = {
  async listForCoach(): Promise<BookingRequest[]> {
    const { data, error } = await supabase.rpc('get_coach_booking_requests');
    if (error) throw error;
    return (data || []).map((row) => ({
      bookingId: row.booking_id,
      occurrenceId: row.occurrence_id,
      athleteId: row.athlete_id ?? null,
      athleteName: row.athlete_name || 'Athlete',
      athletePhoto: row.athlete_photo ?? null,
      sessionName: row.session_name || 'Coaching session',
      sessionType: row.session_type === 'group' ? 'group' : 'individual',
      location: row.location ?? null,
      place: row.place ?? null,
      price: Number(row.price) || 0,
      date: row.occurrence_date,
      start: sessionInstantISO(row.occurrence_date, row.start_time),
      end: sessionInstantISO(row.occurrence_date, row.end_time),
      notes: row.notes ?? null,
      requestedAt: row.requested_at ?? null,
      expiresAt: row.expires_at ?? null,
      capacity: Number(row.capacity) || 1,
      taken: Number(row.taken) || 0,
      athletePosition: row.athlete_position ?? null,
      athleteBirthDate: row.athlete_birth_date ?? null,
    }));
  },

  /** 'booked' when the coach is booking only (ATH-86): the family pays them directly. */
  async respond(bookingId: string, accept: boolean): Promise<'pending_payment' | 'booked' | 'canceled'> {
    const { data, error } = await supabase.rpc('respond_to_booking_request', {
      p_booking_id: bookingId,
      p_accept: accept,
    });
    if (error) throw error;
    return data as 'pending_payment' | 'booked' | 'canceled';
  },

  /** Offers a 1-on-1 at another time (Eastern date and HH:MM:SS) and closes the request. */
  async suggestTime(bookingId: string, date: string, start: string, message: string): Promise<string> {
    const { data, error } = await supabase.rpc('suggest_booking_time', {
      p_booking_id: bookingId,
      p_date: date,
      p_start: start,
      p_message: message,
    });
    if (error) throw error;
    return data as string;
  },

  async waiting(): Promise<WaitingSuggestion[]> {
    const { data, error } = await supabase.rpc('get_waiting_suggestions');
    if (error) throw error;
    return (data || []).map((row) => ({
      occurrenceId: row.occurrence_id,
      athleteId: row.athlete_id ?? null,
      athleteName: row.athlete_name || 'Athlete',
      start: sessionInstantISO(row.occurrence_date, row.start_time),
      end: sessionInstantISO(row.occurrence_date, row.end_time),
      price: Number(row.price) || 0,
    }));
  },

  /** The coach's direct conversation with this family, for Message. */
  async openConversation(athleteId: string): Promise<string> {
    const { data, error } = await supabase.rpc('open_family_conversation', { p_athlete_id: athleteId });
    if (error) throw error;
    return data as string;
  },
};
