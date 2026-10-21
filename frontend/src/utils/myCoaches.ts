/**
 * Who shows in the family's "Coaches" card on Home. Mirrors athlete_coach_ids() in
 * 20261021170000_athlete_hidden_coaches.sql: a coach shows once there's a confirmed session
 * (booked, completed or marked missed), a package with them or an accepted invite. A pending
 * request, an unpaid offer, a cancelled session or an intro call on its own doesn't count.
 * A coach the family removed stays hidden until they book or buy a package with them again.
 */

export const CONFIRMED_BOOKING_STATUSES = ["booked", "completed", "no_show"] as const;

export const isConfirmedBooking = (status: string | null | undefined) =>
  (CONFIRMED_BOOKING_STATUSES as readonly string[]).includes(status ?? "");

export interface CoachLink {
  bookingStatuses: string[];
  /** A package with this coach that wasn't revoked. */
  hasPackage: boolean;
  /** A confirmed invite (coach_client_referrals). */
  acceptedInvite: boolean;
  /** Intro calls don't count on their own; listed so callers can pass everything they know. */
  introCalls?: number;
  hidden: boolean;
}

export const showsAsMyCoach = (link: CoachLink) =>
  !link.hidden && (link.bookingStatuses.some(isConfirmedBooking) || link.hasPackage || link.acceptedInvite);

/** Drops one coach from a list right away (Remove), so the card updates before the refetch. */
export const withoutCoach = <T extends { id: string }>(coaches: T[], coachId: string) => coaches.filter((c) => c.id !== coachId);

export const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] || name;

export const removeCoachQuestion = (name: string) => `Remove ${name} from your coaches?`;
export const REMOVE_COACH_NOTE = "Your past sessions and messages stay. You can book them again any time.";
