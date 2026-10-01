import { describe, expect, it } from "vitest";
import type { ShopifyVariant } from "@/api/shopify";
import {
  pickCoachGear,
  ALL_BRANDS,
  ALL_TYPES,
  clampQuantity,
  filterGearProducts,
  findVariant,
  formatMoney,
  formatPriceRange,
  getBrandOptions,
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

  it("builds sorted, unique filter options", () => {
    expect(getBrandOptions(products)).toEqual(["Adidas", "Concept2", "Nike", "SetGK"]);
    expect(getProductTypeOptions(products)).toEqual(["Balls", "Goalkeeper Gloves"]);
  });

  it("filters by brand and product type", () => {
    const handles = (list: typeof products) => list.map((p) => p.handle);
    expect(handles(filterGearProducts(products, ALL_BRANDS, ALL_TYPES))).toEqual(["gloves", "predator", "ball", "pad"]);
    expect(handles(filterGearProducts(products, "Nike", ALL_TYPES))).toEqual(["ball"]);
    expect(handles(filterGearProducts(products, ALL_BRANDS, "Goalkeeper Gloves"))).toEqual(["gloves", "predator"]);
    expect(handles(filterGearProducts(products, "Adidas", "Balls"))).toEqual([]);
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
  const product = (vendor: string, availableForSale = true) => ({ vendor, availableForSale, id: `${vendor}-${availableForSale}` });

  it("puts the coach's brands first, matched like brand names, and skips sold-out items", () => {
    const products = [product("Reusch"), product("SetGK"), product("setgk ", false), product(" SETGK "), product("Uhlsport")];
    expect(pickCoachGear(products, ["SetGK"]).map((p) => p.vendor)).toEqual(["SetGK", " SETGK ", "Reusch", "Uhlsport"]);
  });

  it("falls back to in-stock gear and respects the limit", () => {
    const products = [product("A"), product("B", false), product("C"), product("D"), product("E"), product("F")];
    expect(pickCoachGear(products, []).map((p) => p.vendor)).toEqual(["A", "C", "D", "E"]);
    expect(pickCoachGear(products, ["F"], 2).map((p) => p.vendor)).toEqual(["F", "A"]);
  });
});
