import { describe, it, expect } from "vitest";
import { applyGearFilters, getSportOptions, type GearFilters } from "@/utils/gear";

const product = (title: string, vendor: string, productType: string, price: number, tags: string[] = []) => ({
  title,
  vendor,
  productType,
  tags,
  priceRange: {
    minVariantPrice: { amount: String(price), currencyCode: "USD" },
    maxVariantPrice: { amount: String(price), currencyCode: "USD" },
  },
});

const products = [
  product("Pro keeper gloves", "Reusch", "Gloves", 49.99, ["soccer"]),
  product("Training ball", "Select", "Balls", 24.5, ["Soccer"]),
  product("Erg seat pad", "Concept2", "Accessories", 30, ["rowing"]),
  product("Speed ladder", "SKLZ", "Training", 120),
];
const none: GearFilters = { search: "", sport: null, category: null, price: null, fromMyCoaches: false };
const titles = (list: { title: string }[]) => list.map((p) => p.title);

describe("gear filters", () => {
  it("searches title, brand and category", () => {
    expect(titles(applyGearFilters(products, { ...none, search: "keeper reusch" }))).toEqual(["Pro keeper gloves"]);
    expect(titles(applyGearFilters(products, { ...none, search: "balls" }))).toEqual(["Training ball"]);
  });

  it("filters by sport tag, category and price band", () => {
    expect(titles(applyGearFilters(products, { ...none, sport: "Soccer" }))).toEqual(["Pro keeper gloves", "Training ball"]);
    expect(titles(applyGearFilters(products, { ...none, category: "Accessories" }))).toEqual(["Erg seat pad"]);
    expect(titles(applyGearFilters(products, { ...none, price: "under25" }))).toEqual(["Training ball"]);
    expect(titles(applyGearFilters(products, { ...none, price: "over100" }))).toEqual(["Speed ladder"]);
  });

  it("keeps only my coaches' brands", () => {
    expect(titles(applyGearFilters(products, { ...none, fromMyCoaches: true }, ["reusch", "SKLZ"]))).toEqual([
      "Pro keeper gloves",
      "Speed ladder",
    ]);
  });

  it("offers only sports some product is tagged with", () => {
    expect(getSportOptions(products)).toEqual(["Soccer", "Rowing"]);
    expect(getSportOptions([products[3]])).toEqual([]);
  });
});
