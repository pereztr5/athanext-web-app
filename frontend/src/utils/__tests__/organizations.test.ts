import { describe, expect, it } from "vitest";
import {
  attendanceLabel,
  coachRows,
  isValidRate,
  money,
  orgTotals,
  splitExample,
  type OrgCoach,
  type OrgSession,
} from "../organizations";

const coach = (coachId: string, rate: number | null): OrgCoach => ({
  coachId,
  name: coachId,
  slug: null,
  photo: null,
  hourlyRate: 70,
  isOwner: rate === null,
  rate,
  pendingRate: null,
  shown: true,
  joinedAt: "2026-01-01",
  pillars: [],
});

const session = (coachId: string, paid: number, toOrg: number): OrgSession => ({
  id: `${coachId}-${paid}`,
  coachId,
  date: "2026-10-01",
  startTime: "16:00:00",
  endTime: "17:00:00",
  type: "individual",
  name: "1-on-1",
  pillar: null,
  capacity: 1,
  price: paid,
  athletes: 1,
  came: 1,
  marked: true,
  noShow: false,
  paid,
  toOrg,
});

describe("organization numbers", () => {
  const coaches = [coach("owner", null), coach("dana", 20), coach("hannah", 15)];
  const sessions = [session("owner", 80, 80), session("dana", 70, 14), session("dana", 70, 14), session("hannah", 45, 6.75)];

  it("adds up each coach", () => {
    const rows = coachRows(coaches, sessions);
    expect(rows.map((r) => [r.sessions, r.broughtIn, r.toOrg])).toEqual([
      [1, 80, 80],
      [2, 140, 28],
      [1, 45, 6.75],
    ]);
  });

  it("keeps the owner's own sessions out of the org share", () => {
    const totals = orgTotals(coachRows(coaches, sessions));
    expect(totals).toEqual({ sessions: 4, broughtIn: 265, share: 34.75, paidToCoaches: 150.25, withOwn: 114.75 });
  });

  it("formats money and splits", () => {
    expect(money(34.75)).toBe("$34.75");
    expect(money(1200)).toBe("$1,200");
    expect(splitExample(70, 20)).toEqual({ toOrg: 14, toCoach: 56 });
  });

  it("checks rates and attendance", () => {
    expect(isValidRate("")).toBe(false);
    expect(isValidRate("101")).toBe(false);
    expect(isValidRate("0")).toBe(true);
    expect(attendanceLabel({ noShow: false, marked: false, type: "group", came: 0 })).toBe("Not marked");
    expect(attendanceLabel({ noShow: false, marked: true, type: "group", came: 5 })).toBe("5 came");
    expect(attendanceLabel({ noShow: true, marked: true, type: "individual", came: 0 })).toBe("No-show");
  });
});
