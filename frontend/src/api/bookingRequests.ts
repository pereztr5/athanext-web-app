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
    }));
  },

  async respond(bookingId: string, accept: boolean): Promise<'pending_payment' | 'canceled'> {
    const { data, error } = await supabase.rpc('respond_to_booking_request', {
      p_booking_id: bookingId,
      p_accept: accept,
    });
    if (error) throw error;
    return data as 'pending_payment' | 'canceled';
  },
};
