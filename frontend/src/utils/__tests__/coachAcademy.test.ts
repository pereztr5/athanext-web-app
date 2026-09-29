import { describe, it, expect } from "vitest";
import { ALL_ACADEMIES, coachAcademy, getAcademyOptions, matchesAcademy } from "@/utils/coachAcademy";

describe("coachAcademy", () => {
  it("trims and collapses whitespace", () => {
    expect(coachAcademy("  GK  Academy FL ")).toBe("GK Academy FL");
    expect(coachAcademy(null)).toBe("");
  });
});

describe("getAcademyOptions", () => {
  it("dedupes case-insensitively and sorts", () => {
    expect(
      getAcademyOptions([
        { company: "GKAcademyFL" },
        { company: "gkacademyfl " },
        { company: "" },
        { company: null },
        { company: "Atlanta Rowing" },
        null,
      ])
    ).toEqual(["Atlanta Rowing", "GKAcademyFL"]);
  });
});

describe("matchesAcademy", () => {
  it("matches everything for the default option", () => {
    expect(matchesAcademy(null, ALL_ACADEMIES)).toBe(true);
  });
  it("matches the same academy regardless of case or spacing", () => {
    expect(matchesAcademy(" gkacademyfl", "GKAcademyFL")).toBe(true);
    expect(matchesAcademy("Other", "GKAcademyFL")).toBe(false);
    expect(matchesAcademy(null, "GKAcademyFL")).toBe(false);
  });
});
