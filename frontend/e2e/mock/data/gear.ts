import type { Page, Route } from "@playwright/test";
import type { MockBackend } from "../backend";
import { IDS } from "../personas";

// A small Shopify store for the gear pages, answered with the Storefront GraphQL shapes that
// src/api/shopify.ts reads (products, product(handle), cart and the cart mutations).

type Money = { amount: string; currencyCode: string };
type Image = { url: string; altText: string | null; width: number | null; height: number | null };
type Variant = { id: string; title: string; availableForSale: boolean; price: Money; selectedOptions: { name: string; value: string }[] };

export type RawProduct = {
  id: string;
  title: string;
  handle: string;
  vendor: string;
  productType: string;
  tags: string[];
  description: string;
  availableForSale: boolean;
  featuredImage: Image | null;
  images: { nodes: Image[] };
  priceRange: { minVariantPrice: Money; maxVariantPrice: Money };
  options: { name: string; optionValues: { name: string }[] }[];
  variants: { nodes: Variant[] };
};

export const SHOPIFY_GRAPHQL = /e2e-shop\.myshopify\.com\/api\/[^/]+\/graphql\.json/;

const usd = (amount: number): Money => ({ amount: amount.toFixed(2), currencyCode: "USD" });
const image = (handle: string, n: number): Image => ({ url: `https://cdn.e2e-shop.test/${handle}-${n}.png`, altText: null, width: 800, height: 800 });

const product = (p: {
  handle: string;
  title: string;
  vendor: string;
  productType: string;
  tags?: string[];
  description?: string;
  images?: number;
  variants: { title: string; price: number; available?: boolean; options?: Record<string, string> }[];
  options?: { name: string; values: string[] }[];
}): RawProduct => {
  const variants: Variant[] = p.variants.map((v, i) => ({
    id: `gid://shopify/ProductVariant/${p.handle}-${i + 1}`,
    title: v.title,
    availableForSale: v.available !== false,
    price: usd(v.price),
    selectedOptions: v.options ? Object.entries(v.options).map(([name, value]) => ({ name, value })) : [{ name: "Title", value: "Default Title" }],
  }));
  const prices = p.variants.map((v) => v.price);
  const images = Array.from({ length: p.images ?? 1 }, (_, i) => image(p.handle, i + 1));
  return {
    id: `gid://shopify/Product/${p.handle}`,
    title: p.title,
    handle: p.handle,
    vendor: p.vendor,
    productType: p.productType,
    tags: p.tags ?? [],
    description: p.description ?? "",
    availableForSale: variants.some((v) => v.availableForSale),
    featuredImage: images[0] ?? null,
    images: { nodes: images },
    priceRange: { minVariantPrice: usd(Math.min(...prices)), maxVariantPrice: usd(Math.max(...prices)) },
    options: p.options ? p.options.map((o) => ({ name: o.name, optionValues: o.values.map((name) => ({ name })) })) : [{ name: "Title", optionValues: [{ name: "Default Title" }] }],
    variants: { nodes: variants },
  };
};

export const PRODUCTS: RawProduct[] = [
  product({
    handle: "pro-match-ball",
    title: "Pro Match Ball",
    vendor: "Strikeforce",
    productType: "Balls",
    tags: ["soccer"],
    description: "FIFA quality match ball.\nThermally bonded panels.",
    images: 2,
    options: [{ name: "Size", values: ["4", "5"] }],
    variants: [
      { title: "4", price: 29.99, options: { Size: "4" } },
      { title: "5", price: 34.99, options: { Size: "5" } },
    ],
  }),
  product({
    handle: "shin-guards",
    title: "Lightweight Shin Guards",
    vendor: "Strikeforce",
    productType: "Protection",
    tags: ["soccer"],
    variants: [{ title: "Default Title", price: 19.5 }],
  }),
  product({
    handle: "rowing-gloves",
    title: "Rowing Grip Gloves",
    vendor: "Oarsome",
    productType: "Apparel",
    tags: ["rowing"],
    variants: [{ title: "Default Title", price: 42 }],
  }),
  product({
    handle: "training-cones",
    title: "Training Cones (Set of 20)",
    vendor: "Fieldkit",
    productType: "Training",
    tags: ["soccer"],
    variants: [{ title: "Default Title", price: 14 }],
  }),
  product({
    handle: "carbon-oar",
    title: "Carbon Sculling Oar",
    vendor: "Oarsome",
    productType: "Equipment",
    tags: ["rowing"],
    variants: [{ title: "Default Title", price: 389, available: false }],
  }),
];

const byHandle = (handle: string) => PRODUCTS.find((p) => p.handle === handle) ?? null;
const variantById = (id: string) => {
  for (const p of PRODUCTS) {
    const v = p.variants.nodes.find((x) => x.id === id);
    if (v) return { product: p, variant: v };
  }
  return null;
};

type CartLine = { id: string; merchandiseId: string; quantity: number };

/** One request the page sent to the Storefront API. */
export type ShopifyCall = { operation: string; variables: Record<string, unknown> };

/**
 * Answers Storefront GraphQL with PRODUCTS and an in-memory cart. Returns the list of calls the
 * page made, so a test can check what it asked for.
 */
export const mockShopify = async (page: Page, opts: { products?: RawProduct[]; fail?: boolean } = {}) => {
  const products = opts.products ?? PRODUCTS;
  const calls: ShopifyCall[] = [];
  let lines: CartLine[] = [];
  let attributes: { key: string; value: string }[] = [];
  const cartId = "gid://shopify/Cart/e2e-cart";
  let lineCounter = 0;

  const cart = () => {
    const nodes = lines.map((line) => {
      const found = variantById(line.merchandiseId)!;
      return {
        id: line.id,
        quantity: line.quantity,
        cost: { totalAmount: usd(Number(found.variant.price.amount) * line.quantity) },
        merchandise: {
          id: found.variant.id,
          title: found.variant.title,
          availableForSale: found.variant.availableForSale,
          price: found.variant.price,
          selectedOptions: found.variant.selectedOptions,
          image: found.product.featuredImage,
          product: { title: found.product.title, handle: found.product.handle, vendor: found.product.vendor, featuredImage: found.product.featuredImage },
        },
      };
    });
    const subtotal = nodes.reduce((sum, n) => sum + Number(n.cost.totalAmount.amount), 0);
    return {
      id: cartId,
      checkoutUrl: "https://e2e-shop.myshopify.com/cart/c/e2e-checkout",
      totalQuantity: lines.reduce((sum, l) => sum + l.quantity, 0),
      cost: { subtotalAmount: usd(subtotal) },
      lines: { nodes },
      attributes,
    };
  };
  const mutation = (key: string) => ({ data: { [key]: { cart: cart(), userErrors: [] } } });

  await page.route(SHOPIFY_GRAPHQL, async (route: Route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } });
    const body = route.request().postDataJSON() as { query: string; variables: Record<string, unknown> };
    const operation = /(?:query|mutation)\s+(\w+)/.exec(body.query)?.[1] ?? "unknown";
    calls.push({ operation, variables: body.variables });
    const reply = (json: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(json) });
    if (opts.fail) return reply({ errors: [{ message: "Internal error" }] }, 500);

    switch (operation) {
      case "GearProducts":
        return reply({ data: { products: { nodes: products } } });
      case "GearProduct":
        return reply({ data: { product: products.find((p) => p.handle === body.variables.handle) ?? null } });
      case "GearCart":
        return reply({ data: { cart: body.variables.id === cartId && lines.length ? cart() : null } });
      case "GearCartCreate": {
        const input = body.variables.input as { lines: { merchandiseId: string; quantity: number }[]; attributes?: { key: string; value: string }[] };
        lines = input.lines.map((l) => ({ id: `gid://shopify/CartLine/${++lineCounter}`, ...l }));
        attributes = input.attributes ?? [];
        return reply(mutation("cartCreate"));
      }
      case "GearCartLinesAdd": {
        for (const l of body.variables.lines as { merchandiseId: string; quantity: number }[]) {
          const existing = lines.find((x) => x.merchandiseId === l.merchandiseId);
          if (existing) existing.quantity += l.quantity;
          else lines.push({ id: `gid://shopify/CartLine/${++lineCounter}`, ...l });
        }
        return reply(mutation("cartLinesAdd"));
      }
      case "GearCartLinesUpdate": {
        for (const l of body.variables.lines as { id: string; quantity: number }[]) {
          const existing = lines.find((x) => x.id === l.id);
          if (existing) existing.quantity = l.quantity;
        }
        return reply(mutation("cartLinesUpdate"));
      }
      case "GearCartLinesRemove": {
        const ids = body.variables.lineIds as string[];
        lines = lines.filter((l) => !ids.includes(l.id));
        return reply(mutation("cartLinesRemove"));
      }
      case "GearCartAttributes":
        attributes = body.variables.attributes as { key: string; value: string }[];
        return reply(mutation("cartAttributesUpdate"));
      default:
        return reply({ errors: [{ message: `unmocked operation ${operation}` }] });
    }
  });
  return { calls, byHandle };
};

export const BRAND_STRIKEFORCE = { id: "0000b0a0-0000-4000-8000-000000000001", name: "Strikeforce", logo_url: null, website: "https://strikeforce.test", created_by: IDS.coachUser };

/**
 * The athlete trains with Casey (get_athlete_home lists the coach), and Casey uses Strikeforce,
 * so /gear shows "From Casey's store" and the "From my coaches" filter.
 */
export const seedAthleteWithCoachBrand = (backend: MockBackend) => {
  backend.rpc.get_athlete_home = {
    athlete: { id: IDS.athleteProfile, full_name: "Alex Athlete", sport: "soccer", position: "Forward", date_of_birth: "2010-05-01", graduation_year: 2028, photo: null },
    next: null,
    focus: null,
    coaches: [{ id: IDS.coach, name: "Casey Coach", slug: IDS.coachSlug, photo: null, next_date: null, credits_left: 0 }],
  };
  backend.seed("brands", [BRAND_STRIKEFORCE]);
  backend.seed("coach_brands", [{ id: "0000b0a0-0000-4000-8000-0000000000c1", coach_id: IDS.coach, brand_id: BRAND_STRIKEFORCE.id, display_order: 0, created_at: "2025-01-01T00:00:00Z", brand: BRAND_STRIKEFORCE }]);
};

/** Casey's saved gear picks (coach_gear_picks), in order. */
export const seedCoachGearPicks = (backend: MockBackend, handles: string[]) => {
  backend.seed(
    "coach_gear_picks",
    handles.map((handle, position) => ({ id: `0000b0b0-0000-4000-8000-00000000000${position + 1}`, coach_id: IDS.coach, product_handle: handle, position, created_at: "2025-01-01T00:00:00Z" }))
  );
  backend.rpc.set_my_gear_picks = (args) => {
    const next = (args.p_handles as string[]) ?? [];
    backend.tables.coach_gear_picks = next.map((handle, position) => ({ coach_id: IDS.coach, product_handle: handle, position }));
    return next;
  };
};
