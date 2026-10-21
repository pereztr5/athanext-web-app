import { describe, expect, it } from "vitest";
import { toCoachTermsDoc } from "@/utils/coachTerms";

const row = {
  id: "1",
  title: "Coach terms",
  content: "<p>Hello</p>",
  version: "2026-10-21",
  last_updated: "2026-10-21",
};

describe("toCoachTermsDoc", () => {
  it("returns null when nothing is published", () => {
    expect(toCoachTermsDoc(null)).toBeNull();
    expect(toCoachTermsDoc(undefined)).toBeNull();
    expect(toCoachTermsDoc({ ...row, content: "   " })).toBeNull();
    expect(toCoachTermsDoc({ ...row, content: null })).toBeNull();
  });

  it("maps a published row", () => {
    expect(toCoachTermsDoc(row)).toEqual({
      title: "Coach terms",
      content: "<p>Hello</p>",
      version: "2026-10-21",
      lastUpdated: "2026-10-21",
    });
  });

  it("falls back on title and dates", () => {
    const doc = toCoachTermsDoc({
      ...row,
      title: " ",
      version: "",
      last_updated: "not a date",
      updated_at: "2026-10-20T10:00:00Z",
    });
    expect(doc?.title).toBe("Coach terms");
    expect(doc?.version).toBeNull();
    expect(doc?.lastUpdated).toBe("2026-10-20");
  });
});
