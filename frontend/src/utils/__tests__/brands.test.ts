import { describe, it, expect } from "vitest";
import {
  BRAND_LOGO_MAX_BYTES,
  brandKey,
  cleanBrandName,
  filterBrands,
  findBrandByName,
  normalizeBrandWebsite,
  validateBrandLogo,
  organizationPartners,
} from "@/utils/brands";

const brands = [
  { id: "1", name: "SetGK" },
  { id: "2", name: "Adidas" },
  { id: "3", name: "Camp Shutout" },
];

describe("brand names", () => {
  it("cleans and keys names case-insensitively", () => {
    expect(cleanBrandName("  Camp   Shutout ")).toBe("Camp Shutout");
    expect(brandKey(" SETGK ")).toBe("setgk");
    expect(brandKey(null)).toBe("");
  });

  it("finds an existing brand instead of a duplicate", () => {
    expect(findBrandByName(brands, "  camp  shutout")?.id).toBe("3");
    expect(findBrandByName(brands, "Nike")).toBeUndefined();
    expect(findBrandByName(brands, "   ")).toBeUndefined();
  });

  it("filters by query, skips picked brands and sorts", () => {
    expect(filterBrands(brands, "").map((b) => b.name)).toEqual(["Adidas", "Camp Shutout", "SetGK"]);
    expect(filterBrands(brands, "S", ["1"]).map((b) => b.name)).toEqual(["Adidas", "Camp Shutout"]);
  });
});

describe("normalizeBrandWebsite", () => {
  it("adds a scheme and rejects junk", () => {
    expect(normalizeBrandWebsite("setgk.com")).toBe("https://setgk.com/");
    expect(normalizeBrandWebsite("http://adidas.com/gk")).toBe("http://adidas.com/gk");
    expect(normalizeBrandWebsite("  ")).toBeNull();
    expect(normalizeBrandWebsite("not a site")).toBeNull();
  });
});

describe("validateBrandLogo", () => {
  it("accepts small images and rejects other files", () => {
    expect(validateBrandLogo({ type: "image/svg+xml", size: 1000 })).toBeNull();
    expect(validateBrandLogo({ type: "image/gif", size: 1000 })).toMatch(/PNG/);
    expect(validateBrandLogo({ type: "image/png", size: BRAND_LOGO_MAX_BYTES + 1 })).toMatch(/2MB/);
  });
});

describe("organizationPartners", () => {
  const nike = { id: "n", name: "Nike" };
  const setgk = { id: "s", name: "SetGK" };
  const puma = { id: "p", name: "Puma" };

  it("dedupes brands and ranks the most shared first", () => {
    const byCoach = { a: [nike, setgk], b: [setgk], c: [puma, setgk] };
    expect(organizationPartners(["a", "b", "c"], byCoach).map((b) => b.name)).toEqual(["SetGK", "Nike", "Puma"]);
    expect(organizationPartners(["a", "b", "c"], byCoach, 2).map((b) => b.name)).toEqual(["SetGK", "Nike"]);
  });

  it("ignores coaches outside the organization or without brands", () => {
    expect(organizationPartners(["x"], { a: [nike] })).toEqual([]);
  });
});
