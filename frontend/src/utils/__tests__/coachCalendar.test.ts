import { describe, it, expect } from "vitest";
import {
  addDaysISO,
  formatCalendarSummary,
  formatWeekLabel,
  layoutCoachWeek,
  minutesInZone,
  weekStartISO,
  type CalendarOccurrence,
} from "@/utils/coachCalendar";

const occ = (overrides: Partial<CalendarOccurrence> & Pick<CalendarOccurrence, "id" | "occurrence_date">): CalendarOccurrence => ({
  start_time: "09:00:00",
  end_time: "10:00:00",
  session_name: "Speed work",
  session_type: "individual",
  pillar_slot: null,
  is_enabled: true,
  ...overrides,
});

const WEEK = "2026-09-28";
const occurrences: CalendarOccurrence[] = [
  occ({ id: "booked", occurrence_date: "2026-09-29" }),
  occ({ id: "group", occurrence_date: "2026-09-30", session_type: "group", session_name: "Team skills", start_time: "17:00", end_time: "18:30" }),
  occ({ id: "request", occurrence_date: "2026-10-01", start_time: "12:00", end_time: "13:00" }),
  occ({ id: "open", occurrence_date: "2026-10-02", start_time: "15:00", end_time: "16:00" }),
  occ({ id: "disabled", occurrence_date: "2026-10-02", start_time: "10:00", end_time: "11:00", is_enabled: false }),
  occ({ id: "late", occurrence_date: "2026-10-05", start_time: "00:30", end_time: "01:30" }),
];
const bookings = [
  { occurrenceId: "booked", athleteNames: ["Maya Chen"], athleteCount: 1, pillarSlot: "Mindset" },
  { occurrenceId: "group", athleteNames: ["A", "B", "C"], athleteCount: 3, pillarSlot: null },
];
const requests = [{ bookingId: "b1", occurrenceId: "request", athleteName: "Leo Park" }];

describe("date helpers", () => {
  it("steps ISO dates across months", () => {
    expect(addDaysISO("2026-09-28", 6)).toBe("2026-10-04");
    expect(addDaysISO("2026-10-04", -6)).toBe("2026-09-28");
  });
  it("finds the Monday of a week, Sunday included", () => {
    expect(weekStartISO("2026-10-04")).toBe("2026-09-28");
    expect(weekStartISO("2026-09-28")).toBe("2026-09-28");
    expect(weekStartISO("2026-10-01")).toBe("2026-09-28");
  });
  it("labels a week", () => {
    expect(formatWeekLabel("2026-09-28")).toBe("Sep 28 to Oct 4, 2026");
    expect(formatWeekLabel("2026-12-28")).toBe("Dec 28, 2026 to Jan 3, 2027");
  });
  it("reads minutes on the viewer's clock", () => {
    const instant = new Date("2026-09-29T13:30:00Z");
    expect(minutesInZone(instant, "America/New_York")).toBe(9 * 60 + 30);
    expect(minutesInZone(instant, "UTC")).toBe(13 * 60 + 30);
  });
});

describe("layoutCoachWeek", () => {
  it("classifies each enabled occurrence for an Eastern viewer", () => {
    const layout = layoutCoachWeek({ weekStart: WEEK, timeZone: "America/New_York", occurrences, bookings, requests });
    expect(layout.days).toEqual([
      "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04",
    ]);
    expect(layout.blocks.map((b) => [b.id, b.kind, b.dayIndex, b.startMinutes, b.endMinutes, b.title, b.detail])).toEqual([
      ["booked", "booked", 1, 540, 600, "Maya Chen", "Mindset"],
      ["group", "group", 2, 1020, 1110, "Team skills", "3 athletes"],
      ["request", "request", 3, 720, 780, "Leo Park", "Request"],
      ["open", "open", 4, 900, 960, "Open slot", "Speed work"],
    ]);
    expect(layout.summary).toEqual({ total: 4, booked: 2, requests: 1, open: 1 });
    expect([layout.startHour, layout.endHour]).toEqual([7, 21]);
  });

  it("moves blocks onto the viewer's day and clock", () => {
    const layout = layoutCoachWeek({ weekStart: WEEK, timeZone: "America/Los_Angeles", occurrences, bookings, requests });
    const booked = layout.blocks.find((b) => b.id === "booked")!;
    expect([booked.startMinutes, booked.endMinutes]).toEqual([360, 420]);
    // 00:30 Eastern on Monday Oct 5 is 21:30 Sunday in Los Angeles.
    const late = layout.blocks.find((b) => b.id === "late")!;
    expect([late.dayIndex, late.startMinutes, late.endMinutes]).toEqual([6, 1290, 1350]);
    expect([layout.startHour, layout.endHour]).toEqual([6, 23]);
    expect(layout.summary.total).toBe(5);
  });

  it("cuts a session at the viewer's midnight", () => {
    const layout = layoutCoachWeek({
      weekStart: WEEK,
      timeZone: "Europe/London",
      occurrences: [occ({ id: "x", occurrence_date: "2026-09-29", start_time: "18:30", end_time: "19:30" })],
      bookings: [],
      requests: [],
    });
    // 18:30-19:30 EDT is 23:30-00:30 BST.
    expect(layout.blocks[0]).toMatchObject({ dayIndex: 1, startMinutes: 1410, endMinutes: 1440 });
    expect(layout.endHour).toBe(24);
  });

  it("shows an empty group as open capacity and a booked slot over a stale request", () => {
    const layout = layoutCoachWeek({
      weekStart: WEEK,
      timeZone: "America/New_York",
      occurrences: [
        occ({ id: "g", occurrence_date: "2026-09-28", session_type: "group", session_name: "Clinic" }),
        occ({ id: "i", occurrence_date: "2026-09-29" }),
      ],
      bookings: [{ occurrenceId: "i", athleteNames: ["Sam"], athleteCount: 1, pillarSlot: null }],
      requests: [{ bookingId: "r", occurrenceId: "i", athleteName: "Other" }],
    });
    expect(layout.blocks.map((b) => [b.kind, b.detail])).toEqual([
      ["group", "0 athletes"],
      ["booked", null],
    ]);
    expect(layout.summary).toEqual({ total: 2, booked: 1, requests: 0, open: 1 });
  });

  it("keeps the default hours for an empty week", () => {
    const layout = layoutCoachWeek({ weekStart: WEEK, timeZone: "UTC", occurrences: [], bookings: [], requests: [] });
    expect(layout.blocks).toEqual([]);
    expect([layout.startHour, layout.endHour]).toEqual([7, 21]);
  });
});

describe("formatCalendarSummary", () => {
  it("pluralises each part", () => {
    expect(formatCalendarSummary({ total: 8, booked: 3, requests: 1, open: 4 })).toBe(
      "3 of 8 slots booked, 1 request waiting, 4 slots open"
    );
    expect(formatCalendarSummary({ total: 1, booked: 0, requests: 2, open: 1 })).toBe(
      "0 of 1 slot booked, 2 requests waiting, 1 slot open"
    );
  });
});
