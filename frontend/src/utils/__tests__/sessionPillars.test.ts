import { describe, it, expect } from "vitest";
import { SIGNUP_PILLARS, pillarsForSport } from "@/utils/sessionPillars";

describe("pillarsForSport", () => {
  it("uses the sign-up pillars for the coach's sport", () => {
    expect(pillarsForSport("rowing")).toBe(SIGNUP_PILLARS.Rowing);
    expect(pillarsForSport("soccer")).toBe(SIGNUP_PILLARS.Soccer);
    expect(pillarsForSport(null)).toBe(SIGNUP_PILLARS.Soccer);
  });
});
