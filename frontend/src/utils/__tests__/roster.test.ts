import { describe, expect, it } from "vitest";
import type { RosterAthlete } from "@/api/roster";
import { packageLeft, rosterNextLabel, rosterSubtitle, sortRoster } from "@/utils/roster";

const athlete = (overrides: Partial<RosterAthlete> & Pick<RosterAthlete, "id" | "name">): RosterAthlete => ({
  imageUrl: null,
  age: 14,
  position: null,
  team: null,
  accountName: null,
  email: null,
  phone: null,
  isClient: false,
  fromCamp: false,
  hasAccount: true,
  joinedOn: "2026-01-01",
  pillars: [],
  next: null,
  lastDate: null,
  credits: 0,
  packageName: null,
  packageTotal: null,
  packageUsed: null,
  sessionsCount: 0,
  spent: 0,
  gearTotal: 0,
  ...overrides,
});

describe("sortRoster", () => {
  const rows = [
    athlete({ id: "b", name: "Bea", next: { date: "2026-10-08", startTime: "17:00:00" } }),
    athlete({ id: "a", name: "Ada", next: { date: "2026-10-06", startTime: "15:00:00" } }),
  ];

  it("sorts names A to Z and reverses", () => {
    expect(sortRoster(rows, "name", 1).map((r) => r.name)).toEqual(["Ada", "Bea"]);
    expect(sortRoster(rows, "name", -1).map((r) => r.name)).toEqual(["Bea", "Ada"]);
  });

  it("puts the soonest next session first", () => {
    expect(sortRoster(rows, "next", 1).map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("rosterSubtitle", () => {
  it("names the parent when the account holder is someone else", () => {
    expect(rosterSubtitle(athlete({ id: "1", name: "Casey", age: 12, team: "Club", accountName: "Pat Lee" }))).toBe(
      "12 · Club · parent Pat Lee",
    );
  });

  it("says when a camp athlete's family has no account yet", () => {
    expect(rosterSubtitle(athlete({ id: "2", name: "Ali Valiev", age: 16, accountName: "Sam Valiev", fromCamp: true, hasAccount: false }))).toBe(
      "16 · parent Sam Valiev · Account not set up yet",
    );
    expect(rosterSubtitle(athlete({ id: "3", name: "Jo", age: 12, fromCamp: true, hasAccount: true }))).toBe("12");
  });
});

describe("rosterNextLabel", () => {
  const now = new Date("2026-09-28T13:00:00Z");

  it("shows the weekday, date and time", () => {
    expect(rosterNextLabel("2026-10-05", "16:00:00", "America/New_York", now)).toBe("Mon, Oct 5, 4:00 pm");
  });

  it("says Today for a session later today", () => {
    expect(rosterNextLabel("2026-09-28", "10:30:00", "America/New_York", now)).toBe("Today, 10:30 am");
  });

  it("uses the viewer's time zone", () => {
    expect(rosterNextLabel("2026-10-05", "16:00:00", "America/Los_Angeles", now)).toBe("Mon, Oct 5, 1:00 pm");
  });
});

describe("packageLeft", () => {
  it("counts sessions left and is null without a package", () => {
    expect(packageLeft(athlete({ id: "1", name: "A", packageTotal: 8, packageUsed: 5 }))).toBe(3);
    expect(packageLeft(athlete({ id: "2", name: "B", packageTotal: 8, packageUsed: 9 }))).toBe(0);
    expect(packageLeft(athlete({ id: "3", name: "C" }))).toBeNull();
  });
});
