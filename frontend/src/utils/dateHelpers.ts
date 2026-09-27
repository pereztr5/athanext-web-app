/**
 * Date helper utilities for availability management
 */

/**
 * Get the start of the week (Monday) for a given date
 */
export const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

/**
 * Format date range for week display
 */
export const formatWeekRange = (weekStart: Date): string => {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${weekStart.toLocaleDateString('en-US', options)} - ${weekEnd.toLocaleDateString('en-US', options)}`;
};

/**
 * Returns today's date as YYYY-MM-DD (local timezone)
 */
export const getTodayISODate = (): string => {
  const now = new Date();
  return toLocalISODate(now);
};

/**
 * Parse YYYY-MM-DD into a local Date (no UTC shift).
 */
export const parseISODateLocal = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

/**
 * Parse HH:mm or HH:mm:ss into local time parts.
 */
export const parseLocalTimeParts = (time: string): [number, number, number] => {
  const [hours = '0', minutes = '0', seconds = '0'] = time.split(':');
  return [
    Number.parseInt(hours, 10) || 0,
    Number.parseInt(minutes, 10) || 0,
    Number.parseInt(seconds, 10) || 0,
  ];
};

/**
 * Build a local datetime from YYYY-MM-DD and HH:mm / HH:mm:ss values.
 */
export const buildLocalDateTime = (isoDate: string, time: string): Date => {
  const date = parseISODateLocal(isoDate);
  const [hours, minutes, seconds] = parseLocalTimeParts(time);
  date.setHours(hours, minutes, seconds, 0);
  return date;
};

/**
 * Returns true when the slot start time has been reached or passed.
 */
export const hasSlotStarted = (
  isoDate?: string | null,
  startTime?: string | null,
  now = new Date()
): boolean => {
  if (!isoDate || !startTime) return false;
  return buildLocalDateTime(isoDate, startTime).getTime() <= now.getTime();
};

/** Sessions are scheduled in US Eastern. This zone covers both EST and EDT. */
export const SESSION_TIME_ZONE = "America/New_York";

/** Public booking stays open until this long after the session start. */
export const BOOKING_GRACE_AFTER_START_MS = 10 * 60 * 1000;

const readZonedParts = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "0";
  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    hour: Number(value("hour")) % 24,
    minute: Number(value("minute")),
    second: Number(value("second")),
  };
};

/**
 * Interpret a calendar date and clock time as wall time in `timeZone`.
 * The same helper is duplicated in the booking payment function.
 */
export const zonedWallTimeToUtc = (
  isoDate: string,
  time: string,
  timeZone = SESSION_TIME_ZONE
): Date | null => {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return null;
  const [hour, minute, second] = parseLocalTimeParts(time);
  const desiredUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let instant = desiredUtc;
  for (let pass = 0; pass < 2; pass += 1) {
    const zoned = readZonedParts(new Date(instant), timeZone);
    const zonedAsUtc = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second
    );
    instant = desiredUtc - (zonedAsUtc - instant);
  }
  return new Date(instant);
};

export const getZonedISODate = (date: Date, timeZone = SESSION_TIME_ZONE): string => {
  const zoned = readZonedParts(date, timeZone);
  const month = String(zoned.month).padStart(2, "0");
  const day = String(zoned.day).padStart(2, "0");
  return `${zoned.year}-${month}-${day}`;
};

/**
 * Public booking closes once Eastern start time plus the grace period has passed.
 * A same-day slot that has not reached that point stays open.
 */
export const isBookingWindowClosed = (
  isoDate?: string | null,
  startTime?: string | null,
  now = new Date()
): boolean => {
  if (!isoDate || !startTime) return false;
  const start = zonedWallTimeToUtc(isoDate, startTime);
  if (!start) return false;
  return now.getTime() > start.getTime() + BOOKING_GRACE_AFTER_START_MS;
};

/**
 * Convert a Date to YYYY-MM-DD using local calendar values.
 */
export const toLocalISODate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Format date as "Mon D, YYYY" using local time.
 */
export const formatDate = (iso: string): string => {
  const date = new Date(iso);
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};
