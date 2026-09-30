/**
 * Coach calendar week layout (ATH-28).
 * Occurrences are stored as Eastern wall-clock date + time; blocks are placed on the
 * viewer's calendar days and clock. Pure so it can be unit tested.
 */
import { zonedWallTimeToUtc } from "@/utils/dateHelpers";
import { isoDateInZone } from "@/utils/viewerTime";

export type CalendarBlockKind = "booked" | "group" | "request" | "open";

export interface CalendarOccurrence {
  id: string;
  occurrence_date: string; // YYYY-MM-DD (Eastern)
  start_time: string; // HH:mm[:ss] (Eastern)
  end_time: string;
  session_name: string;
  session_type: "individual" | "group";
  location?: string | null;
  pillar_slot?: string | null;
  price?: number | null;
  is_enabled: boolean;
  max_bookings_per_slot?: number | null;
}

/** Paid bookings for one occurrence (get_bookings_by_user_id groups them per occurrence). */
export interface CalendarBooking {
  occurrenceId: string;
  athleteNames: string[];
  athleteCount: number;
  pillarSlot: string | null;
}

export interface CalendarRequest {
  bookingId: string;
  occurrenceId: string;
  athleteName: string;
}

export interface CalendarBlock {
  id: string; // occurrence id
  kind: CalendarBlockKind;
  dayIndex: number; // 0 = Monday
  startMinutes: number; // minutes after midnight, viewer zone
  endMinutes: number;
  start: string; // ISO instant
  end: string;
  title: string;
  detail: string | null;
  occurrence: CalendarOccurrence;
  athleteNames: string[];
  requests: CalendarRequest[];
}

export interface CalendarSummary {
  total: number;
  booked: number;
  requests: number;
  open: number;
}

export interface CalendarWeekLayout {
  days: string[]; // 7 ISO dates, Monday first
  blocks: CalendarBlock[];
  startHour: number;
  endHour: number;
  summary: CalendarSummary;
}

export const DEFAULT_START_HOUR = 7;
export const DEFAULT_END_HOUR = 21;

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

/** "Sep 28 to Oct 4, 2026"; both years are shown when the week spans New Year. */
export const formatWeekLabel = (weekStart: string): string => {
  const start = parseISODateUtc(weekStart);
  const end = parseISODateUtc(addDaysISO(weekStart, 6));
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const format = (date: Date, withYear: boolean) =>
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" } : {}),
      timeZone: "UTC",
    });
  return `${format(start, !sameYear)} to ${format(end, true)}`;
};

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

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * Lays out one week of the coach's schedule. Disabled occurrences are skipped; an
 * occurrence with an open request shows as a request, a group as its athlete count,
 * an individual booking as the athlete, anything else as an open slot.
 */
export const layoutCoachWeek = ({
  weekStart,
  timeZone,
  occurrences,
  bookings,
  requests,
}: {
  weekStart: string;
  timeZone: string;
  occurrences: CalendarOccurrence[];
  bookings: CalendarBooking[];
  requests: CalendarRequest[];
}): CalendarWeekLayout => {
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));
  const bookingsByOccurrence = new Map(bookings.map((booking) => [booking.occurrenceId, booking]));
  const requestsByOccurrence = new Map<string, CalendarRequest[]>();
  requests.forEach((request) => {
    const list = requestsByOccurrence.get(request.occurrenceId) || [];
    list.push(request);
    requestsByOccurrence.set(request.occurrenceId, list);
  });

  const summary: CalendarSummary = { total: 0, booked: 0, requests: 0, open: 0 };
  const blocks: CalendarBlock[] = [];

  occurrences.forEach((occ) => {
    if (!occ.is_enabled) return;
    const start = zonedWallTimeToUtc(occ.occurrence_date, occ.start_time);
    const end = zonedWallTimeToUtc(occ.occurrence_date, occ.end_time);
    if (!start || !end) return;
    const viewerDate = isoDateInZone(start, timeZone);
    const dayIndex = days.indexOf(viewerDate);
    if (dayIndex < 0) return;

    const startMinutes = minutesInZone(start, timeZone);
    // A session that runs past the viewer's midnight is cut at the end of the day.
    const endMinutes = isoDateInZone(end, timeZone) === viewerDate ? minutesInZone(end, timeZone) : 24 * 60;
    const booking = bookingsByOccurrence.get(occ.id);
    const athleteNames = booking?.athleteNames ?? [];
    const athleteCount = booking?.athleteCount ?? 0;
    const occRequests = requestsByOccurrence.get(occ.id) ?? [];
    const pillar = booking?.pillarSlot || occ.pillar_slot || null;

    let kind: CalendarBlockKind;
    let title: string;
    let detail: string | null;
    if (occRequests.length > 0 && athleteCount === 0) {
      kind = "request";
      title = occRequests[0].athleteName;
      detail = "Request";
      summary.requests += 1;
    } else if (occ.session_type === "group") {
      kind = "group";
      title = occ.session_name;
      detail = plural(athleteCount, "athlete");
      if (athleteCount > 0) summary.booked += 1;
      else summary.open += 1;
    } else if (athleteCount > 0) {
      kind = "booked";
      title = athleteNames[0] || occ.session_name;
      detail = pillar;
      summary.booked += 1;
    } else {
      kind = "open";
      title = "Open slot";
      detail = occ.session_name || null;
      summary.open += 1;
    }
    summary.total += 1;

    blocks.push({
      id: occ.id,
      kind,
      dayIndex,
      startMinutes,
      endMinutes: Math.max(endMinutes, startMinutes + 15),
      start: start.toISOString(),
      end: end.toISOString(),
      title,
      detail,
      occurrence: occ,
      athleteNames,
      requests: occRequests,
    });
  });

  blocks.sort((a, b) => a.dayIndex - b.dayIndex || a.startMinutes - b.startMinutes);

  const earliest = blocks.reduce((min, block) => Math.min(min, block.startMinutes), Infinity);
  const latest = blocks.reduce((max, block) => Math.max(max, block.endMinutes), -Infinity);
  const startHour = Number.isFinite(earliest) ? Math.min(DEFAULT_START_HOUR, Math.floor(earliest / 60)) : DEFAULT_START_HOUR;
  const endHour = Number.isFinite(latest) ? Math.min(24, Math.max(DEFAULT_END_HOUR, Math.ceil(latest / 60))) : DEFAULT_END_HOUR;

  return { days, blocks, startHour, endHour, summary };
};

/** "3 of 8 slots booked, 1 request waiting, 4 slots open". */
export const formatCalendarSummary = ({ total, booked, requests, open }: CalendarSummary): string =>
  `${booked} of ${plural(total, "slot")} booked, ${plural(requests, "request")} waiting, ${plural(open, "slot")} open`;
