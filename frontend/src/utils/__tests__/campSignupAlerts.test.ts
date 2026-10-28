import { describe, expect, it } from "vitest";
import { newSignupsBadge, newSignupsLabel, parseNewCampSignups } from "@/utils/campSignupAlerts";
import { ownCampPath } from "@/utils/camps";

describe("parseNewCampSignups", () => {
  it("reads the RPC payload", () => {
    expect(parseNewCampSignups({ total: 3, camps: { a: 2, b: 1 } })).toEqual({ total: 3, camps: { a: 2, b: 1 } });
  });

  it("treats anything malformed as zero", () => {
    expect(parseNewCampSignups(null)).toEqual({ total: 0, camps: {} });
    expect(parseNewCampSignups("x")).toEqual({ total: 0, camps: {} });
    expect(parseNewCampSignups({ total: -2, camps: [1, 2] })).toEqual({ total: 0, camps: {} });
    expect(parseNewCampSignups({ total: "2", camps: { a: "2", b: 0, c: "nope" } })).toEqual({ total: 2, camps: { a: 2 } });
  });

  it("never reports a total below the per-camp counts", () => {
    expect(parseNewCampSignups({ total: 0, camps: { a: 2 } }).total).toBe(2);
  });
});

describe("new sign-up copy", () => {
  it("labels the Home line", () => {
    expect(newSignupsLabel(0)).toBeNull();
    expect(newSignupsLabel(undefined)).toBeNull();
    expect(newSignupsLabel(1)).toBe("1 new sign-up");
    expect(newSignupsLabel(2)).toBe("2 new sign-ups");
  });

  it("caps the nav badge", () => {
    expect(newSignupsBadge(0)).toBeNull();
    expect(newSignupsBadge(4)).toBe("4 new");
    expect(newSignupsBadge(12)).toBe("9+ new");
  });
});

describe("ownCampPath", () => {
  it("opens the camp page for the coach's own cards, drafts included", () => {
    expect(ownCampPath("brayan", "thanksgiving-camp")).toBe("/brayan/thanksgiving-camp");
    expect(ownCampPath(" brayan ", "gk camp")).toBe("/brayan/gk%20camp");
  });

  it("returns null without both slugs", () => {
    expect(ownCampPath(null, "camp")).toBeNull();
    expect(ownCampPath("brayan", "")).toBeNull();
    expect(ownCampPath(undefined, undefined)).toBeNull();
  });
});
