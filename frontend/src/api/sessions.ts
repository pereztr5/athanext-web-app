/**
 * Sessions API Layer for coach_slot_bookings
 * Centralized API functions for fetching session data from Supabase
 */

import { errorMessage } from '@/utils/errorMessage';
import type { ApiResponse, ApiError } from './client';
import { supabase } from '@/integrations/supabase/client';
import type {
  CoachSlotBooking,
  BookingRPCResponse,
  SessionUIModel,
  ComputedSessionStatus,
  BookingStatus,
  PaymentStatus,
} from '@/types/sessions-api';
import { sessionInstantISO } from '@/utils/viewerTime';
import { campDayTitle } from '@/utils/campSessions';

const buildApiError = (
  code: string,
  message: string,
  status = 500,
  originalError?: unknown
): ApiError => ({
  code,
  message,
  status,
  originalError,
});

/**
 * Map RPC response to UI-ready session model
 * Handles the optimized field structure from get_bookings_by_user_id
 * Combines session_date (YYYY-MM-DD) with slot times (HH:MM:SS)
 */
function mapRPCResponseToSessionUI(booking: BookingRPCResponse, now: Date): SessionUIModel {
  // Extract date and times from RPC response
  const sessionDate = booking.session_date; // YYYY-MM-DD
  const startTime = booking.slot_start_time; // HH:MM:SS
  const endTime = booking.slot_end_time; // HH:MM:SS

  // Stored times are Eastern wall-clock; turn them into real instants so status,
  // countdowns and viewer-zone display are correct anywhere (ATH-22).
  const start = sessionInstantISO(sessionDate, startTime);
  const end = sessionInstantISO(sessionDate, endTime);

  // Determine computed status based on current time
  const computedStatus = determineComputedStatus(start, end, now);

  // Fallback label from the stored Eastern clock times (start/end are UTC instants now).
  const timeRange = `${formatTime(startTime)} - ${formatTime(endTime)}`;

  // Format athlete names for display
  const athleteNamesDisplay = booking.athletes_names && booking.athletes_names.length > 0
    ? booking.athletes_names.join(', ')
    : 'No athletes';

  // Prefer occurrence_id for session id; fall back to slot_id then booking_id
  const sessionId = booking.occurrence_id || booking.slot_id || booking.booking_id;

  return {
    bookingId: booking.booking_id,
    id: sessionId,
    slotId: booking.slot_id,
    occurrenceId: booking.occurrence_id ?? null,
    title: booking.slot_session_name,
    coachName: booking.coach_name ?? null,
    type: booking.slot_session_type,
    computedStatus,
    dbStatus: 'booked' as BookingStatus,
    paymentStatus: 'paid' as PaymentStatus,
    start,
    end,
    dateOnly: sessionDate,
    timeRange,
    location: booking.slot_location,
    rate: Number(booking.slot_price),
    currency: 'CAD',
    coachId: booking.coach_id,
    durationMinutes: booking.slot_duration,
    notes: null,
    stripeSessionId: null,
    pillarSlot: booking.pillar_slot,
    athleteCount: booking.athlete_count,
    athleteNames: booking.athletes_names,
    athleteNamesDisplay,
    hasSessionFeedback: Boolean(booking.has_session_feedback),
    hasSlotFeedback: Boolean(booking.has_slot_feedback),
  };
}

/**
 * Legacy map function for full database records (if needed)
 */
function mapBookingToSessionUI(booking: CoachSlotBooking, now: Date): SessionUIModel {
  // Build ISO datetime strings from date + time components
  const start = sessionInstantISO(booking.occurrence_date, booking.start_time);
  const end = sessionInstantISO(booking.occurrence_date, booking.end_time);

  // Determine computed status based on current time and DB status
  const computedStatus = determineComputedStatusFromBooking(booking, start, end, now);

  // Build time range display string (e.g., "2:30 PM - 3:30 PM")
  const timeRange = `${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}`;

  return {
    bookingId: booking.id,
    id: booking.id,
    slotId: booking.slot_id,
    occurrenceId: null,
    title: booking.service_type,
    type: booking.session_type,
    computedStatus,
    dbStatus: booking.status,
    paymentStatus: booking.payment_status,
    start,
    end,
    dateOnly: booking.occurrence_date,
    timeRange,
    location: booking.location,
    rate: Number(booking.price),
    currency: booking.currency,
    coachId: booking.coach_id,
    durationMinutes: booking.duration_minutes,
    notes: booking.notes,
    stripeSessionId: booking.stripe_session_id,
    pillarSlot: null,
    athleteCount: 1,
    athleteNames: null,
    athleteNamesDisplay: 'Unknown',
    hasSessionFeedback: false,
    hasSlotFeedback: false,
  };
}

/**
 * Determine computed session status based on time and DB status (for RPC responses)
 */
function determineComputedStatus(
  start: string,
  end: string,
  now: Date
): ComputedSessionStatus {
  // Determine based on occurrence time
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (now >= startDate && now <= endDate) {
    return 'in-progress';
  } else if (now < startDate) {
    return 'upcoming';
  } else {
    return 'past';
  }
}

/**
 * Determine computed session status based on time and DB status (for legacy CoachSlotBooking)
 */
function determineComputedStatusFromBooking(
  booking: CoachSlotBooking,
  start: string,
  end: string,
  now: Date
): ComputedSessionStatus {
  // If explicitly canceled, mark as canceled
  if (booking.status === 'canceled') {
    return 'canceled';
  }

  // If explicitly completed or no_show, mark as completed
  if (booking.status === 'completed' || booking.status === 'no_show') {
    return 'completed';
  }

  // Determine based on occurrence time
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (now >= startDate && now <= endDate) {
    return 'in-progress';
  } else if (now < startDate) {
    return 'upcoming';
  } else {
    return 'past';
  }
}

/**
 * Format time string (HH:mm) to display format
 */
function formatTime(timeString: string): string {
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours);
  const meridiem = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${meridiem}`;
}

/**
 * Format ISO 8601 datetime to display time format (e.g., "2:30 PM")
 * With robust error handling and fallback parsing
 */
function formatISOTime(isoString: string): string {
  if (!isoString) {
    console.warn('formatISOTime: received empty string');
    return '12:00 PM';
  }

  try {
    const date = new Date(isoString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn(`formatISOTime: Invalid date parsed from "${isoString}"`);
      // Fallback: try parsing manually
      return parseTimeFromString(isoString);
    }

    const hours = date.getHours();
    const minutes = date.getMinutes();
    const meridiem = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHour}:${displayMinutes} ${meridiem}`;
  } catch (error) {
    console.error(`formatISOTime: error parsing "${isoString}":`, error);
    return parseTimeFromString(isoString);
  }
}

/**
 * Fallback function to extract time from string
 * Handles formats like "HH:MM:SS", "HH:MM", "2025-01-15T14:30:00Z", etc.
 */
function parseTimeFromString(str: string): string {
  try {
    // Try to extract HH:MM pattern
    const timeMatch = str.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const meridiem = hours >= 12 ? 'PM' : 'AM';
      const displayHour = hours % 12 || 12;
      return `${displayHour}:${minutes.toString().padStart(2, '0')} ${meridiem}`;
    }
  } catch (error) {
    console.error(`parseTimeFromString: error parsing "${str}":`, error);
  }
  return '12:00 PM'; // Ultimate fallback
}

const asSessionType = (value: unknown): SessionUIModel['type'] =>
  value === 'group' ? 'group' : 'individual';

const asLocation = (value: unknown): SessionUIModel['location'] =>
  value === 'online' ? 'online' : 'in-person';

/**
 * The bookings RPC omits unpaid walk-ins. Load those separately so the athlete can pay later.
 */
async function getPendingAthleteSessions(athleteId: string, now: Date): Promise<SessionUIModel[]> {
  const { data, error } = await supabase
    .from('coach_slot_bookings' as any)
    .select(
      `id, coach_id, notes, status,
       coach_availability_slot_occurrences (
         id, weekly_slot_id, session_name, session_type, location, price,
         duration_minutes, occurrence_date, start_time, end_time
       )`
    )
    .eq('athlete_id', athleteId)
    .in('status', ['pending_payment', 'requested']);

  if (error || !Array.isArray(data)) {
    console.error('Failed to load unpaid sessions:', error);
    return [];
  }

  const coachIds = [...new Set(data.map((row: any) => row.coach_id).filter(Boolean))];
  const coachNames = new Map<string, string>();
  if (coachIds.length) {
    const { data: coaches } = await supabase.from('coaches').select('id, name').in('id', coachIds);
    (coaches || []).forEach((coach) => {
      if (coach.id && coach.name) coachNames.set(coach.id, coach.name);
    });
  }

  return data.flatMap((row: any) => {
    const occurrence = row.coach_availability_slot_occurrences;
    if (!occurrence?.occurrence_date || !occurrence.start_time || !occurrence.end_time) return [];

    const mapped = mapRPCResponseToSessionUI(
      {
        booking_id: row.id,
        slot_id: occurrence.weekly_slot_id || occurrence.id,
        occurrence_id: occurrence.id,
        availability_id: '',
        coach_id: row.coach_id,
        coach_name: coachNames.get(row.coach_id) ?? null,
        athlete_count: 1,
        athletes_names: null,
        session_date: occurrence.occurrence_date,
        slot_start_time: occurrence.start_time,
        slot_end_time: occurrence.end_time,
        slot_duration: Number(occurrence.duration_minutes) || 0,
        slot_session_type: asSessionType(occurrence.session_type),
        slot_location: asLocation(occurrence.location),
        slot_session_name: occurrence.session_name || 'Coaching Session',
        slot_price: Number(occurrence.price) || 0,
        pillar_slot: null,
      },
      now
    );

    return [
      {
        ...mapped,
        dbStatus: (row.status === 'requested' ? 'requested' : 'pending_payment') as BookingStatus,
        paymentStatus: 'unpaid' as PaymentStatus,
        notes: row.notes ?? null,
      },
    ];
  });
}

/**
 * Camp days (bookings from a camp registration) read "Camp · <camp> · Day N" and carry the camp,
 * so lists can drop per-session price and pay actions. Sessions stay as they are if this fails.
 */
async function withCampDays(sessions: SessionUIModel[]): Promise<SessionUIModel[]> {
  const ids = [...new Set(sessions.map((session) => session.occurrenceId).filter((id): id is string => Boolean(id)))];
  if (!ids.length) return sessions;
  const { data, error } = await supabase
    .from('coach_availability_slot_occurrences')
    .select('id, camp_id, camp_day_index, camp:coach_packages!coach_availability_slot_occurrences_camp_id_fkey(package_name)')
    .in('id', ids)
    .not('camp_id', 'is', null);
  if (error || !Array.isArray(data) || !data.length) {
    if (error) console.warn('Camp days not labelled:', error);
    return sessions;
  }
  const camps = new Map(
    (data as unknown as { id: string; camp_id: string; camp_day_index: number | null; camp: { package_name: string | null } | null }[]).map(
      (row) => [row.id, row]
    )
  );
  return sessions.map((session) => {
    const row = session.occurrenceId ? camps.get(session.occurrenceId) : undefined;
    if (!row) return session;
    // Without the camp row (a hidden camp), the session name is the camp's name.
    const name = row.camp?.package_name || session.title;
    return {
      ...session,
      title: campDayTitle(name, row.camp_day_index),
      camp: { id: row.camp_id, name, dayIndex: row.camp_day_index ?? null },
    };
  });
}

/**
 * Get sessions for current user using optimized RPC function
 * Calls get_bookings_by_user_id with either athlete_id or coach_id
 * Returns only necessary fields for UI display
 */
export async function getMySessions(
  personaId: string,
  userRole: 'coach' | 'athlete'
): Promise<ApiResponse<SessionUIModel[]>> {
  try {
    // Validate input
    if (!personaId) {
      return {
        data: null,
        error: buildApiError('INVALID_USER_ID', 'Coach/Athlete ID is required', 400),
      };
    }

    if (!userRole || (userRole !== 'coach' && userRole !== 'athlete')) {
      return {
        data: null,
        error: buildApiError('INVALID_USER_ROLE', 'User role must be coach or athlete', 400),
      };
    }

    const now = new Date();
    
    // Call optimized RPC function with appropriate parameter
    // Only one of athlete_id_param or coach_id_param will be set
    // Note: Type assertion needed as RPC function may not be in generated types yet
    const response = await (supabase as any).rpc('get_bookings_by_user_id', {
      athlete_id_param: userRole === 'athlete' ? personaId : null,
      coach_id_param: userRole === 'coach' ? personaId : null,
    });
    
    const records = response.data as BookingRPCResponse[] | null;
    const error = response.error;

    if (error) {
      console.error('Error fetching sessions via RPC:', error);
      return {
        data: null,
        error: buildApiError(
          'FETCH_SESSIONS_ERROR',
          `Failed to fetch ${userRole} sessions: ${error.message}`,
          500,
          error
        ),
      };
    }

    // Validate response structure
    if (!Array.isArray(records)) {
      console.error('Invalid RPC response: expected array, got:', typeof records);
      return {
        data: null,
        error: buildApiError(
          'INVALID_RESPONSE',
          'Invalid response structure from RPC function',
          500
        ),
      };
    }

    // Map RPC response records to UI model
    let sessions: SessionUIModel[] = records.map((record) =>
      mapRPCResponseToSessionUI(record, now)
    );

    if (userRole === 'athlete') {
      const pending = await getPendingAthleteSessions(personaId, now);
      const seen = new Set(sessions.map((session) => session.bookingId));
      sessions = [...sessions, ...pending.filter((session) => !seen.has(session.bookingId))];
    }

    return { data: await withCampDays(sessions), error: null };
  } catch (error) {
    console.error('Unexpected error in getMySessions:', error);
    return {
      data: null,
      error: buildApiError(
        'UNKNOWN_ERROR',
        errorMessage(error, 'Failed to fetch sessions'),
        500,
        error
      ),
    };
  }
}

/**
 * Get sessions for a specific coach
 */
export async function getCoachSessions(coachId: string): Promise<ApiResponse<SessionUIModel[]>> {
  return getMySessions(coachId, 'coach');
}

/**
 * Get sessions for current athlete
 */
export async function getAthleteSessions(athleteId: string): Promise<ApiResponse<SessionUIModel[]>> {
  return getMySessions(athleteId, 'athlete');
}

/**
 * Cancel a session booking
 */
export async function cancelSession(
  sessionId: string,
  reason?: string
): Promise<ApiResponse<void>> {
  try {
    const now = new Date().toISOString();
    const { error } = await (supabase as any)
      .from('coach_slot_bookings' as any)
      .update({
        status: 'canceled',
        canceled_at: now,
        cancellation_reason: reason || null,
        updated_at: now,
      })
      .eq('id', sessionId);

    if (error) {
      return {
        data: null,
        error: buildApiError('CANCEL_SESSION_ERROR', error.message, 500, error),
      };
    }

    return { data: undefined, error: null };
  } catch (error) {
    return {
      data: null,
      error: buildApiError(
        'UNKNOWN_ERROR',
        errorMessage(error, 'Failed to cancel session'),
        500,
        error
      ),
    };
  }
}

/**
 * Session Feedback API Functions
 * Backend integration for coach session feedback screen
 */

/**
 * Get session feedback data including athletes, attendance, and feedback
 */
export async function getCoachSessionFeedbackScreen(
  slotId: string
): Promise<ApiResponse<any[]>> {
  try {
    const { data, error } = await supabase.rpc(
      'get_coach_session_feedback_screen_v2' as any,
      {
        p_slot_id: slotId,
      }
    );

    if (error) {
      return {
        data: null,
        error: buildApiError('GET_FEEDBACK_DATA_ERROR', error.message, 500, error),
      };
    }

    return { data: (data || []) as any[], error: null };
  } catch (error) {
    return {
      data: null,
      error: buildApiError(
        'UNKNOWN_ERROR',
        errorMessage(error, 'Failed to fetch session feedback data'),
        500,
        error
      ),
    };
  }
}

/**
 * Upsert attendance records for athletes in a slot
 */
export async function upsertSlotAttendance(
  payload: Array<{
    booking_id: string;
    slot_id: string;
    athlete_id: string;
    attendance: 'present' | 'absent';
    reason_absent?: string | null;
  }>
): Promise<ApiResponse<void>> {
  try {
    const { error } = await supabase.rpc(
      'upsert_slot_attendance_v2' as any,
      {
        p_attendance_records: payload,
      }
    );

    if (error) {
      return {
        data: null,
        error: buildApiError('UPSERT_ATTENDANCE_ERROR', error.message, 500, error),
      };
    }

    return { data: undefined, error: null };
  } catch (error) {
    return {
      data: null,
      error: buildApiError(
        'UNKNOWN_ERROR',
        errorMessage(error, 'Failed to save attendance'),
        500,
        error
      ),
    };
  }
}

/**
 * Upsert feedback for athletes in a slot
 */
export async function upsertSlotFeedback(
  payload: Array<{
    booking_id: string;
    slot_id: string;
    athlete_id: string;
    coach_id?: string;
    rating?: number | null;
    comment?: string | null;
    coach_rating_of_athlete?: number | null;
    highlighted_skills?: string[] | null;
    feedback_to_athlete?: string | null;
    coach_only_notes?: string | null;
  }>
): Promise<ApiResponse<void>> {
  try {
    const { error } = await supabase.rpc(
      'upsert_slot_feedback_v2' as any,
      {
        p_feedback_records: payload,
      }
    );

    if (error) {
      return {
        data: null,
        error: buildApiError('UPSERT_FEEDBACK_ERROR', error.message, 500, error),
      };
    }

    return { data: undefined, error: null };
  } catch (error) {
    return {
      data: null,
      error: buildApiError(
        'UNKNOWN_ERROR',
        errorMessage(error, 'Failed to save feedback'),
        500,
        error
      ),
    };
  }
}

/**
 * Get existing athlete feedback for a booking
 */
export async function getExistingFeedback(
 bookingId: string,
 athleteId: string,
  coachId?: string
): Promise<
  ApiResponse<{
    rating: number | null;
    comment: string | null;
    created_at: string;
    feedback_to_athlete: string | null;
    athlete_rated_at: string | null;
    edit_count: number | null;
  } | null>
> {
  try {
    let query = supabase
      .from('slot_feedback_v2' as any)
      .select('rating, comment, created_at, feedback_to_athlete, athlete_rated_at, edit_count')
      .eq('booking_id', bookingId)
      .eq('athlete_id', athleteId);

    // Optional extra guard to ensure the feedback is for this coach
    if (coachId) {
      query = query.eq('coach_id', coachId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      return {
        data: null,
        error: buildApiError('GET_FEEDBACK_ERROR', error.message, 500, error),
      };
    }

    return { data: data as any, error: null };
  } catch (error) {
    return {
      data: null,
      error: buildApiError(
        'UNKNOWN_ERROR',
        errorMessage(error, 'Failed to fetch existing feedback'),
        500,
        error
      ),
    };
  }
}

/**
 * Get all submitted feedback entries for an athlete
 * Returns slot/booking ids so UI can mark feedback as submitted without opening dialog
 */
export async function getSubmittedFeedbackIds(
  athleteId: string
): Promise<ApiResponse<{ slot_id: string | null; booking_id: string | null }[]>> {
  try {
    const { data, error } = await supabase
      .from('slot_feedback_v2' as any)
      .select('slot_id, booking_id')
      .eq('athlete_id', athleteId)
      .not('athlete_rated_at', 'is', null);

    if (error) {
      return {
        data: null,
        error: buildApiError('GET_FEEDBACK_IDS_ERROR', error.message, 500, error),
      };
    }

    return { data: (data as any) || [], error: null };
  } catch (error) {
    return {
      data: null,
      error: buildApiError(
        'UNKNOWN_ERROR',
        errorMessage(error, 'Failed to fetch submitted feedback'),
        500,
        error
      ),
    };
  }
}

/**
 * Get submitted session feedback entries for a coach
 * Used to pre-mark slots as completed in coach views
 */
export async function getCoachSubmittedSessionIds(
  coachId: string
): Promise<ApiResponse<{ slot_id: string | null; rating: number | null }[]>> {
  try {
    const { data, error } = await supabase
      .from('session_feedback_v2' as any)
      .select('slot_id, rating')
      .eq('coach_id', coachId)
      .eq('status', 'submitted')
      .not('rating', 'is', null)
      .gt('rating', 0);

    if (error) {
      return {
        data: null,
        error: buildApiError('GET_COACH_FEEDBACK_IDS_ERROR', error.message, 500, error),
      };
    }

    return { data: (data as any) || [], error: null };
  } catch (error) {
    return {
      data: null,
      error: buildApiError(
        'UNKNOWN_ERROR',
        errorMessage(error, 'Failed to fetch coach session feedback'),
        500,
        error
      ),
    };
  }
}

/**
 * Get athlete-level feedback submissions for a coach
 * Useful to pre-mark slots as submitted on coach views when only slot_feedback_v2 exists
 */
export async function getCoachSlotFeedbackIds(
  coachId: string
): Promise<ApiResponse<{ slot_id: string | null; booking_id: string | null }[]>> {
  try {
    const { data, error } = await supabase
      .from('slot_feedback_v2' as any)
      .select('slot_id, booking_id')
      .eq('coach_id', coachId);

    if (error) {
      return {
        data: null,
        error: buildApiError('GET_COACH_SLOT_FEEDBACK_IDS_ERROR', error.message, 500, error),
      };
    }

    return { data: (data as any) || [], error: null };
  } catch (error) {
    return {
      data: null,
      error: buildApiError(
        'UNKNOWN_ERROR',
        errorMessage(error, 'Failed to fetch coach slot feedback'),
        500,
        error
      ),
    };
  }
}

/**
 * Upsert overall session feedback
 */
export async function upsertSessionFeedback(payload: {
  slot_id: string;
  session_rating: number;
  session_summary?: string | null;
  coach_notes?: string | null;
}): Promise<ApiResponse<void>> {
  try {
    const { error } = await supabase.rpc(
      'upsert_session_feedback_v2' as any,
      {
        p_slot_id: payload.slot_id,
        p_rating: payload.session_rating,
        p_summary: payload.session_summary ?? null,
      }
    );

    if (error) {
      return {
        data: null,
        error: buildApiError('UPSERT_SESSION_FEEDBACK_ERROR', error.message, 500, error),
      };
    }

    return { data: undefined, error: null };
  } catch (error) {
    return {
      data: null,
      error: buildApiError(
        'UNKNOWN_ERROR',
        errorMessage(error, 'Failed to save session feedback'),
        500,
        error
      ),
    };
  }
}
