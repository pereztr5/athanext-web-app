import type { ShopifyMoney, ShopifyProduct, ShopifyVariant } from "@/api/shopify";
import { brandKey } from "@/utils/brands";

export const ALL_BRANDS = "All Brands";
export const ALL_TYPES = "All Types";
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

export const getBrandOptions = (products: Pick<ShopifyProduct, "vendor">[]) =>
  uniqueSorted(products.map((product) => product.vendor));

export const getProductTypeOptions = (products: Pick<ShopifyProduct, "productType">[]) =>
  uniqueSorted(products.map((product) => product.productType));

export const filterGearProducts = <T extends Pick<ShopifyProduct, "vendor" | "productType">>(
  products: T[],
  brand: string,
  productType: string
): T[] =>
  products.filter(
    (product) =>
      (brand === ALL_BRANDS || product.vendor.trim() === brand) &&
      (productType === ALL_TYPES || product.productType.trim() === productType)
  );

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
