/**
 * Session API Types for coach_slot_bookings
 * Centralized type definitions matching the actual database schema
 */

/**
 * Session status values from coach_slot_bookings.status
 */
export type BookingStatus = 'requested' | 'pending_payment' | 'booked' | 'completed' | 'canceled' | 'no_show' | 'refunded';

/**
 * Session type from coach_slot_bookings.session_type
 */
export type SessionTypeValue = 'individual' | 'group';

/**
 * Canonical session type enum sourced from DB column coach_slot_bookings.session_type
 */
export const SESSION_TYPE_DB = {
  INDIVIDUAL: 'individual' as SessionTypeValue,
  GROUP: 'group' as SessionTypeValue,
} as const;

/**
 * Location type from coach_slot_bookings.location
 */
export type LocationTypeValue = 'online' | 'in-person';

/**
 * Payment status from coach_slot_bookings.payment_status
 */
export type PaymentStatus = 'unpaid' | 'requires_action' | 'paid' | 'refunded';

/**
 * UI-computed session status (different from DB status)
 */
export type ComputedSessionStatus = 'in-progress' | 'upcoming' | 'past' | 'completed' | 'canceled';

/**
 * Raw database record from coach_slot_bookings table
 * Note: This is used for the full database record when needed
 */
export interface CoachSlotBooking {
  id: string;
  slot_id: string;
  availability_id: string;
  coach_id: string;
  athlete_id: string;
  occurrence_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm format
  end_time: string; // HH:mm format
  duration_minutes: number;
  session_type: SessionTypeValue;
  service_type: string;
  location: LocationTypeValue;
  price: number;
  currency: string;
  status: BookingStatus;
  payment_status: PaymentStatus;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  notes: string | null;
  slot_override_id: string | null;
  canceled_at: string | null;
  cancellation_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Optimized RPC response from get_bookings_by_user_id
 * Contains only the necessary fields for UI display
 * Note: session_date is automatically calculated by database trigger
 */
export interface BookingRPCResponse {
  booking_id: string;
  slot_id: string;
  occurrence_id?: string | null;
  availability_id: string;
  coach_id: string;
  coach_name?: string | null;
  athlete_count: number; // Number of athletes booked for this slot
  athletes_names: string[] | null; // Array of athlete names booked for this slot
  session_date: string; // YYYY-MM-DD (automatically calculated by trigger)
  slot_start_time: string; // HH:MM:SS
  slot_end_time: string; // HH:MM:SS
  slot_duration: number; // minutes
  slot_session_type: SessionTypeValue;
  slot_location: LocationTypeValue;
  slot_session_name: string;
  slot_price: number;
  pillar_slot: string | null;
  has_session_feedback?: boolean;
  has_slot_feedback?: boolean;
}

/**
 * UI-ready session model for display in components
 */
export interface SessionUIModel {
  bookingId: string;
  id: string;
  /** Original slot identifier for matching feedback submissions */
  slotId?: string;
  /** Optional occurrence identifier when provided by scheduling */
  occurrenceId?: string | null;
  coachName?: string | null;
  title: string;
  type: SessionTypeValue;
  computedStatus: ComputedSessionStatus;
  dbStatus: BookingStatus;
  paymentStatus: PaymentStatus;
  start: string; // ISO 8601 datetime (occurrence_date + start_time)
  end: string; // ISO 8601 datetime (occurrence_date + end_time)
  dateOnly: string; // YYYY-MM-DD
  timeRange: string; // "HH:mm - HH:mm"
  location: LocationTypeValue;
  rate: number;
  currency: string;
  coachId: string;
  durationMinutes: number;
  notes: string | null;
  stripeSessionId: string | null;
  pillarSlot: string | null; // e.g., "Academic tutoring"
  athleteCount: number; // Number of athletes booked for this slot
  athleteNames: string[] | null; // Array of athlete names booked for this slot
  athleteNamesDisplay: string; // Formatted string for display: "John, Jane, Bob" or single name
  hasSessionFeedback?: boolean; // True when a coach-level session_feedback_v2 entry exists
  hasSlotFeedback?: boolean; // True when an athlete has submitted slot-level feedback
}

/**
 * Filter options for sessions
 */
export interface SessionFilters {
  search?: string;
  date?: string;
  type?: 'all' | 'individual' | 'group';
  status?: 'all' | 'in-progress' | 'upcoming' | 'past';
  locationType?: 'all' | 'online' | 'in-person';
  pillar?: string; // pillar name or 'all'
}

/**
 * Session grouping result
 */
export interface SessionGrouped {
  inProgress: SessionUIModel[];
  upcoming: SessionUIModel[];
  past: SessionUIModel[];
  completed: SessionUIModel[];
  canceled: SessionUIModel[];
}

/**
 * API response wrapper
 */
export interface GetSessionsResponse {
  data: SessionUIModel[] | null;
  error: {
    code: string;
    message: string;
    status: number;
  } | null;
}
