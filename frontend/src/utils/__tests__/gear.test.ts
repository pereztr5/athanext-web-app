import { describe, expect, it } from "vitest";
import type { ShopifyVariant } from "@/api/shopify";
import {
  MAX_COACH_GEAR_PICKS,
  pickCoachGear,
  seededShuffle,
  clampQuantity,
  findVariant,
  formatMoney,
  formatPriceRange,
  getInitialOptions,
  getProductTypeOptions,
  hasOnlyDefaultVariant,
  readCartId,
  variantLabel,
  writeCartId,
} from "@/utils/gear";

const usd = (amount: string) => ({ amount, currencyCode: "USD" });

const variant = (id: string, size: string, availableForSale = true): ShopifyVariant => ({
  id,
  title: size,
  availableForSale,
  price: usd("54.99"),
  selectedOptions: [{ name: "Size", value: size }],
});

const products = [
  { handle: "gloves", vendor: "SetGK", productType: "Goalkeeper Gloves" },
  { handle: "predator", vendor: "Adidas", productType: "Goalkeeper Gloves" },
  { handle: "ball", vendor: "Nike ", productType: "Balls" },
  { handle: "pad", vendor: "Concept2", productType: "" },
];

describe("gear helpers", () => {
  it("formats money in USD", () => {
    expect(formatMoney(usd("54.99"))).toBe("$54.99");
    expect(formatMoney(usd("20"))).toBe("$20.00");
    expect(formatMoney(usd("1234.5"))).toBe("$1,234.50");
    expect(formatMoney(null)).toBe("");
    expect(formatMoney(usd("abc"))).toBe("");
  });

  it("formats a price range", () => {
    expect(formatPriceRange({ priceRange: { minVariantPrice: usd("29.99"), maxVariantPrice: usd("29.99") } })).toBe("$29.99");
    expect(formatPriceRange({ priceRange: { minVariantPrice: usd("29.99"), maxVariantPrice: usd("39.99") } })).toBe(
      "from $29.99"
    );
  });

  it("builds sorted, unique category options", () => {
    expect(getProductTypeOptions(products)).toEqual(["Balls", "Goalkeeper Gloves"]);
  });

  it("finds variants by selected options", () => {
    const variants = [variant("a", "7"), variant("b", "8")];
    expect(findVariant(variants, { Size: "8" })?.id).toBe("b");
    expect(findVariant(variants, { Size: "12" })).toBeUndefined();
  });

  it("starts on the first available variant", () => {
    expect(getInitialOptions([variant("a", "7", false), variant("b", "8")])).toEqual({ Size: "8" });
    expect(getInitialOptions([variant("a", "7", false)])).toEqual({ Size: "7" });
    expect(getInitialOptions([])).toEqual({});
  });

  it("detects single default variants", () => {
    const defaultVariant = { ...variant("a", "Default Title"), selectedOptions: [{ name: "Title", value: "Default Title" }] };
    expect(hasOnlyDefaultVariant({ variants: [defaultVariant] })).toBe(true);
    expect(hasOnlyDefaultVariant({ variants: [variant("a", "7")] })).toBe(false);
  });

  it("clamps quantities", () => {
    expect(clampQuantity(0)).toBe(1);
    expect(clampQuantity(3.7)).toBe(3);
    expect(clampQuantity(99)).toBe(10);
    expect(clampQuantity(Number.NaN)).toBe(1);
  });

  it("labels variants without the default title", () => {
    expect(variantLabel([{ name: "Size", value: "8" }])).toBe("Size 8");
    expect(variantLabel([{ name: "Title", value: "Default Title" }])).toBe("");
  });

  it("treats unavailable storage as no saved cart", () => {
    expect(readCartId()).toBeNull();
    expect(() => writeCartId("gid://shopify/Cart/abc")).not.toThrow();
  });
});

describe("pickCoachGear", () => {
  const product = (vendor: string, availableForSale = true, tags: string[] = []) => ({
    vendor,
    availableForSale,
    tags,
    id: `${vendor}-${availableForSale}-${tags.join("+")}`,
  });
  const ids = (gear: { products: { id: string }[] }) => gear.products.map((p) => p.id);

  it("shows only in-stock products from the coach's brands, matched like brand names", () => {
    const products = [product("Reusch"), product("SetGK"), product("setgk ", false), product(" SETGK "), product("Uhlsport")];
    const gear = pickCoachGear(products, ["SetGK"], "soccer");
    expect(gear.source).toBe("coach");
    expect(gear.products.map((p) => p.vendor)).toEqual(["SetGK", " SETGK "]);
  });

  it("keeps the coach's brand picks ahead of store items, but drops another sport's gear", () => {
    const products = [product("Store", true, ["Soccer"]), product("SetGK", true, ["Rowing"]), product("SetGK", true, ["soccer"])];
    const gear = pickCoachGear(products, ["SetGK"], "soccer");
    expect(gear.source).toBe("coach");
    expect(ids(gear)).toEqual(["SetGK-true-soccer"]);
  });

  it("falls back to in-stock store products for the coach's sport when the brands have none", () => {
    const products = [
      product("A", true, ["Rowing"]),
      product("B", true, ["Soccer"]),
      product("C", false, ["Soccer"]),
      product("D"),
      product("E", true, [" soccer "]),
    ];
    const soccer = pickCoachGear(products, ["Nike"], "soccer");
    expect(soccer.source).toBe("store");
    expect(ids(soccer)).toEqual(["B-true-Soccer", "E-true- soccer "]);
    expect(ids(pickCoachGear(products, [], "Rowing"))).toEqual(["A-true-Rowing"]);
  });

  it("hides gear when nothing matches the coach's brands or sport", () => {
    const products = [product("A", true, ["Rowing"]), product("B", false, ["Soccer"]), product("C")];
    expect(pickCoachGear(products, [], "soccer")).toEqual({ products: [], source: null });
    expect(pickCoachGear(products, ["  "], null)).toEqual({ products: [], source: null });
    expect(pickCoachGear(products, ["Nike"], "basketball")).toEqual({ products: [], source: null });
    expect(pickCoachGear(products, ["B"], "soccer")).toEqual({ products: [], source: null });
    expect(pickCoachGear(products, ["A"], "soccer")).toEqual({ products: [], source: null });
  });

  it("respects the limit for both sources", () => {
    const products = [product("F"), product("A"), product("F"), product("F")].map((p, i) => ({ ...p, id: `${p.id}-${i}` }));
    expect(ids(pickCoachGear(products, ["F"], "soccer", { limit: 2 }))).toEqual(["F-true--0", "F-true--2"]);
    const store = [1, 2, 3].map((i) => ({ ...product("S", true, ["Rowing"]), id: `S${i}` }));
    expect(ids(pickCoachGear(store, [], "rowing", { limit: 2 }))).toEqual(["S1", "S2"]);
  });

  describe("coach picks", () => {
    const item = (handle: string, availableForSale = true, tags: string[] = ["Soccer"]) => ({
      id: `id-${handle}`,
      handle,
      vendor: "SetGK",
      availableForSale,
      tags,
    });
    const handles = (gear: { products: { handle?: string }[] }) => gear.products.map((p) => p.handle);
    const store = [item("a"), item("b"), item("c", false), item("d", true, ["Rowing"]), item("e")];

    it("shows the coach's picks in the coach's order, any sport, ahead of brands", () => {
      const gear = pickCoachGear(store, ["SetGK"], "soccer", { picks: ["e", "d", "a"], seed: "coach-1" });
      expect(gear.source).toBe("picks");
      expect(handles(gear)).toEqual(["e", "d", "a"]);
    });

    it("skips handles no longer in the store and hides sold-out picks", () => {
      expect(handles(pickCoachGear(store, [], "soccer", { picks: ["gone", "c", "b", "b"] }))).toEqual(["b"]);
    });

    it("falls back to brands, then the store, when no pick is available", () => {
      expect(pickCoachGear(store, ["SetGK"], "soccer", { picks: ["gone", "c"] }).source).toBe("coach");
      expect(pickCoachGear(store, [], "soccer", { picks: ["gone", "c"] }).source).toBe("store");
      expect(pickCoachGear(store, [], null, { picks: ["gone"] })).toEqual({ products: [], source: null });
    });

    it("shows up to the picks maximum, not the preview limit", () => {
      const many = Array.from({ length: 15 }, (_, i) => item(`p${i}`));
      const gear = pickCoachGear(many, [], "soccer", { picks: many.map((p) => p.handle) });
      expect(gear.products).toHaveLength(MAX_COACH_GEAR_PICKS);
      expect(handles(gear)[0]).toBe("p0");
    });
  });

  describe("store fallback shuffle", () => {
    const catalog = Array.from({ length: 20 }, (_, i) => ({
      id: `id-${i}`,
      handle: `soccer-${i}`,
      vendor: "Store",
      availableForSale: i % 5 !== 0,
      tags: i % 7 === 0 ? ["Rowing"] : ["Soccer"],
    }));
    const handles = (gear: { products: { handle?: string }[] }) => gear.products.map((p) => p.handle);

    it("is the same for the same coach, whatever order the store returns", () => {
      const first = handles(pickCoachGear(catalog, [], "soccer", { seed: "coach-1" }));
      expect(handles(pickCoachGear([...catalog].reverse(), [], "soccer", { seed: "coach-1" }))).toEqual(first);
      expect(first).toHaveLength(4);
    });

    it("differs across coaches", () => {
      const sets = ["coach-1", "coach-2", "coach-3", "coach-4", "coach-5"].map((seed) =>
        handles(pickCoachGear(catalog, [], "soccer", { seed })).join(",")
      );
      expect(new Set(sets).size).toBeGreaterThan(1);
    });

    it("keeps the sport filter, in-stock only and the limit", () => {
      for (const seed of ["a", "b", "c"]) {
        const gear = pickCoachGear(catalog, [], "soccer", { seed, limit: 3 });
        expect(gear.source).toBe("store");
        expect(gear.products).toHaveLength(3);
        gear.products.forEach((p) => {
          expect(p.availableForSale).toBe(true);
          expect(p.tags).toEqual(["Soccer"]);
        });
      }
    });

    it("shuffles without losing or repeating items", () => {
      const shuffled = seededShuffle(catalog, "x", (p) => p.handle);
      expect([...shuffled].map((p) => p.handle).sort()).toEqual(catalog.map((p) => p.handle).sort());
      expect(seededShuffle(catalog, "x", (p) => p.handle)).toEqual(shuffled);
    });
  });
});
