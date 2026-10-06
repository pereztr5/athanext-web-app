import { describe, it, expect } from "vitest";
import { agePillLabel, ageRangeLabel, matchesAgeGroup } from "@/utils/coachAges";

describe("coach ages", () => {
  it("labels the range", () => {
    expect(ageRangeLabel({ age_min: 10, age_max: 18 })).toBe("10 to 18");
    expect(ageRangeLabel({ age_min: 18, age_max: 99 })).toBe("18 and up");
    expect(ageRangeLabel({})).toBe("");
    expect(agePillLabel({ age_min: 10, age_max: 18 })).toBe("Ages 10 to 18");
    expect(agePillLabel({ age_min: 16, age_max: 99 })).toBe("Ages 16+");
    expect(agePillLabel({ age_min: null, age_max: null })).toBe("");
  });

  it("matches age groups by overlap", () => {
    expect(matchesAgeGroup({ age_min: 10, age_max: 14 }, "U13 to U15")).toBe(true);
    expect(matchesAgeGroup({ age_min: 10, age_max: 12 }, "U16 to U18")).toBe(false);
    expect(matchesAgeGroup({ age_min: 16, age_max: 99 }, "18 and over")).toBe(true);
    expect(matchesAgeGroup({}, "U10 to U12")).toBe(false);
    expect(matchesAgeGroup({}, "Any age")).toBe(true);
  });
});
