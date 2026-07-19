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
