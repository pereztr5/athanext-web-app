import type { ShopifyMoney, ShopifyProduct, ShopifyVariant } from "@/api/shopify";
import { brandKey } from "@/utils/brands";

export const MAX_LINE_QUANTITY = 10;

export const formatMoney = (money?: ShopifyMoney | null): string => {
  if (!money) return "";
  const amount = Number(money.amount);
  if (!Number.isFinite(amount)) return "";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: money.currencyCode || "USD" }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
};

/** "$29.99" for a single price, "from $29.99" when variants differ in price. */
export const formatPriceRange = (product: Pick<ShopifyProduct, "priceRange">): string => {
  const { minVariantPrice, maxVariantPrice } = product.priceRange;
  const min = formatMoney(minVariantPrice);
  return Number(minVariantPrice.amount) < Number(maxVariantPrice.amount) ? `from ${min}` : min;
};

const uniqueSorted = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));

export const getProductTypeOptions = (products: Pick<ShopifyProduct, "productType">[]) =>
  uniqueSorted(products.map((product) => product.productType));

/** Products with a single "Default Title" variant have no real options to choose from. */
export const hasOnlyDefaultVariant = (product: Pick<ShopifyProduct, "variants">) =>
  product.variants.length === 1 &&
  product.variants[0].selectedOptions.every((option) => option.value === "Default Title");

export const findVariant = (
  variants: ShopifyVariant[],
  selected: Record<string, string>
): ShopifyVariant | undefined =>
  variants.find((variant) =>
    variant.selectedOptions.every((option) => selected[option.name] === option.value)
  );

/** Start on the first variant that can be bought, so the page opens ready to add to cart. */
export const getInitialOptions = (variants: ShopifyVariant[]): Record<string, string> => {
  const variant = variants.find((v) => v.availableForSale) ?? variants[0];
  return Object.fromEntries((variant?.selectedOptions ?? []).map((option) => [option.name, option.value]));
};

export const clampQuantity = (quantity: number, max = MAX_LINE_QUANTITY) =>
  Math.min(max, Math.max(1, Math.floor(Number.isFinite(quantity) ? quantity : 1)));

/** "Size 8" style label for a cart line, skipping Shopify's placeholder "Default Title". */
export const variantLabel = (selectedOptions: { name: string; value: string }[]) =>
  selectedOptions
    .filter((option) => option.value !== "Default Title")
    .map((option) => `${option.name} ${option.value}`)
    .join(" · ");

const CART_ID_STORAGE_KEY = "athanext:gear-cart-id";

// localStorage can throw (private mode, blocked site data), so the cart id is best-effort.
export const readCartId = (): string | null => {
  try {
    return window.localStorage.getItem(CART_ID_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const writeCartId = (cartId: string | null) => {
  try {
    if (cartId) window.localStorage.setItem(CART_ID_STORAGE_KEY, cartId);
    else window.localStorage.removeItem(CART_ID_STORAGE_KEY);
  } catch {
    // Cart still works for this visit; it just won't survive a reload.
  }
};

export const COACH_GEAR_PREVIEW_LIMIT = 4;

/**
 * Products for the Gear preview on a coach profile (ATH-65): products from the
 * coach's own brands first (matched on Shopify vendor), then other in-stock gear.
 */
export const pickCoachGear = <T extends Pick<ShopifyProduct, "vendor" | "availableForSale">>(
  products: T[],
  coachBrandNames: string[],
  limit = COACH_GEAR_PREVIEW_LIMIT
): T[] => {
  const brandKeys = new Set(coachBrandNames.map((name) => brandKey(name)).filter(Boolean));
  const inStock = products.filter((product) => product.availableForSale);
  const fromBrands = inStock.filter((product) => brandKeys.has(brandKey(product.vendor)));
  const others = inStock.filter((product) => !brandKeys.has(brandKey(product.vendor)));
  return [...fromBrands, ...others].slice(0, limit);
};

/* ---------- Catalog filters (ATH-97): search, sport, category, price and From my coaches ---------- */

export const GEAR_SPORTS = ["Soccer", "Rowing"] as const;

export const PRICE_BANDS = [
  { key: "under25", label: "Under $25", min: 0, max: 25 },
  { key: "25to50", label: "$25 to $50", min: 25, max: 50 },
  { key: "50to100", label: "$50 to $100", min: 50, max: 100 },
  { key: "over100", label: "$100 and up", min: 100, max: Infinity },
] as const;

export type GearFilters = {
  search: string;
  sport: string | null;
  category: string | null;
  price: string | null;
  fromMyCoaches: boolean;
};

type Filterable = Pick<ShopifyProduct, "title" | "vendor" | "productType" | "priceRange"> & { tags?: string[] };

const productSports = (product: { tags?: string[] }) =>
  GEAR_SPORTS.filter((sport) => (product.tags ?? []).some((tag) => tag.trim().toLowerCase() === sport.toLowerCase()));

/** Sports that at least one product is tagged with; the sport filter only shows these. */
export const getSportOptions = (products: { tags?: string[] }[]) =>
  GEAR_SPORTS.filter((sport) => products.some((product) => productSports(product).includes(sport)));

export const applyGearFilters = <T extends Filterable>(products: T[], filters: GearFilters, coachBrandNames: string[] = []): T[] => {
  const words = filters.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const band = PRICE_BANDS.find((b) => b.key === filters.price);
  const brands = new Set(coachBrandNames.map((name) => brandKey(name)).filter(Boolean));
  return products.filter((product) => {
    const haystack = `${product.title} ${product.vendor} ${product.productType}`.toLowerCase();
    if (words.some((word) => !haystack.includes(word))) return false;
    if (filters.sport && !productSports(product).includes(filters.sport as (typeof GEAR_SPORTS)[number])) return false;
    if (filters.category && product.productType.trim() !== filters.category) return false;
    if (band) {
      const price = Number(product.priceRange.minVariantPrice.amount);
      if (!(price >= band.min && price < band.max)) return false;
    }
    if (filters.fromMyCoaches && !brands.has(brandKey(product.vendor))) return false;
    return true;
  });
};
