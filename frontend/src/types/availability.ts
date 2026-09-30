/**
 * Coach Availability Types
 * Types for managing coach availability scheduling feature
 */

export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1=Monday, 7=Sunday
export type SessionType = 'individual' | 'group';
export type LocationType = 'online' | 'in-person';
export type PillarSlot = string | null;

/**
 * Single time slot for a coach on a specific day
 */
export interface CoachAvailabilitySlot {
  id: string;
  weekly_slot_id?: string;
  day_of_week: DayOfWeek;
  session_name: string;
  price: number;
  duration_minutes: 30 | 45 | 60 | 90 | 120 | 180;
  start_time: string; // HH:mm format
  end_time: string; // HH:mm format
 session_type: SessionType;
  location: LocationType;
  pillar_slot?: PillarSlot;
  is_enabled: boolean;
  max_bookings_per_slot?: number | null;
  occurrence_date?: string;
  occurrence_id?: string;
}

/**
 * Aggregated booking state for a slot
 */
export interface SlotBookingStatus {
  isFull: boolean;
  bookedByMe: boolean;
  hasPendingPayment: boolean;
  myPendingPayment: boolean;
  /** The viewer asked for this slot and the coach hasn't answered yet (ATH-49). */
  myRequested?: boolean;
  totalCount: number;
  capacity: number;
}

/**
 * Availability period with associated slots
 */
export interface CoachAvailability {
  id: string;
  coach_id: string;
  start_date: string; // YYYY-MM-DD format
  end_date: string; // YYYY-MM-DD format
  /** Repeats weekly with no end date; end_date is how far occurrences are generated (ATH-28). */
  repeats_weekly?: boolean;
  slots: CoachAvailabilitySlot[];
  created_at: string;
  updated_at: string;
}

/**
 * Form data for managing availability
 */
export interface AvailabilityFormData {
  start_date: Date;
  end_date: Date;
  slots: Record<DayOfWeek, Array<SlotFormData>>;
}

/**
 * Individual slot form data
 */
export interface SlotFormData {
  day_of_week: DayOfWeek;
  is_enabled: boolean;
  session_name: string;
  price: number;
  duration_minutes: 30 | 45 | 60 | 90 | 120 | 180;
  start_time: string; // HH:mm format
  end_time: string; // HH:mm format
  session_type: SessionType;
  location: LocationType;
  pillar_slot?: PillarSlot;
  occurrence_date?: string; // YYYY-MM-DD when editing per-date slots
  occurrence_id?: string; // concrete occurrence row id for edit-mode locking
  max_bookings_per_slot?: number | null;
}

/**
 * Validation errors for availability form
 */
export interface AvailabilityValidationErrors {
  dateRange?: string;
  general?: string;
  slots?: Partial<Record<DayOfWeek, Array<SlotValidationError | null>>>;
  overlap?: string;
}

/**
 * Validation errors for individual slot
 */
export interface SlotValidationError {
  session_name?: string;
  price?: string;
  duration_minutes?: string;
  start_time?: string;
  end_time?: string;
  time_range?: string;
  overlap?: string;
  pillar_slot?: string;
}

/**
 * API request/response types
 */
export interface CreateAvailabilityRequest {
  coach_id: string;
  start_date: string;
  end_date: string;
  slots: Array<Omit<SlotFormData, 'day_of_week'> & { day_of_week: DayOfWeek }>;
}

export interface UpdateAvailabilityRequest {
  availability_id: string;
  slots: CoachAvailabilitySlot[];
}

/**
 * Day mapping for UI display
 */
export const DAY_OF_WEEK_MAP: Record<DayOfWeek, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

/**
 * Duration options
 */
export const DURATION_OPTIONS = [30, 45, 60, 90, 120, 180] as const;

/**
 * Session type options
 */
export const SESSION_TYPE_OPTIONS: SessionType[] = ['individual', 'group'];

/**
 * Location type options
 */
export const LOCATION_TYPE_OPTIONS: LocationType[] = ['online', 'in-person'];

/**
 * One-off override for a specific date for a base slot
 */
export interface CoachAvailabilitySlotOverride {
  id: string;
  slot_id: string;
  override_date: string; // YYYY-MM-DD
  session_name?: string | null;
  pillar_slot?: PillarSlot;
  price?: number | null;
  duration_minutes?: number | null;
  start_time?: string | null; // HH:mm
  end_time?: string | null; // HH:mm
  session_type?: SessionType | null;
  location?: LocationType | null;
  
  is_enabled?: boolean | null;
  created_at: string;
  updated_at: string;
}
