/**
 * Coach-confirmed booking requests (ATH-49).
 * Requests are coach_slot_bookings rows with status 'requested'; the RPCs are
 * security definer and scoped to the calling coach.
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
  price: number;
  date: string;
  start: string;
  end: string;
  notes: string | null;
  /** When the athlete asked; requests never expire, so this drives the 24h reminder (ATH-28). */
  requestedAt: string | null;
}

export const bookingRequestsAPI = {
  async listForCoach(): Promise<BookingRequest[]> {
    const { data, error } = await (supabase as any).rpc('get_coach_booking_requests');
    if (error) throw error;
    return ((data as any[]) || []).map((row) => ({
      bookingId: row.booking_id,
      occurrenceId: row.occurrence_id,
      athleteId: row.athlete_id ?? null,
      athleteName: row.athlete_name || 'Athlete',
      athletePhoto: row.athlete_photo ?? null,
      sessionName: row.session_name || 'Coaching session',
      sessionType: row.session_type === 'group' ? 'group' : 'individual',
      location: row.location ?? null,
      price: Number(row.price) || 0,
      date: row.occurrence_date,
      start: sessionInstantISO(row.occurrence_date, row.start_time),
      end: sessionInstantISO(row.occurrence_date, row.end_time),
      notes: row.notes ?? null,
      requestedAt: row.requested_at ?? null,
    }));
  },

  async respond(bookingId: string, accept: boolean): Promise<'pending_payment' | 'canceled'> {
    const { data, error } = await (supabase as any).rpc('respond_to_booking_request', {
      p_booking_id: bookingId,
      p_accept: accept,
    });
    if (error) throw error;
    return data;
  },
};
