/**
 * My Schedule layout (ATH-71). Sessions are stored as Eastern date + time and shown in the
 * coach's own zone, so a session is placed on the day it falls on in that zone.
 */
import type { BusyBlock, ScheduleSession, TimeOffDay } from "@/api/schedule";
import { coachProfilePath } from "@/utils/coachSlug";
import { SESSION_TIME_ZONE, getZonedISODate, zonedWallTimeToUtc } from "@/utils/dateHelpers";

export type ScheduleItemKind = "booked" | "group" | "request" | "offered" | "open" | "busy";

export interface ScheduleItem {
  key: string;
  kind: ScheduleItemKind;
  start: Date;
  end: Date;
  /** Null for busy times. */
  session: ScheduleSession | null;
}

export interface ScheduleDay {
  date: string;
  items: ScheduleItem[];
  dayOff: TimeOffDay | null;
}

const LIVE = new Set(["requested", "pending_payment", "booked", "completed", "no_show"]);
const BOOKED = new Set(["pending_payment", "booked", "completed", "no_show"]);

const parseISODateUtc = (iso: string): Date => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
};

/** Calendar arithmetic on YYYY-MM-DD strings, independent of the runtime zone. */
export const addDaysISO = (iso: string, days: number): string => {
  const date = parseISODateUtc(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** Monday of the week containing `iso`. */
export const weekStartISO = (iso: string): string => {
  const day = parseISODateUtc(iso).getUTCDay();
  return addDaysISO(iso, day === 0 ? -6 : 1 - day);
};

/** ISO weekday of a date, 1 = Monday. */
export const isoWeekday = (iso: string): number => {
  const day = parseISODateUtc(iso).getUTCDay();
  return day === 0 ? 7 : day;
};

export const weekDates = (weekStart: string): string[] =>
  Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));

export const monthStartISO = (iso: string): string => `${iso.slice(0, 7)}-01`;

export const addMonthsISO = (monthStart: string, months: number): string => {
  const date = parseISODateUtc(monthStart);
  date.setUTCMonth(date.getUTCMonth() + months, 1);
  return date.toISOString().slice(0, 10);
};

/** Month grid, Monday first: null for leading blanks, then each date of the month. */
export const monthGrid = (monthStart: string): (string | null)[] => {
  const start = parseISODateUtc(monthStart);
  const daysInMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  const lead = isoWeekday(monthStart) - 1;
  return [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => addDaysISO(monthStart, i)),
  ];
};

/** "Mon", "Tue", ... for an ISO date. */
export const formatDayISO = (iso: string, options: Intl.DateTimeFormatOptions): string =>
  parseISODateUtc(iso).toLocaleDateString("en-US", { ...options, timeZone: "UTC" });

/** Minutes after midnight of `date` on the clock in `timeZone`. */
export const minutesInZone = (date: Date, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return (get("hour") % 24) * 60 + get("minute");
};

const pad = (n: number) => String(n).padStart(2, "0");
export const minutesToHHMM = (minutes: number): string => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

/** "4:00 pm" for minutes after midnight. */
export const formatMinutes = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? "pm" : "am"}`;
};

/** "4:00 pm" for an instant in `timeZone`. */
export const formatClock = (date: Date, timeZone: string): string => formatMinutes(minutesInZone(date, timeZone));

/** A day + clock time in the viewer's zone, as the Eastern date and "HH:MM" sessions are stored in. */
export const viewerToEastern = (date: string, minutes: number, timeZone: string): { date: string; start: string } => {
  const instant = zonedWallTimeToUtc(date, `${minutesToHHMM(minutes)}:00`, timeZone) ?? new Date(NaN);
  return {
    date: getZonedISODate(instant, SESSION_TIME_ZONE),
    start: minutesToHHMM(minutesInZone(instant, SESSION_TIME_ZONE)),
  };
};

export const sessionStart = (session: Pick<ScheduleSession, "date" | "startTime">): Date =>
  zonedWallTimeToUtc(session.date, session.startTime) ?? new Date(NaN);

export const sessionEnd = (session: Pick<ScheduleSession, "date" | "endTime">): Date =>
  zonedWallTimeToUtc(session.date, session.endTime) ?? new Date(NaN);

export const liveBookings = (session: ScheduleSession) => session.bookings.filter((b) => LIVE.has(b.status));
export const bookedAthletes = (session: ScheduleSession) => session.bookings.filter((b) => BOOKED.has(b.status));
export const requestsFor = (session: ScheduleSession) => session.bookings.filter((b) => b.status === "requested");

/** What a session shows as on the calendar. */
export const sessionKind = (session: ScheduleSession): Exclude<ScheduleItemKind, "busy"> => {
  if (session.sessionType === "group") return "group";
  if (bookedAthletes(session).length) return "booked";
  if (requestsFor(session).length) return "request";
  return session.visibility === "offered" ? "offered" : "open";
};

const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => aStart < bEnd && bStart < aEnd;

/**
 * Items per day for `dates` in the viewer's zone. Open slots that have started, or that a
 * Google Calendar busy time covers, are left out: families can't book them either.
 */
export const layoutDays = ({
  dates,
  sessions,
  busy,
  timeOff,
  timeZone,
  now = new Date(),
}: {
  dates: string[];
  sessions: ScheduleSession[];
  busy: BusyBlock[];
  timeOff: TimeOffDay[];
  timeZone: string;
  now?: Date;
}): ScheduleDay[] => {
  const busyRanges = busy.map((b) => ({ start: new Date(b.startsAt), end: new Date(b.endsAt) }));
  const byDate = new Map<string, ScheduleItem[]>(dates.map((d) => [d, []]));

  const place = (item: ScheduleItem) => {
    byDate.get(getZonedISODate(item.start, timeZone))?.push(item);
  };

  sessions.forEach((session) => {
    // Planner drafts stay off My Schedule / Create session until published.
    if (session.isDraft) return;
    const start = sessionStart(session);
    const end = sessionEnd(session);
    if (isNaN(start.getTime())) return;
    const kind = sessionKind(session);
    if (kind === "open") {
      if (start <= now) return;
      if (busyRanges.some((b) => overlaps(start, end, b.start, b.end))) return;
    }
    place({ key: session.id, kind, start, end, session });
  });

  busyRanges.forEach((b, i) => place({ key: `busy-${i}`, kind: "busy", start: b.start, end: b.end, session: null }));

  return dates.map((date) => ({
    date,
    items: (byDate.get(date) ?? []).sort((a, b) => a.start.getTime() - b.start.getTime()),
    dayOff: timeOff.find((t) => t.date === date) ?? null,
  }));
};

/** Start times offered in Create session: afternoons on weekdays, mornings at weekends. */
export const suggestedStartMinutes = (date: string): number[] => {
  const weekend = isoWeekday(date) >= 6;
  const first = weekend ? 8 * 60 : 15 * 60;
  return Array.from({ length: 12 }, (_, i) => first + i * 30);
};

/** Every quarter hour from 6:00 AM to 9:00 PM, for "Other". */
export const ALL_START_MINUTES = Array.from({ length: 61 }, (_, i) => 6 * 60 + i * 15);

/**
 * The item already holding `minutes`..`minutes + duration` on `day`, if any. Open slots
 * only block another open slot; a new session takes over an open slot's time.
 */
export const itemAt = (
  day: ScheduleDay | undefined,
  minutes: number,
  duration: number,
  timeZone: string,
  creatingOpen: boolean
): ScheduleItem | null => {
  if (!day) return null;
  const startMin = minutes;
  const endMin = minutes + duration;
  return (
    day.items.find((item) => {
      if (item.kind === "open" && !creatingOpen) return false;
      const a = minutesInZone(item.start, timeZone);
      const b = a + Math.round((item.end.getTime() - item.start.getTime()) / 60000);
      return a < endMin && startMin < b;
    }) ?? null
  );
};

/** "2 hours" / "45 min". */
export const formatDuration = (minutes: number): string =>
  minutes % 60 === 0 ? `${minutes / 60} hour${minutes === 60 ? "" : "s"}` : `${minutes} min`;

export const plural = (count: number, word: string, pluralWord = `${word}s`) =>
  `${count} ${count === 1 ? word : pluralWord}`;

export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Booking link for one session: the coach's profile opens straight into booking it. */
export const sessionLink = (slug: string | null, coachId: string, sessionId: string) =>
  `${window.location.origin}${coachProfilePath(slug || coachId)}?session=${sessionId}`;

/** "September 2026", "Sep – Oct 2026" or "Dec 2026 – Jan 2027" for a run of ISO dates (ATH-84). */
export const monthRangeLabel = (dates: string[]): string => {
  if (!dates.length) return "";
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (first.slice(0, 7) === last.slice(0, 7)) return formatDayISO(first, { month: "long", year: "numeric" });
  if (first.slice(0, 4) === last.slice(0, 4)) {
    return `${formatDayISO(first, { month: "short" })} – ${formatDayISO(last, { month: "short" })} ${first.slice(0, 4)}`;
  }
  return `${formatDayISO(first, { month: "short", year: "numeric" })} – ${formatDayISO(last, { month: "short", year: "numeric" })}`;
};

/** "Central time (CT)" for the coach's zone; just the name when there's no short code. */
export const timeZonePillLabel = (timeZone: string, at = new Date()): string => {
  const part = (style: "longGeneric" | "shortGeneric") =>
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: style })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value ?? "";
  const long = part("longGeneric").replace(/ Time$/, " time");
  const short = part("shortGeneric");
  return /^[A-Z]{2,5}$/.test(short) ? `${long} (${short})` : long || timeZone;
};
