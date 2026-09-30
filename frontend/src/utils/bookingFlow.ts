/**
 * Pure grouping for the athlete "Book a session" flow (ATH-28):
 * open occurrences -> session offerings -> days -> times, in the viewer's zone.
 * Occurrences are Eastern wall-clock (ATH-22); days are the viewer's calendar days.
 */
import type { SlotBookingStatus } from "@/types/availability";
import type { CoachAvailabilityWithOccurrences, SlotOccurrence } from "@/types/availabilityWithOccurrences";
import { getZonedISODate, zonedWallTimeToUtc } from "@/utils/dateHelpers";
import { isoDateInZone } from "@/utils/viewerTime";

/** How far ahead the flow looks for open sessions. */
export const BOOKING_FLOW_HORIZON_DAYS = 56;

export interface BookingOffering {
  key: string;
  sessionName: string;
  pillar: string | null;
  sessionType: SlotOccurrence["session_type"];
  location: SlotOccurrence["location"];
  durationMinutes: number;
  /** Coach's base price per athlete, before fees. */
  price: number;
  openCount: number;
  nextStart: Date;
}

export interface BookingDay {
  /** Viewer-zone calendar date, YYYY-MM-DD. */
  date: string;
  openCount: number;
}

export interface BookingTime {
  occurrence: SlotOccurrence;
  start: Date;
  end: Date;
  /** Seats left in a group session; null for individual sessions. */
  spotsLeft: number | null;
}

/** Sessions with the same name, pillar, format, length and price are one offering. */
export const offeringKey = (occ: SlotOccurrence): string =>
  [
    (occ.session_name || "").trim().toLowerCase(),
    (occ.pillar_slot || "").trim().toLowerCase(),
    occ.session_type,
    occ.location,
    Number(occ.duration_minutes) || 0,
    Number(occ.price) || 0,
  ].join("|");

const startOf = (occ: SlotOccurrence) => zonedWallTimeToUtc(occ.occurrence_date, occ.start_time);

const addDaysISO = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

/** Occurrences dated from today (Eastern) through the horizon, across all periods. */
export const upcomingOccurrences = (
  availabilities: CoachAvailabilityWithOccurrences[] | null | undefined,
  now = new Date(),
  horizonDays = BOOKING_FLOW_HORIZON_DAYS
): SlotOccurrence[] => {
  const today = getZonedISODate(now);
  const last = addDaysISO(today, horizonDays);
  return (availabilities || []).flatMap((period) =>
    (period.occurrences || []).filter((occ) => occ.occurrence_date >= today && occ.occurrence_date <= last)
  );
};

/** Distinct offerings among open occurrences, soonest first. */
export const groupOfferings = (occurrences: SlotOccurrence[]): BookingOffering[] => {
  const byKey = new Map<string, BookingOffering>();
  occurrences.forEach((occ) => {
    const start = startOf(occ);
    if (!start) return;
    const key = offeringKey(occ);
    const existing = byKey.get(key);
    if (existing) {
      existing.openCount += 1;
      if (start < existing.nextStart) existing.nextStart = start;
      return;
    }
    byKey.set(key, {
      key,
      sessionName: (occ.session_name || "").trim() || "Session",
      pillar: occ.pillar_slot?.trim() || null,
      sessionType: occ.session_type,
      location: occ.location,
      durationMinutes: Number(occ.duration_minutes) || 0,
      price: Number(occ.price) || 0,
      openCount: 1,
      nextStart: start,
    });
  });
  return [...byKey.values()].sort(
    (a, b) => a.nextStart.getTime() - b.nextStart.getTime() || a.sessionName.localeCompare(b.sessionName)
  );
};

/** Viewer-zone days with at least one open time for the offering, in date order. */
export const offeringDays = (occurrences: SlotOccurrence[], key: string, timeZone: string): BookingDay[] => {
  const counts = new Map<string, number>();
  occurrences.forEach((occ) => {
    if (offeringKey(occ) !== key) return;
    const start = startOf(occ);
    if (!start) return;
    const day = isoDateInZone(start, timeZone);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  });
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, openCount]) => ({ date, openCount }));
};

/** Open times for the offering on a viewer-zone day, earliest first. */
export const offeringTimes = (
  occurrences: SlotOccurrence[],
  key: string,
  day: string,
  timeZone: string,
  statusMap: Record<string, SlotBookingStatus> = {}
): BookingTime[] =>
  occurrences
    .flatMap((occ) => {
      if (offeringKey(occ) !== key) return [];
      const start = startOf(occ);
      const end = zonedWallTimeToUtc(occ.occurrence_date, occ.end_time);
      if (!start || !end || isoDateInZone(start, timeZone) !== day) return [];
      const status = statusMap[occ.id];
      const spotsLeft =
        occ.session_type === "group" && status ? Math.max(0, status.capacity - status.totalCount) : null;
      return [{ occurrence: occ, start, end, spotsLeft }];
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime());
