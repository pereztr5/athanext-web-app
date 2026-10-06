import { describe, expect, it } from "vitest";
import type { RosterAthlete } from "@/api/roster";
import { rosterSubtitle, sortRoster } from "@/utils/roster";

const athlete = (overrides: Partial<RosterAthlete> & Pick<RosterAthlete, "id" | "name">): RosterAthlete => ({
  imageUrl: null,
  age: 14,
  position: null,
  team: null,
  accountName: null,
  email: null,
  phone: null,
  isClient: false,
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
});
