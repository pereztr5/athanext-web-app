import { Link } from "react-router-dom";
import { Loader2, Minus, Plus, ShoppingBag, Trash2 } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { shopifyAPI } from "@/api/shopify";
import { useAuth } from "@/contexts/AuthContext";
import { useGearCart } from "@/hooks/useGear";
import { useToast } from "@/hooks/use-toast";
import { ROUTES } from "@/routes";
import { formatMoney, MAX_LINE_QUANTITY, variantLabel } from "@/utils/gear";

const qtyButtonClass =
  "inline-flex size-7 items-center justify-center rounded-control border border-light-525 bg-light-400 text-dark-300 transition-colors hover:bg-light-525 disabled:pointer-events-none disabled:border-light-525 disabled:bg-light-400 disabled:text-dark-200";

/** Cart icon with item count; opens the cart sheet. */
export const GearCartButton = () => {
  const { cart, itemCount, updateLine, removeLine } = useGearCart();
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const lines = cart?.lines ?? [];
  const busy = updateLine.isPending || removeLine.isPending;

  const onError = (error: Error) =>
    toast({ title: "Couldn't update your cart", description: error.message, variant: "destructive" });

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={itemCount ? `Cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}` : "Cart"}
          className="relative inline-flex size-[34px] shrink-0 items-center justify-center rounded-control border border-light-525 bg-light-300 text-dark transition-colors hover:bg-light-525"
        >
          <ShoppingBag className="size-4" strokeWidth={1.5} />
          {itemCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1 h-[18px] text-label-xsm text-light">
              {itemCount > 99 ? "99+" : itemCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 border-light-525 bg-light-300 p-0 sm:max-w-[400px]">
        <div className="border-b border-light-525 px-5 pb-4 pt-5">
          <SheetTitle className="text-card-title text-dark">
            Your cart
          </SheetTitle>
          <SheetDescription className="text-caption text-dark-300">
            {itemCount ? `${itemCount} ${itemCount === 1 ? "item" : "items"}` : "No items yet"}
          </SheetDescription>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center">
            <span className="inline-flex size-10 items-center justify-center rounded-control bg-light-400 text-dark-300" aria-hidden="true">
              <ShoppingBag className="size-5" strokeWidth={1.5} />
            </span>
            <p className="text-body-m text-dark-300">Your cart is empty.</p>
          </div>
        ) : (
          <ul className="flex-1 divide-y divide-light-525 overflow-y-auto px-5">
            {lines.map((line) => {
              const { merchandise } = line;
              const image = merchandise.image ?? merchandise.product.featuredImage;
              const options = variantLabel(merchandise.selectedOptions);
              return (
                <li key={line.id} className="flex gap-3 py-4">
                  <Link
                    to={`${ROUTES.GEAR}/${merchandise.product.handle}`}
                    className="size-[72px] shrink-0 overflow-hidden rounded-control border border-light-525 bg-light-100"
                  >
                    {image ? (
                      <img src={image.url} alt={image.altText || merchandise.product.title} className="size-full object-contain" />
                    ) : null}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
                    <div className="min-w-0">
                      <p className="text-label-xsm text-dark-300">
                        {merchandise.product.vendor}
                      </p>
                      <p className="truncate text-label-sm text-dark">
                        {merchandise.product.title}
                      </p>
                      {options ? (
                        <p className="text-caption text-dark-300">{options}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          className={qtyButtonClass}
                          disabled={busy}
                          onClick={() => updateLine.mutate({ lineId: line.id, quantity: line.quantity - 1 }, { onError })}
                        >
                          <Minus className="size-3.5" strokeWidth={1.5} />
                        </button>
                        <span className="min-w-[16px] text-center text-label-sm text-dark" aria-live="polite">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          className={qtyButtonClass}
                          disabled={busy || line.quantity >= MAX_LINE_QUANTITY}
                          onClick={() => updateLine.mutate({ lineId: line.id, quantity: line.quantity + 1 }, { onError })}
                        >
                          <Plus className="size-3.5" strokeWidth={1.5} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${merchandise.product.title}`}
                          className="ml-1 inline-flex size-7 items-center justify-center rounded-control text-dark-300 transition-colors hover:text-dark disabled:pointer-events-none disabled:text-dark-200"
                          disabled={busy}
                          onClick={() => removeLine.mutate(line.id, { onError })}
                        >
                          <Trash2 className="size-4" strokeWidth={1.5} />
                        </button>
                      </div>
                      <span className="text-label-sm text-dark">
                        {formatMoney(line.cost.totalAmount)}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {cart && lines.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-light-525 px-5 pb-5 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-body-m text-dark-300">Subtotal</span>
              <span className="text-subtitle text-dark">
                {formatMoney(cart.cost.subtotalAmount)}
              </span>
            </div>
            <p className="text-caption text-dark-300">
              You pay on Shopify's checkout, which adds taxes and shipping. AthaNext never sees your card.
            </p>
            <Button
              className="w-full"
              disabled={busy}
              onClick={async () => {
                try {
                  const athleteId = userProfile?.athlete_id;
                  if (athleteId) await shopifyAPI.setCartAttributes(cart.id, [{ key: "athlete_id", value: athleteId }]);
                } catch {
                  // Checkout still works if the tag doesn't stick. The order can be matched by email.
                }
                window.location.assign(cart.checkoutUrl);
              }}
            >
              {busy ? <Loader2 className="animate-spin" /> : null}
              Buy on Shopify
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};
