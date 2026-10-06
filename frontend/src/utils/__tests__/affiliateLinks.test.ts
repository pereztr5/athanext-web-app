import { describe, it, expect } from "vitest";
import { parseAffiliateLinks, toAffiliateUrl, visibleDeals } from "@/utils/affiliateLinks";

describe("toAffiliateUrl", () => {
  it("adds https to bare domains", () => {
    expect(toAffiliateUrl(" nike.com/coach ")).toBe("https://nike.com/coach");
  });
  it("rejects non-web schemes and empty input", () => {
    expect(toAffiliateUrl("javascript:alert(1)")).toBeNull();
    expect(toAffiliateUrl("mailto:a@b.com")).toBeNull();
    expect(toAffiliateUrl("   ")).toBeNull();
  });
});

describe("parseAffiliateLinks", () => {
  it("keeps valid entries, trims fields and drops empty codes", () => {
    expect(
      parseAffiliateLinks([
        { brand: " Nike ", url: "nike.com", code: " COACH15 " },
        { brand: "Adidas", url: "https://adidas.com", code: "" },
      ])
    ).toEqual([
      { brand: "Nike", url: "https://nike.com/", code: "COACH15" },
      { brand: "Adidas", url: "https://adidas.com/" },
    ]);
  });
  it("drops malformed entries and caps at three", () => {
    expect(parseAffiliateLinks(null)).toEqual([]);
    expect(
      parseAffiliateLinks([
        { brand: "", url: "a.com" },
        { brand: "Bad", url: "javascript:void(0)" },
        "nope",
        { brand: "A", url: "a.com" },
        { brand: "B", url: "b.com" },
        { brand: "C", url: "c.com" },
        { brand: "D", url: "d.com" },
      ]).map((link) => link.brand)
    ).toEqual(["A", "B", "C"]);
  });
});

describe("visibleDeals", () => {
  const links = [{ brand: "Nike", url: "nike.com/coach" }];

  it("hides deals the coach turned off", () => {
    expect(visibleDeals(links, false)).toEqual([]);
  });

  it("shows deals when on, or before the switch existed", () => {
    expect(visibleDeals(links, true)).toHaveLength(1);
    expect(visibleDeals(links, undefined)).toHaveLength(1);
    expect(visibleDeals([], true)).toEqual([]);
  });
});
