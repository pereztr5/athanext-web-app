import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  isShopifyConfigured,
  shopifyAPI,
  ShopifyError,
  type ShopifyCart,
  type ShopifyCartLineInput,
} from "@/api/shopify";
import { readCartId, writeCartId } from "@/utils/gear";

const GEAR_CART_KEY = ["gear-cart"] as const;

const isMissingCart = (error: unknown) => error instanceof ShopifyError && error.code === "CART_NOT_FOUND";

export const useGearProducts = () =>
  useQuery({
    queryKey: ["gear-products"],
    queryFn: () => shopifyAPI.getProducts(),
    enabled: isShopifyConfigured,
  });

export const useGearProduct = (handle: string | undefined) =>
  useQuery({
    queryKey: ["gear-product", handle],
    queryFn: () => shopifyAPI.getProductByHandle(handle as string),
    enabled: isShopifyConfigured && Boolean(handle),
  });

/**
 * Shared Gear cart. The cart id lives in localStorage; the cart itself lives in
 * the query cache so every cart button and sheet reads the same state.
 */
export const useGearCart = () => {
  const queryClient = useQueryClient();

  const cartQuery = useQuery<ShopifyCart | null>({
    queryKey: GEAR_CART_KEY,
    enabled: isShopifyConfigured,
    queryFn: async () => {
      const cartId = readCartId();
      if (!cartId) return null;
      const cart = await shopifyAPI.getCart(cartId);
      // Shopify returns null for expired carts; forget the id so the next add starts fresh.
      if (!cart) writeCartId(null);
      return cart;
    },
  });

  const setCart = (cart: ShopifyCart | null) => {
    writeCartId(cart?.id ?? null);
    queryClient.setQueryData(GEAR_CART_KEY, cart);
  };

  const addLines = useMutation({
    mutationFn: async (lines: ShopifyCartLineInput[]) => {
      const cartId = readCartId();
      if (cartId) {
        try {
          return await shopifyAPI.addCartLines(cartId, lines);
        } catch (error) {
          if (!isMissingCart(error)) throw error;
        }
      }
      return shopifyAPI.createCart(lines);
    },
    onSuccess: setCart,
  });

  // Update/remove only make sense on an existing cart; if it expired, clear it.
  const onLineMutationError = (error: unknown) => {
    if (isMissingCart(error)) setCart(null);
  };

  const updateLine = useMutation({
    mutationFn: ({ lineId, quantity }: { lineId: string; quantity: number }) => {
      const cartId = readCartId() ?? "";
      return quantity > 0
        ? shopifyAPI.updateCartLines(cartId, [{ id: lineId, quantity }])
        : shopifyAPI.removeCartLines(cartId, [lineId]);
    },
    onSuccess: setCart,
    onError: onLineMutationError,
  });

  const removeLine = useMutation({
    mutationFn: (lineId: string) => shopifyAPI.removeCartLines(readCartId() ?? "", [lineId]),
    onSuccess: setCart,
    onError: onLineMutationError,
  });

  return {
    cart: cartQuery.data ?? null,
    cartLoading: cartQuery.isLoading,
    cartError: cartQuery.error,
    itemCount: cartQuery.data?.totalQuantity ?? 0,
    addLines,
    updateLine,
    removeLine,
  };
};
