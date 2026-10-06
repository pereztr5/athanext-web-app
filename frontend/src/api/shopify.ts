/**
 * Shopify Storefront API
 * Headless Gear store: products and cart. Checkout is handed off to
 * Shopify's hosted checkout via cart.checkoutUrl.
 */

const SHOPIFY_STORE_DOMAIN = import.meta.env.VITE_SHOPIFY_STORE_DOMAIN as string | undefined;
const SHOPIFY_STOREFRONT_TOKEN = import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN as string | undefined;
const SHOPIFY_API_VERSION = "2025-07";
// Prices, shipping and checkout are quoted for the US in USD.
const SHOPIFY_COUNTRY = "US";

export const isShopifyConfigured = Boolean(SHOPIFY_STORE_DOMAIN && SHOPIFY_STOREFRONT_TOKEN);

export class ShopifyError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "ShopifyError";
    this.code = code;
  }
}

export interface ShopifyMoney {
  amount: string;
  currencyCode: string;
}

export interface ShopifyImage {
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
}

export interface ShopifySelectedOption {
  name: string;
  value: string;
}

export interface ShopifyVariant {
  id: string;
  title: string;
  availableForSale: boolean;
  price: ShopifyMoney;
  selectedOptions: ShopifySelectedOption[];
}

export interface ShopifyProductOption {
  name: string;
  optionValues: { name: string }[];
}

export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  vendor: string;
  productType: string;
  description: string;
  availableForSale: boolean;
  featuredImage: ShopifyImage | null;
  images: ShopifyImage[];
  priceRange: { minVariantPrice: ShopifyMoney; maxVariantPrice: ShopifyMoney };
  options: ShopifyProductOption[];
  variants: ShopifyVariant[];
}

export interface ShopifyCartLine {
  id: string;
  quantity: number;
  cost: { totalAmount: ShopifyMoney };
  merchandise: {
    id: string;
    title: string;
    availableForSale: boolean;
    price: ShopifyMoney;
    selectedOptions: ShopifySelectedOption[];
    image: ShopifyImage | null;
    product: { title: string; handle: string; vendor: string; featuredImage: ShopifyImage | null };
  };
}

export interface ShopifyCart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: { subtotalAmount: ShopifyMoney };
  lines: ShopifyCartLine[];
}

export interface ShopifyCartLineInput {
  merchandiseId: string;
  quantity: number;
}

type Connection<T> = { nodes: T[] };

type RawProduct = Omit<ShopifyProduct, "images" | "variants"> & {
  images: Connection<ShopifyImage>;
  variants: Connection<ShopifyVariant>;
};

type RawCart = Omit<ShopifyCart, "lines"> & { lines: Connection<ShopifyCartLine> };

interface UserError {
  field: string[] | null;
  message: string;
  code: string | null;
}

const IMAGE_FIELDS = "url altText width height";
const MONEY_FIELDS = "amount currencyCode";

const PRODUCT_FIELDS = `
  id
  title
  handle
  vendor
  productType
  description
  availableForSale
  featuredImage { ${IMAGE_FIELDS} }
  images(first: 10) { nodes { ${IMAGE_FIELDS} } }
  priceRange {
    minVariantPrice { ${MONEY_FIELDS} }
    maxVariantPrice { ${MONEY_FIELDS} }
  }
  options { name optionValues { name } }
  variants(first: 50) {
    nodes {
      id
      title
      availableForSale
      price { ${MONEY_FIELDS} }
      selectedOptions { name value }
    }
  }
`;

const CART_FIELDS = `
  id
  checkoutUrl
  totalQuantity
  cost { subtotalAmount { ${MONEY_FIELDS} } }
  lines(first: 100) {
    nodes {
      id
      quantity
      cost { totalAmount { ${MONEY_FIELDS} } }
      merchandise {
        ... on ProductVariant {
          id
          title
          availableForSale
          price { ${MONEY_FIELDS} }
          selectedOptions { name value }
          image { ${IMAGE_FIELDS} }
          product { title handle vendor featuredImage { ${IMAGE_FIELDS} } }
        }
      }
    }
  }
`;

const CART_MUTATION_RESULT = `cart { ${CART_FIELDS} } userErrors { field message code }`;

const PRODUCTS_QUERY = `
  query GearProducts($country: CountryCode) @inContext(country: $country) {
    products(first: 50, sortKey: TITLE) { nodes { ${PRODUCT_FIELDS} } }
  }
`;

const PRODUCT_BY_HANDLE_QUERY = `
  query GearProduct($handle: String!, $country: CountryCode) @inContext(country: $country) {
    product(handle: $handle) { ${PRODUCT_FIELDS} }
  }
`;

const CART_QUERY = `
  query GearCart($id: ID!, $country: CountryCode) @inContext(country: $country) {
    cart(id: $id) { ${CART_FIELDS} }
  }
`;

const CART_CREATE_MUTATION = `
  mutation GearCartCreate($input: CartInput!, $country: CountryCode) @inContext(country: $country) {
    cartCreate(input: $input) { ${CART_MUTATION_RESULT} }
  }
`;

const CART_ATTRIBUTES_MUTATION = `
  mutation GearCartAttributes($cartId: ID!, $attributes: [AttributeInput!]!, $country: CountryCode) @inContext(country: $country) {
    cartAttributesUpdate(cartId: $cartId, attributes: $attributes) { ${CART_MUTATION_RESULT} }
  }
`;

const CART_LINES_ADD_MUTATION = `
  mutation GearCartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!, $country: CountryCode) @inContext(country: $country) {
    cartLinesAdd(cartId: $cartId, lines: $lines) { ${CART_MUTATION_RESULT} }
  }
`;

const CART_LINES_UPDATE_MUTATION = `
  mutation GearCartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!, $country: CountryCode) @inContext(country: $country) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) { ${CART_MUTATION_RESULT} }
  }
`;

const CART_LINES_REMOVE_MUTATION = `
  mutation GearCartLinesRemove($cartId: ID!, $lineIds: [ID!]!, $country: CountryCode) @inContext(country: $country) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { ${CART_MUTATION_RESULT} }
  }
`;

async function storefrontRequest<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  if (!isShopifyConfigured) {
    throw new ShopifyError("The gear store isn't configured yet.", "NOT_CONFIGURED");
  }

  let response: Response;
  try {
    response = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": SHOPIFY_STOREFRONT_TOKEN as string,
      },
      body: JSON.stringify({ query, variables: { country: SHOPIFY_COUNTRY, ...variables } }),
    });
  } catch {
    throw new ShopifyError("We couldn't reach the gear store. Check your connection and try again.", "NETWORK");
  }

  const body = await response.json().catch(() => null);
  if (!response.ok || !body || body.errors?.length) {
    console.error("Shopify Storefront request failed:", response.status, body?.errors);
    throw new ShopifyError("The gear store is unavailable right now. Please try again later.", "REQUEST_FAILED");
  }
  return body.data as T;
}

const mapProduct = (raw: RawProduct): ShopifyProduct => ({
  ...raw,
  images: raw.images.nodes,
  variants: raw.variants.nodes,
});

const mapCart = (raw: RawCart): ShopifyCart => ({ ...raw, lines: raw.lines.nodes });

// A missing/expired cart id comes back as a userError on the cartId field.
const isMissingCartError = (errors: UserError[]) =>
  errors.some((error) => error.field?.includes("cartId"));

const unwrapCartMutation = (result: { cart: RawCart | null; userErrors: UserError[] }): ShopifyCart => {
  if (isMissingCartError(result.userErrors)) {
    throw new ShopifyError("Your cart has expired.", "CART_NOT_FOUND");
  }
  if (result.userErrors.length || !result.cart) {
    throw new ShopifyError(result.userErrors[0]?.message || "We couldn't update your cart.", "USER_ERROR");
  }
  return mapCart(result.cart);
};

export const shopifyAPI = {
  /**
   * List the first 50 products, sorted by title
   */
  async getProducts(): Promise<ShopifyProduct[]> {
    const data = await storefrontRequest<{ products: Connection<RawProduct> }>(PRODUCTS_QUERY);
    return data.products.nodes.map(mapProduct);
  },

  /**
   * Get a product by its handle, or null if it doesn't exist
   */
  async getProductByHandle(handle: string): Promise<ShopifyProduct | null> {
    const data = await storefrontRequest<{ product: RawProduct | null }>(PRODUCT_BY_HANDLE_QUERY, { handle });
    return data.product ? mapProduct(data.product) : null;
  },

  /**
   * Get a cart by id, or null if it has expired or doesn't exist
   */
  async getCart(cartId: string): Promise<ShopifyCart | null> {
    const data = await storefrontRequest<{ cart: RawCart | null }>(CART_QUERY, { id: cartId });
    return data.cart ? mapCart(data.cart) : null;
  },

  async createCart(lines: ShopifyCartLineInput[] = [], attributes: { key: string; value: string }[] = []): Promise<ShopifyCart> {
    const input: { lines: ShopifyCartLineInput[]; buyerIdentity: { countryCode: string }; attributes?: { key: string; value: string }[] } = {
      lines,
      buyerIdentity: { countryCode: SHOPIFY_COUNTRY },
    };
    if (attributes.length) input.attributes = attributes;
    const data = await storefrontRequest<{ cartCreate: { cart: RawCart | null; userErrors: UserError[] } }>(
      CART_CREATE_MUTATION,
      { input }
    );
    return unwrapCartMutation(data.cartCreate);
  },

  /** Tags the cart so a paid order can be tied back to the athlete. */
  async setCartAttributes(cartId: string, attributes: { key: string; value: string }[]): Promise<void> {
    if (!attributes.length) return;
    const data = await storefrontRequest<{ cartAttributesUpdate: { cart: RawCart | null; userErrors: UserError[] } }>(
      CART_ATTRIBUTES_MUTATION,
      { cartId, attributes }
    );
    unwrapCartMutation(data.cartAttributesUpdate);
  },

  async addCartLines(cartId: string, lines: ShopifyCartLineInput[]): Promise<ShopifyCart> {
    const data = await storefrontRequest<{ cartLinesAdd: { cart: RawCart | null; userErrors: UserError[] } }>(
      CART_LINES_ADD_MUTATION,
      { cartId, lines }
    );
    return unwrapCartMutation(data.cartLinesAdd);
  },

  async updateCartLines(cartId: string, lines: { id: string; quantity: number }[]): Promise<ShopifyCart> {
    const data = await storefrontRequest<{ cartLinesUpdate: { cart: RawCart | null; userErrors: UserError[] } }>(
      CART_LINES_UPDATE_MUTATION,
      { cartId, lines }
    );
    return unwrapCartMutation(data.cartLinesUpdate);
  },

  async removeCartLines(cartId: string, lineIds: string[]): Promise<ShopifyCart> {
    const data = await storefrontRequest<{ cartLinesRemove: { cart: RawCart | null; userErrors: UserError[] } }>(
      CART_LINES_REMOVE_MUTATION,
      { cartId, lineIds }
    );
    return unwrapCartMutation(data.cartLinesRemove);
  },
};
