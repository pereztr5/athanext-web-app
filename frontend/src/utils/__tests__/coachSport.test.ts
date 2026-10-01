import { describe, it, expect } from "vitest";
import { getCoachSport } from "@/utils/coachSport";

describe("getCoachSport", () => {
  it("reads the sport field first", () => {
    expect(getCoachSport({ sport_type: "Rowing" })).toBe("rowing");
    expect(getCoachSport({ sport: "football" })).toBe("soccer");
  });
  it("falls back to rowing cues, then soccer", () => {
    expect(getCoachSport({ positions: ["Coxswain"] })).toBe("rowing");
    expect(getCoachSport({ session_types: ["Rowing technique"] })).toBe("rowing");
    expect(getCoachSport({ positions: ["Goalkeeper"] })).toBe("soccer");
    expect(getCoachSport(null)).toBe("soccer");
  });
});
