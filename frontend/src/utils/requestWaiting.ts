/**
 * Booking request reminders (ATH-28). Requests are never auto-cancelled; once one has
 * waited a day the coach sees it flagged in the app.
 */

export const REQUEST_REMINDER_HOURS = 24;

/** Whole hours since the request was made (0 when unknown or in the future). */
export const hoursWaiting = (requestedAt: string | null | undefined, now: Date = new Date()): number => {
  if (!requestedAt) return 0;
  const since = Date.parse(requestedAt);
  if (isNaN(since)) return 0;
  return Math.max(0, Math.floor((now.getTime() - since) / 3_600_000));
};

export const isRequestOverdue = (requestedAt: string | null | undefined, now: Date = new Date()): boolean =>
  hoursWaiting(requestedAt, now) >= REQUEST_REMINDER_HOURS;

/** "Waiting 5h" / "Waiting 2 days". */
export const formatWaiting = (hours: number): string => {
  if (hours < 1) return "Just now";
  if (hours < 48) return `Waiting ${hours}h`;
  return `Waiting ${Math.floor(hours / 24)} days`;
};

export const countOverdueRequests = (
  requests: { requestedAt: string | null }[],
  now: Date = new Date()
): number => requests.filter((request) => isRequestOverdue(request.requestedAt, now)).length;
