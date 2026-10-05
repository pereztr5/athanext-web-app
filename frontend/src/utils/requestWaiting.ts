/**
 * Booking request holds (ATH-71). A request is held for 24 hours, or until 10 minutes after
 * the session starts if that's sooner, then it expires on its own.
 */

/** Requests with less than this left are flagged so the coach answers them. */
export const REQUEST_EXPIRING_HOURS = 6;

/** Whole minutes until the hold ends (0 once expired or unknown). */
export const minutesLeft = (expiresAt: string | null | undefined, now: Date = new Date()): number => {
  if (!expiresAt) return 0;
  const end = Date.parse(expiresAt);
  if (isNaN(end)) return 0;
  return Math.max(0, Math.floor((end - now.getTime()) / 60_000));
};

export const isRequestExpiringSoon = (expiresAt: string | null | undefined, now: Date = new Date()): boolean => {
  if (!expiresAt) return false;
  return minutesLeft(expiresAt, now) < REQUEST_EXPIRING_HOURS * 60;
};

/** "Expires in 5h" / "Expires in 40 min" / "Expiring". */
export const formatExpiry = (expiresAt: string | null | undefined, now: Date = new Date()): string => {
  if (!expiresAt) return "Waiting";
  const minutes = minutesLeft(expiresAt, now);
  if (minutes <= 0) return "Expiring";
  if (minutes < 60) return `Expires in ${minutes} min`;
  return `Expires in ${Math.floor(minutes / 60)}h`;
};

export const countExpiringSoon = (
  requests: { expiresAt: string | null }[],
  now: Date = new Date()
): number => requests.filter((request) => isRequestExpiringSoon(request.expiresAt, now)).length;
