import { Link } from "react-router-dom";
import { Loader2, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { shopifyAPI } from "@/api/shopify";
import { useAuth } from "@/contexts/AuthContext";
import { useGearCart } from "@/hooks/useGear";
import { useToast } from "@/hooks/use-toast";
import { ROUTES } from "@/routes";
import { formatMoney, MAX_LINE_QUANTITY, variantLabel } from "@/utils/gear";

const qtyButtonClass =
  "inline-flex size-7 items-center justify-center rounded-[6px] border border-[#EAEADF] bg-[#F4F4EB] text-[#484D56] transition-colors hover:bg-[#EAEADF] disabled:pointer-events-none disabled:opacity-50";

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
          className="relative inline-flex size-[34px] shrink-0 items-center justify-center rounded-[8px] border border-[#EAEADF] bg-[#F7F7F0] text-[#1A202C] transition-colors hover:bg-[#EAEADF]"
        >
          <ShoppingBag className="size-4" strokeWidth={1.5} />
          {itemCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#0054B4] px-1 text-[10px] font-medium leading-[18px] text-[#F1F1E6]">
              {itemCount > 99 ? "99+" : itemCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 border-[#EAEADF] bg-[#F7F7F0] p-0 sm:max-w-[400px]">
        <div className="border-b border-[#EAEADF] px-5 pb-4 pt-5">
          <SheetTitle className="text-[20px] font-medium leading-[24px] tracking-[-0.05em] text-[#1A202C]">
            Your cart
          </SheetTitle>
          <SheetDescription className="text-[12px] leading-[14px] tracking-[-0.36px] text-[#767980]">
            {itemCount ? `${itemCount} ${itemCount === 1 ? "item" : "items"}` : "No items yet"}
          </SheetDescription>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center">
            <span className="inline-flex size-10 items-center justify-center rounded-[8px] bg-[#F4F4EB] text-[#767980]" aria-hidden="true">
              <ShoppingBag className="size-5" strokeWidth={1.5} />
            </span>
            <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">Your cart is empty.</p>
          </div>
        ) : (
          <ul className="flex-1 divide-y divide-[#EAEADF] overflow-y-auto px-5">
            {lines.map((line) => {
              const { merchandise } = line;
              const image = merchandise.image ?? merchandise.product.featuredImage;
              const options = variantLabel(merchandise.selectedOptions);
              return (
                <li key={line.id} className="flex gap-3 py-4">
                  <Link
                    to={`${ROUTES.GEAR}/${merchandise.product.handle}`}
                    className="size-[72px] shrink-0 overflow-hidden rounded-[6px] border border-[#EAEADF] bg-[#FCFCFA]"
                  >
                    {image ? (
                      <img src={image.url} alt={image.altText || merchandise.product.title} className="size-full object-contain" />
                    ) : null}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium leading-[13px] tracking-[-0.36px] text-[#767980]">
                        {merchandise.product.vendor}
                      </p>
                      <p className="truncate text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#1A202C]">
                        {merchandise.product.title}
                      </p>
                      {options ? (
                        <p className="text-[12px] leading-[14px] tracking-[-0.36px] text-[#767980]">{options}</p>
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
                        <span className="min-w-[16px] text-center text-[14px] font-medium leading-[18px] text-[#1A202C]" aria-live="polite">
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
                          className="ml-1 inline-flex size-7 items-center justify-center rounded-[6px] text-[#767980] transition-colors hover:text-[#1A202C] disabled:pointer-events-none disabled:opacity-50"
                          disabled={busy}
                          onClick={() => removeLine.mutate(line.id, { onError })}
                        >
                          <Trash2 className="size-4" strokeWidth={1.5} />
                        </button>
                      </div>
                      <span className="text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#1A202C]">
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
          <div className="flex flex-col gap-3 border-t border-[#EAEADF] px-5 pb-5 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#484D56]">Subtotal</span>
              <span className="text-[16px] font-medium leading-[18px] tracking-[-0.48px] text-[#1A202C]">
                {formatMoney(cart.cost.subtotalAmount)}
              </span>
            </div>
            <p className="text-[12px] leading-[14px] tracking-[-0.36px] text-[#767980]">
              Taxes and shipping are calculated at checkout.
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
              Checkout
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};
