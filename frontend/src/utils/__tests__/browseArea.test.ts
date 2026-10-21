import { describe, expect, it } from "vitest";
import {
  cleanZipInput,
  coachDistance,
  coachPoint,
  distanceLabel,
  distanceSortValue,
  haversineMiles,
  withinRadius,
  zipDistanceRank,
} from "@/components/browse/area";

// ZIP centers (zippopotam.us): Austin 78701, Round Rock 78664, San Antonio 78205.
const austin = { lat: 30.2713, lng: -97.7426 };
const roundRock = { lat: 30.5148, lng: -97.6681 };
const sanAntonio = { lat: 29.4237, lng: -98.4925 };

describe("coach distance from the family's ZIP", () => {
  it("measures real miles between ZIP centers", () => {
    expect(haversineMiles(austin, austin)).toBe(0);
    expect(haversineMiles(austin, roundRock)).toBeGreaterThan(15);
    expect(haversineMiles(austin, roundRock)).toBeLessThan(20);
    expect(haversineMiles(austin, sanAntonio)).toBeGreaterThan(70);
  });

  it("filters by radius using miles when both points are known", () => {
    const near = coachDistance("78664", roundRock, "78701", austin);
    expect(withinRadius(near, "10")).toBe(false);
    expect(withinRadius(near, "25")).toBe(true);
    const far = coachDistance("78205", sanAntonio, "78701", austin);
    expect(withinRadius(far, "50")).toBe(false);
    expect(withinRadius(far, "any")).toBe(true);
  });

  it("falls back to ZIP prefixes when a point is missing, never to nothing", () => {
    const noPoint = coachDistance("78702", null, "78701", austin);
    expect(noPoint.miles).toBeNull();
    expect(withinRadius(noPoint, "10")).toBe(true);
    // The family's ZIP lookup failed: prefixes still sort and filter.
    const lookupFailed = coachDistance("78746", { lat: 30.2969, lng: -97.8019 }, "78701", null);
    expect(lookupFailed.rank).toBe(2);
    expect(withinRadius(lookupFailed, "25")).toBe(true);
    expect(withinRadius(lookupFailed, "10")).toBe(false);
    expect(withinRadius(coachDistance(null, null, "78701", austin), "50")).toBe(false);
  });

  it("sorts nearest first, unknown last", () => {
    const list = [
      { id: "unknown", d: coachDistance(null, null, "78701", austin) },
      { id: "sa", d: coachDistance("78205", sanAntonio, "78701", austin) },
      { id: "same", d: coachDistance("78701", null, "78701", austin) },
      { id: "rr", d: coachDistance("78664", roundRock, "78701", austin) },
    ];
    expect([...list].sort((a, b) => distanceSortValue(a.d) - distanceSortValue(b.d)).map((x) => x.id)).toEqual(["same", "rr", "sa", "unknown"]);
  });

  it("ignores a stored point made for an old ZIP", () => {
    const points = new Map([["c1", { zip: "78664", point: roundRock }]]);
    expect(coachPoint("c1", "78664", points)).toEqual(roundRock);
    expect(coachPoint("c1", "78205", points)).toBeNull();
    expect(coachPoint("c2", "78205", points)).toBeNull();
  });

  it("labels real distances and cleans the ZIP box", () => {
    expect(distanceLabel({ miles: 0.4, rank: 0 })).toBe("Under 1 mi away");
    expect(distanceLabel({ miles: 17.6, rank: 2 })).toBe("18 mi away");
    expect(distanceLabel({ miles: null, rank: 1 })).toBe("");
    expect(cleanZipInput("78a70-12")).toBe("78701");
    expect(zipDistanceRank("78701", "")).toBe(3);
  });
});
