import { describe, it, expect } from "vitest";
import { ALL_ACADEMIES, academySlug, applyOrganizations, buildOrgDirectory, buildOrganizations, coachAcademy, findOrganization, getAcademyOptions, matchesAcademy, orgPathByCoach } from "@/utils/coachAcademy";

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

describe("applyOrganizations", () => {
  const orgs = [{ name: "Torres Soccer", slug: "torres-soccer", memberIds: ["a", "b"] }];
  it("groups members under the org and drops look-alike academies", () => {
    const out = applyOrganizations(
      [
        { id: "a", company: "" },
        { id: "b", company: "Other FC" },
        { id: "c", company: "Torres Soccer" },
        { id: "d", company: "Elite GK" },
      ],
      orgs
    );
    expect(out.map((c) => c.company)).toEqual(["Torres Soccer", "Torres Soccer", null, "Elite GK"]);
  });
  it("finds an org by its slug or its name", () => {
    expect(findOrganization(orgs, "torres-soccer")?.name).toBe("Torres Soccer");
    expect(findOrganization(orgs, "nope")).toBeUndefined();
  });
});

describe("buildOrgDirectory", () => {
  const sport = () => "soccer";
  const coaches = [
    { id: "a", company: "Torres Soccer", is_verified: true },
    { id: "b", company: "My Own GK Business" },
    { id: "c", company: "Ethan Training" },
    { id: "d", company: "Torres Soccer" },
  ];

  it("lists only app organizations, never free-text businesses", () => {
    const out = buildOrgDirectory(coaches, [{ name: "Torres Soccer", slug: "torres-soccer-2", coachIds: ["a", "b"] }], sport);
    expect(out.map((o) => o.name)).toEqual(["Torres Soccer"]);
    expect(out[0].slug).toBe("torres-soccer-2");
    // d typed the same name but is not a shown member.
    expect(out[0].coachIds).toEqual(["a", "b"]);
    expect(out[0].coachCount).toBe(2);
    expect(out[0].verifiedCount).toBe(1);
  });

  it("drops organizations with no visible coaches and ignores unknown ids", () => {
    const out = buildOrgDirectory(
      coaches,
      [
        { name: "Empty", slug: "empty", coachIds: [] },
        { name: "Gone", slug: "gone", coachIds: ["zzz"] },
        { name: "Big", slug: "big", coachIds: ["a", "c", "d"] },
        { name: "Small", slug: "small", coachIds: ["b"] },
      ],
      sport
    );
    expect(out.map((o) => o.slug)).toEqual(["big", "small"]);
  });

  it("returns nothing without organizations", () => {
    expect(buildOrgDirectory(coaches, [], sport)).toEqual([]);
  });
});

describe("orgPathByCoach", () => {
  it("maps shown coaches to their org page, first org wins", () => {
    const paths = orgPathByCoach([
      { name: "One", slug: "one", coachIds: ["a", "b"] },
      { name: "Two", slug: "two", coachIds: ["b", "c"] },
    ]);
    expect(paths.get("a")).toBe("/organizations/one");
    expect(paths.get("b")).toBe("/organizations/one");
    expect(paths.get("c")).toBe("/organizations/two");
    expect(paths.get("d")).toBeUndefined();
  });
});
