import { describe, it, expect } from "vitest";
import { SIGNUP_PILLARS, pickedPillarIds, pillarSportKey, pillarTitles, pillarsForSport } from "@/utils/sessionPillars";

describe("pillarsForSport", () => {
  it("uses the sign-up pillars for the coach's sport", () => {
    expect(pillarsForSport("rowing")).toBe(SIGNUP_PILLARS.Rowing);
    expect(pillarsForSport("soccer")).toBe(SIGNUP_PILLARS.Soccer);
    expect(pillarsForSport(null)).toBe(SIGNUP_PILLARS.Soccer);
    expect(pillarSportKey("Rowing")).toBe("rowing");
    expect(pillarSportKey(undefined)).toBe("soccer");
  });
});

describe("pillarTitles", () => {
  // The live sport_pillars rows for rowing, in their (unordered) database order.
  const rowingDb = ["Mentorship", "Academic tutoring", "Performance coaching", "College recruiting", "Technical development", "Race preparation"];

  it("offers the database titles in the built-in order", () => {
    expect(pillarTitles("rowing", rowingDb)).toEqual([...SIGNUP_PILLARS.Rowing]);
  });

  it("keeps database-only titles (after the known ones) and drops blanks and case duplicates", () => {
    expect(pillarTitles("soccer", [" Goalkeeping ", "mentorship", "Mentorship", null, "", "On-field training"])).toEqual([
      "On-field training",
      "mentorship",
      "Goalkeeping",
    ]);
  });

  it("falls back to the built-in list when the database gave nothing", () => {
    expect(pillarTitles("rowing", [])).toEqual([...SIGNUP_PILLARS.Rowing]);
    expect(pillarTitles(null, undefined)).toEqual([...SIGNUP_PILLARS.Soccer]);
  });
});

describe("pickedPillarIds", () => {
  const rows = [
    { id: "a", title: "Technical development" },
    { id: "b", title: "Race preparation" },
    { id: "c", title: null },
  ];

  it("matches picked titles ignoring case and extra spaces", () => {
    expect(pickedPillarIds(rows, ["technical DEVELOPMENT", " Race  preparation "])).toEqual(["a", "b"]);
  });

  it("ignores titles that are not in the database", () => {
    expect(pickedPillarIds(rows, ["On-water technique"])).toEqual([]);
  });
});
