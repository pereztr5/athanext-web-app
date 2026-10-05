import { describe, it, expect } from "vitest";
import type { BookableSession } from "@/api/book";
import { isPickable, pillarCopy, sessionsByDay } from "@/utils/booking";

const session = (overrides: Partial<BookableSession> & Pick<BookableSession, "id" | "date">): BookableSession => ({
  coachId: "c1",
  startTime: "17:00:00",
  endTime: "18:00:00",
  durationMinutes: 60,
  sessionType: "individual",
  sessionName: "1-on-1 session",
  price: 80,
  capacity: 1,
  location: "in-person",
  place: null,
  pillar: null,
  position: null,
  details: {},
  bookedCount: 0,
  myStatus: null,
  ...overrides,
});

describe("isPickable", () => {
  it("allows open 1-on-1s and groups with space, not full or held ones", () => {
    expect(isPickable(session({ id: "a", date: "2026-10-06" }))).toBe(true);
    expect(isPickable(session({ id: "b", date: "2026-10-06", bookedCount: 1 }))).toBe(false);
    expect(isPickable(session({ id: "c", date: "2026-10-06", sessionType: "group", capacity: 8, bookedCount: 7 }))).toBe(true);
    expect(isPickable(session({ id: "d", date: "2026-10-06", sessionType: "group", capacity: 8, bookedCount: 8 }))).toBe(false);
    expect(isPickable(session({ id: "e", date: "2026-10-06", myStatus: "booked" }))).toBe(false);
  });
});

describe("sessionsByDay", () => {
  const dates = ["2026-10-06", "2026-10-07"];
  const list = [
    session({ id: "late", date: "2026-10-06", startTime: "18:00:00", endTime: "19:00:00" }),
    session({ id: "group", date: "2026-10-06", startTime: "17:00:00", sessionType: "group", capacity: 6 }),
    session({ id: "solo", date: "2026-10-06", startTime: "17:00:00" }),
    session({ id: "full", date: "2026-10-07", bookedCount: 1 }),
    session({ id: "mine", date: "2026-10-07", bookedCount: 1, myStatus: "requested" }),
  ];

  it("groups by the viewer's day, groups first at the same time, keeping the family's own sessions", () => {
    const byDay = sessionsByDay(list, dates, "America/New_York", "all");
    expect(byDay.get("2026-10-06")!.map((s) => s.id)).toEqual(["group", "solo", "late"]);
    expect(byDay.get("2026-10-07")!.map((s) => s.id)).toEqual(["mine"]);
  });

  it("filters by format", () => {
    expect(sessionsByDay(list, dates, "America/New_York", "group").get("2026-10-06")!.map((s) => s.id)).toEqual(["group"]);
    expect(sessionsByDay(list, dates, "America/New_York", "individual").get("2026-10-06")!.map((s) => s.id)).toEqual(["solo", "late"]);
  });
});

describe("pillarCopy", () => {
  it("falls back to On-field training", () => {
    expect(pillarCopy("Mentorship").bring).toBe("Just yourself");
    expect(pillarCopy("Unknown").blurb).toBe(pillarCopy("On-field training").blurb);
  });
});
