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

export const COACH_GEAR_PREVIEW_LIMIT = 4;

/** Most store products a coach can pick for their profile (set_my_gear_picks enforces it too). */
export const MAX_COACH_GEAR_PICKS = 12;

export type CoachGearSource = "picks" | "coach" | "store";

export type CoachGear<T> = {
  products: T[];
  /**
   * "picks": products the coach picked, in their order. "coach": the coach's own brand products.
   * "store": AthaNext store items for the coach's sport.
   */
  source: CoachGearSource | null;
};

type CoachGearProduct = Pick<ShopifyProduct, "vendor" | "availableForSale"> & {
  tags?: string[];
  handle?: string;
  id?: string;
};

export type CoachGearOptions = {
  /** The coach's picked product handles, in their order (coach_gear_picks). */
  picks?: string[];
  /** Usually the coach id: the store fallback is shuffled by it, so coaches show different gear. */
  seed?: string | null;
  /** Most brand or store products to show. Picks show up to MAX_COACH_GEAR_PICKS. */
  limit?: number;
};

/** The /gear catalog sport ("Soccer", "Rowing") for a coach sport like "soccer"; null when unknown. */
export const toGearSport = (sport?: string | null): (typeof GEAR_SPORTS)[number] | null =>
  GEAR_SPORTS.find((gearSport) => gearSport.toLowerCase() === (sport ?? "").trim().toLowerCase()) ?? null;

// FNV-1a with a murmur3 finish: a small, well-mixed 32-bit hash for the seeded shuffle.
const hash32 = (text: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
};

/**
 * Same seed, same order; different seeds, different orders. Each item is ranked by a hash of
 * the seed and its key, so the order doesn't depend on the order the store returns products in.
 */
export const seededShuffle = <T>(items: T[], seed: string, keyOf: (item: T) => string): T[] =>
  items
    .map((item) => {
      const key = keyOf(item);
      return { item, key, rank: hash32(`${seed}\u0000${key}`) };
    })
    .sort((a, b) => a.rank - b.rank || a.key.localeCompare(b.key))
    .map(({ item }) => item);

/**
 * Products for the Gear preview on a coach profile (ATH-65):
 * 1. The coach's picks, in their order. Handles no longer in the store and sold-out products
 *    are skipped.
 * 2. Without any, in-stock products from the coach's own brands (matched on Shopify vendor).
 * 3. Without any, in-stock AthaNext store products tagged with the coach's sport (same tags as
 *    the /gear sport filter), shuffled by the seed so each coach shows their own set.
 * Brand and store products tagged for another sport never show, and gear hides (empty, source
 * null) when nothing matches.
 */
export const pickCoachGear = <T extends CoachGearProduct>(
  products: T[],
  coachBrandNames: string[],
  coachSport?: string | null,
  { picks = [], seed = null, limit = COACH_GEAR_PREVIEW_LIMIT }: CoachGearOptions = {}
): CoachGear<T> => {
  if (picks.length) {
    const byHandle = new Map<string, T>();
    products.forEach((product) => {
      if (product.handle && !byHandle.has(product.handle)) byHandle.set(product.handle, product);
    });
    const picked = Array.from(new Set(picks))
      .map((handle) => byHandle.get(handle))
      .filter((product): product is T => Boolean(product?.availableForSale))
      .slice(0, MAX_COACH_GEAR_PICKS);
    if (picked.length) return { products: picked, source: "picks" };
  }

  const sport = toGearSport(coachSport);
  const brandKeys = new Set(coachBrandNames.map((name) => brandKey(name)).filter(Boolean));
  const inStock = products.filter((product) => product.availableForSale);
  // A brand pick with no sport tag is fine; one tagged only for other sports is not.
  const fitsSport = (product: T) => {
    const sports = productSports(product);
    return sports.length === 0 || (sport !== null && sports.includes(sport));
  };

  const own = brandKeys.size
    ? inStock.filter((product) => brandKeys.has(brandKey(product.vendor)) && fitsSport(product)).slice(0, limit)
    : [];
  if (own.length) return { products: own, source: "coach" };

  if (!sport) return { products: [], source: null };
  const forSport = inStock.filter((product) => productSports(product).includes(sport));
  const store = (seed ? seededShuffle(forSport, seed, (product) => product.handle ?? product.id ?? "") : forSport).slice(0, limit);
  return store.length ? { products: store, source: "store" } : { products: [], source: null };
};

/** Heading for the gear list: the coach's picks, or the store fallback. */
export const COACH_GEAR_STORE_LABEL = "From the AthaNext store";

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
