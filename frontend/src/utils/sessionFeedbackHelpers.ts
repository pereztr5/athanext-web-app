/**
 * Session Feedback Helper Utilities
 * Data transformation and payload builders for session feedback
 */

/**
 * Athlete type for session feedback UI
 */
export type SessionFeedbackAthlete = {
  id: string;
  name: string;
  role: string;
  age: string;
  level?: string;
  avatar?: string;
  bio?: string;
  interests?: string[];
  hometown?: string;
  school?: string;
  goals?: string;
};

/**
 * RPC row type from get_coach_session_feedback_screen
 */
export type SessionFeedbackRPCRow = {
  booking_id: string;
  slot_id: string;
  athlete_id: string;
  athlete_name: string;
  athlete_position: string | null;
  athlete_age: string | null;
  athlete_level: string | null;
  athlete_avatar: string | null;
  athlete_bio: string | null;
  athlete_interests: string[] | null;
  athlete_hometown: string | null;
  athlete_school: string | null;
  athlete_goals: string | null;
  attendance: 'present' | 'absent' | null;
  reason_absent: string | null;
  rating: number | null;
  comment: string | null;
  coach_rating_of_athlete: number | null;
  highlighted_skills: string[] | null;
  feedback_to_athlete: string | null;
  coach_only_notes: string | null;
  session_rating: number | null;
  session_summary: string | null;
  coach_notes: string | null;
  edit_count?: number | null;
  coach_edit_count?: number | null;
  session_edit_count?: number | null;
  // Session metadata fields
  slot_session_name?: string | null;
  session_name?: string | null;
  slot_location?: string | null;
  location?: string | null;
  slot_price?: number | null;
  price?: number | null;
  session_date?: string | null;
  slot_start_time?: string | null;
  start_time?: string | null;
  slot_end_time?: string | null;
  end_time?: string | null;
  pillar_slot?: string | null;
  feedback_completed?: boolean | null;
};

/**
 * Map RPC row to athlete UI model
 */
export function mapRpcRowToAthlete(row: SessionFeedbackRPCRow): SessionFeedbackAthlete {
  return {
    id: row.athlete_id,
    name: row.athlete_name,
    role: row.athlete_position || 'Athlete',
    age: row.athlete_age || 'N/A',
    level: row.athlete_level || undefined,
    avatar: row.athlete_avatar || undefined,
    bio: row.athlete_bio || undefined,
    interests: row.athlete_interests || undefined,
    hometown: row.athlete_hometown || undefined,
    school: row.athlete_school || undefined,
    goals: row.athlete_goals || undefined,
  };
}

/**
 * Build attendance payload for bulk upsert
 */
export function buildAttendancePayload(
  bookingId: string,
  slotId: string,
  athleteId: string,
  attendance: 'present' | 'absent',
  reasonAbsent?: string
) {
  return {
    booking_id: bookingId,
    slot_id: slotId,
    athlete_id: athleteId,
    attendance,
    reason_absent: attendance === 'absent' && reasonAbsent ? reasonAbsent : null,
  };
}

/**
 * Build feedback payload for individual athlete
 */
export function buildFeedbackPayload(
  bookingId: string,
  slotId: string,
  athleteId: string,
  data: {
    rating?: number;
    highlightedSkills?: string[];
    feedbackToAthlete?: string;
    coachOnlyNotes?: string;
  }
) {
  const highlightedSkills =
    data.highlightedSkills === undefined
      ? undefined
      : data.highlightedSkills.length > 0
      ? data.highlightedSkills
      : null;

  return {
    booking_id: bookingId,
    slot_id: slotId,
    athlete_id: athleteId,
    coach_rating_of_athlete: data.rating && data.rating >= 1 ? data.rating : null,
    ...(highlightedSkills !== undefined ? { highlighted_skills: highlightedSkills } : {}),
    feedback_to_athlete: data.feedbackToAthlete?.trim() || null,
    coach_only_notes: data.coachOnlyNotes?.trim() || null,
  };
}

/**
 * Build session feedback payload
 */
export function buildSessionFeedbackPayload(
  slotId: string,
  sessionRating: number,
  sessionSummary?: string,
  coachNotes?: string
) {
  return {
    slot_id: slotId,
    session_rating: sessionRating,
    session_summary: sessionSummary?.trim() || null,
    coach_notes: coachNotes?.trim() || null,
  };
}

/**
 * Get initials from name (utility)
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
