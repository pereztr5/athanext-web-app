import { describe, it, expect } from "vitest";
import { ALL_ACADEMIES, academySlug, buildOrganizations, coachAcademy, getAcademyOptions, matchesAcademy } from "@/utils/coachAcademy";

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

describe("buildOrganizations", () => {
  type TestCoach = {
    id?: string;
    rating?: number;
    total_reviews?: number;
    company?: string | null;
    sport?: string;
    is_verified?: boolean;
    locations?: string[];
    profile_image_url?: string;
    image_url?: string;
  };
  const sportOf = (coach: TestCoach) => coach.sport ?? "soccer";

  it("groups coaches by academy and skips coaches without one", () => {
    const orgs = buildOrganizations<TestCoach>(
      [
        { id: "c1", company: "GK Academy", sport: "soccer", is_verified: true, locations: ["Miami, FL"], profile_image_url: "a.jpg", rating: 5, total_reviews: 3 },
        { id: "c2", company: "gk academy ", sport: "soccer", locations: ["Miami, FL"], image_url: "b.jpg", rating: 4, total_reviews: 1 },
        { id: "c3", company: "GK Academy", sport: "rowing", locations: ["Tampa, FL"], rating: 0, total_reviews: 0 },
        { company: "Atlanta Rowing", sport: "rowing" },
        { company: "", sport: "soccer" },
        null,
      ],
      sportOf
    );
    expect(orgs).toEqual([
      {
        name: "GK Academy",
        slug: "gk-academy",
        coachIds: ["c1", "c2", "c3"],
        coachCount: 3,
        verifiedCount: 1,
        sports: ["rowing", "soccer"],
        location: "Miami, FL",
        photos: ["a.jpg", "b.jpg"],
        rating: 4.75,
        totalReviews: 4,
      },
      {
        name: "Atlanta Rowing",
        slug: "atlanta-rowing",
        coachIds: [],
        coachCount: 1,
        verifiedCount: 0,
        sports: ["rowing"],
        location: "",
        photos: [],
        rating: null,
        totalReviews: 0,
      },
    ]);
  });

  it("breaks coach-count ties alphabetically", () => {
    const orgs = buildOrganizations<TestCoach>([{ company: "Zeta" }, { company: "Alpha" }], sportOf);
    expect(orgs.map((org) => org.name)).toEqual(["Alpha", "Zeta"]);
  });
});

describe("academySlug", () => {
  it("makes URL-safe slugs", () => {
    expect(academySlug("  GK  Academy FL ")).toBe("gk-academy-fl");
    expect(academySlug("São Paulo F.C.")).toBe("sao-paulo-f-c");
    expect(academySlug("Спартак Москва")).toBe("спартак-москва");
    expect(academySlug(null)).toBe("");
  });
});

describe("buildOrganizations grouping", () => {
  it("groups spellings that share a slug and dedupes photos", () => {
    const orgs = buildOrganizations(
      [
        { company: "GK Academy-FL", profile_image_url: "same.jpg" },
        { company: "GK Academy FL", profile_image_url: "same.jpg" },
      ],
      () => "soccer"
    );
    expect(orgs).toHaveLength(1);
    expect(orgs[0].coachCount).toBe(2);
    expect(orgs[0].photos).toEqual(["same.jpg"]);
  });
});
