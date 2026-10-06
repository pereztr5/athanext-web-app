import { describe, it, expect } from "vitest";
import type { ScheduleBooking, ScheduleSession } from "@/api/schedule";
import {
  addDaysISO,
  addMonthsISO,
  itemAt,
  layoutDays,
  monthGrid,
  monthRangeLabel,
  sessionKind,
  suggestedStartMinutes,
  timeZonePillLabel,
  viewerToEastern,
  weekDates,
  weekStartISO,
} from "@/utils/schedule";

const session = (overrides: Partial<ScheduleSession> & Pick<ScheduleSession, "id" | "date">): ScheduleSession => ({
  startTime: "16:00:00",
  endTime: "17:00:00",
  durationMinutes: 60,
  sessionType: "individual",
  sessionName: "1-on-1 session",
  price: 80,
  capacity: 1,
  location: "in-person",
  place: null,
  pillar: null,
  position: null,
  visibility: "open",
  offeredTo: [],
  offeredNames: [],
  details: {},
  isDraft: false,
  seriesId: null,
  bookings: [],
  ...overrides,
});

const booking = (status: ScheduleBooking["status"]): ScheduleBooking => ({
  id: `b-${status}`,
  athleteId: "a1",
  athleteName: "Ava Patel",
  status,
  paymentStatus: "unpaid",
  expiresAt: null,
  notes: null,
  createdAt: "2026-10-01T12:00:00Z",
});

const NOW = new Date("2026-10-05T12:00:00Z");

describe("date helpers", () => {
  it("finds Monday and lists the week", () => {
    expect(weekStartISO("2026-10-08")).toBe("2026-10-05");
    expect(weekStartISO("2026-10-11")).toBe("2026-10-05");
    expect(weekDates("2026-10-05")).toEqual([
      "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11",
    ]);
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("builds a Monday-first month grid", () => {
    const grid = monthGrid("2026-10-01");
    expect(grid.slice(0, 4)).toEqual([null, null, null, "2026-10-01"]);
    expect(grid.filter(Boolean)).toHaveLength(31);
    expect(addMonthsISO("2026-12-01", 1)).toBe("2027-01-01");
  });

  it("converts the viewer's clock to the stored Eastern date and time", () => {
    expect(viewerToEastern("2026-10-06", 17 * 60, "America/New_York")).toEqual({ date: "2026-10-06", start: "17:00" });
    expect(viewerToEastern("2026-10-06", 17 * 60, "America/Los_Angeles")).toEqual({ date: "2026-10-06", start: "20:00" });
    expect(viewerToEastern("2026-10-06", 22 * 60, "America/Los_Angeles")).toEqual({ date: "2026-10-07", start: "01:00" });
  });

  it("suggests afternoons on weekdays and mornings at weekends", () => {
    expect(suggestedStartMinutes("2026-10-06")[0]).toBe(15 * 60);
    expect(suggestedStartMinutes("2026-10-10")[0]).toBe(8 * 60);
  });
});

describe("sessionKind", () => {
  it("reads groups, bookings, requests, offers and open slots", () => {
    expect(sessionKind(session({ id: "g", date: "2026-10-06", sessionType: "group" }))).toBe("group");
    expect(sessionKind(session({ id: "b", date: "2026-10-06", bookings: [booking("booked")] }))).toBe("booked");
    expect(sessionKind(session({ id: "p", date: "2026-10-06", bookings: [booking("pending_payment")] }))).toBe("booked");
    expect(sessionKind(session({ id: "r", date: "2026-10-06", bookings: [booking("requested")] }))).toBe("request");
    expect(sessionKind(session({ id: "o", date: "2026-10-06", visibility: "offered" }))).toBe("offered");
    expect(sessionKind(session({ id: "x", date: "2026-10-06" }))).toBe("open");
  });
});

describe("layoutDays", () => {
  const dates = weekDates("2026-10-05");

  it("places sessions on the viewer's day and sorts them", () => {
    const days = layoutDays({
      dates,
      sessions: [
        session({ id: "late", date: "2026-10-06", startTime: "18:00:00", endTime: "19:00:00" }),
        session({ id: "early", date: "2026-10-06", startTime: "09:00:00", endTime: "10:00:00" }),
        // 1:00 AM Eastern on the 8th is 10:00 PM on the 7th in Los Angeles.
        session({ id: "night", date: "2026-10-08", startTime: "01:00:00", endTime: "02:00:00" }),
      ],
      busy: [],
      timeOff: [],
      timeZone: "America/Los_Angeles",
      now: NOW,
    });
    expect(days[1].items.map((i) => i.key)).toEqual(["early", "late"]);
    expect(days[2].items.map((i) => i.key)).toEqual(["night"]);
  });

  it("hides open slots that have started or that a busy time covers, and shows the busy time", () => {
    const days = layoutDays({
      dates,
      sessions: [
        session({ id: "past", date: "2026-10-05", startTime: "07:00:00", endTime: "08:00:00" }),
        session({ id: "covered", date: "2026-10-06", startTime: "16:00:00", endTime: "17:00:00" }),
        session({ id: "booked", date: "2026-10-06", startTime: "18:00:00", endTime: "19:00:00", bookings: [booking("booked")] }),
      ],
      busy: [{ startsAt: "2026-10-06T20:00:00Z", endsAt: "2026-10-06T23:30:00Z" }],
      timeOff: [{ date: "2026-10-09", note: "Tournament" }],
      timeZone: "America/New_York",
      now: NOW,
    });
    expect(days[0].items).toHaveLength(0);
    expect(days[1].items.map((i) => i.kind)).toEqual(["busy", "booked"]);
    expect(days[4].dayOff?.note).toBe("Tournament");
  });

  it("finds what holds a time; open slots only block new open slots", () => {
    const [, tuesday] = layoutDays({
      dates,
      sessions: [session({ id: "open", date: "2026-10-06", startTime: "17:00:00", endTime: "18:00:00" })],
      busy: [],
      timeOff: [],
      timeZone: "America/New_York",
      now: NOW,
    });
    expect(itemAt(tuesday, 17 * 60 + 30, 60, "America/New_York", true)?.key).toBe("open");
    expect(itemAt(tuesday, 17 * 60 + 30, 60, "America/New_York", false)).toBeNull();
    expect(itemAt(tuesday, 18 * 60, 60, "America/New_York", true)).toBeNull();
  });
});

describe("Create session labels (ATH-84)", () => {
  it("labels the day strip's month or months", () => {
    expect(monthRangeLabel(["2026-09-07", "2026-09-13"])).toBe("September 2026");
    expect(monthRangeLabel(["2026-09-28", "2026-10-04"])).toBe("Sep – Oct 2026");
    expect(monthRangeLabel(["2026-12-28", "2027-01-03"])).toBe("Dec 2026 – Jan 2027");
  });

  it("names the coach's time zone", () => {
    const at = new Date("2026-10-06T12:00:00Z");
    expect(timeZonePillLabel("America/Chicago", at)).toBe("Central time (CT)");
    expect(timeZonePillLabel("America/New_York", at)).toBe("Eastern time (ET)");
  });
});
