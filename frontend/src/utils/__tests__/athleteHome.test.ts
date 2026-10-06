import { describe, it, expect } from "vitest";
import { ageGroup, ageOn, playerLine, profileItems, type HomeAthlete } from "@/utils/athleteHome";

const base: HomeAthlete = {
  id: "a",
  fullName: "Casey Synthetic",
  dateOfBirth: "2010-04-12",
  sport: "soccer",
  position: "Goalkeeper",
  team: null,
  graduationYear: null,
  pathway: null,
  seasonGoal: null,
  highlightVideoUrl: null,
  photo: null,
};

describe("athlete home helpers", () => {
  it("works out age and age group", () => {
    expect(ageOn("2010-04-12", "2026-04-11")).toBe(15);
    expect(ageOn("2010-04-12", "2026-04-12")).toBe(16);
    expect(ageGroup("2010-04-12", "2026-07-31")).toBe("U16");
    expect(ageGroup("2010-04-12", "2026-08-01")).toBe("U17");
    expect(ageGroup(null, "2026-08-01")).toBe("");
  });

  it("builds the player line and skips the age group when the team already says it", () => {
    expect(playerLine({ ...base, team: "Riverside FC", graduationYear: "2028" }, "2026-10-06")).toBe(
      "U17 · Goalkeeper · Riverside FC · Class of 2028"
    );
    expect(playerLine({ ...base, team: "Riverside U17" }, "2026-10-06")).toBe("Goalkeeper · Riverside U17");
  });

  it("lists what's missing from the profile", () => {
    const missing = profileItems(base).filter((item) => !item.done).map((item) => item.key);
    expect(missing).toEqual(["team", "pathway", "grad", "goal", "video"]);
  });
});
