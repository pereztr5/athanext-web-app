import { errorMessage } from "@/utils/errorMessage";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Search, X } from "@/components/icons";
import { BrandPill } from "@/components/brand";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ShopifyProduct } from "@/api/shopify";
import { useGearProducts } from "@/hooks/useGear";
import { useSaveMyGearPicks } from "@/hooks/useCoachGearPicks";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatPriceRange, MAX_COACH_GEAR_PICKS } from "@/utils/gear";

const caption = "text-caption text-dark-300";
const iconButton =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-control text-dark-300 hover:bg-light-400 hover:text-dark disabled:pointer-events-none disabled:text-dark-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const Thumb = ({ product }: { product?: ShopifyProduct }) => {
  const image = product?.featuredImage ?? product?.images[0] ?? null;
  return (
    <span className="size-12 shrink-0 overflow-hidden rounded-control border border-light-525 bg-light-400">
      {image ? <img src={image.url} alt="" loading="lazy" className="size-full object-contain" /> : null}
    </span>
  );
};

const ProductText = ({ product, fallback }: { product?: ShopifyProduct; fallback: string }) => (
  <span className="flex min-w-0 flex-1 flex-col gap-1">
    <span className="truncate text-label-sm text-dark">{product?.title ?? fallback}</span>
    <span className="flex flex-wrap items-center gap-1.5">
      {product ? <span className={caption}>{formatPriceRange(product)}</span> : <span className={caption}>No longer in the store</span>}
      {product && !product.availableForSale ? <BrandPill tone="muted">Sold out</BrandPill> : null}
    </span>
  </span>
);

/**
 * "Pick gear to recommend": the coach picks up to 12 AthaNext store products, in order, for the
 * Gear and deals box on their profile. Sold-out picks stay saved and show again once back in stock.
 */
export function GearPicksEditor({
  open,
  onOpenChange,
  coachId,
  saved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coachId: string;
  saved: string[];
}) {
  const { toast } = useToast();
  const { data: products = [], isLoading, isError } = useGearProducts();
  const save = useSaveMyGearPicks(coachId);
  const [picked, setPicked] = useState<string[]>(saved);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      setPicked(saved);
      setSearch("");
    }
    // Reset only when the dialog opens, not when a save refreshes `saved`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const byHandle = useMemo(() => new Map(products.map((product) => [product.handle, product])), [products]);
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const listed = products.filter((product) => {
    const haystack = `${product.title} ${product.vendor} ${product.productType}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
  const full = picked.length >= MAX_COACH_GEAR_PICKS;

  const toggle = (handle: string) =>
    setPicked((current) =>
      current.includes(handle)
        ? current.filter((h) => h !== handle)
        : current.length >= MAX_COACH_GEAR_PICKS
          ? current
          : [...current, handle]
    );

  const move = (index: number, by: -1 | 1) =>
    setPicked((current) => {
      const target = index + by;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const close = () => onOpenChange(false);

  const handleSave = async () => {
    try {
      await save.mutateAsync(picked);
      toast({ title: picked.length ? "Gear picks saved" : "Gear picks cleared" });
      close();
    } catch (error) {
      toast({
        title: "Couldn't save gear picks",
        description: errorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !save.isPending && close()}>
      <DialogContent className="max-h-[90dvh] max-w-lg gap-0 overflow-hidden p-0 font-sans tracking-[-0.03em] text-dark [&>button]:right-[17px] [&>button]:top-[19px]">
        <DialogHeader className="space-y-1.5 px-[25px] py-5 pr-14 text-left">
          <DialogTitle className="text-section text-dark">Pick gear to recommend</DialogTitle>
          <DialogDescription className="text-body-m text-dark-300">
            Up to {MAX_COACH_GEAR_PICKS} products from the AthaNext store, shown on your profile in this order. Sold-out picks stay hidden until they are back in stock.
          </DialogDescription>
        </DialogHeader>

        <div className="h-px bg-light-525" />

        <div className="flex max-h-[60dvh] flex-col gap-5 overflow-y-auto px-[25px] py-5">
          <section className="flex flex-col gap-2" aria-label="Your picks">
            <div className="flex items-center justify-between gap-3">
              <span className="text-label-sm text-dark">Your picks</span>
              <span className={caption} aria-live="polite">
                {picked.length} of {MAX_COACH_GEAR_PICKS}
              </span>
            </div>
            {picked.length ? (
              <ol className="flex flex-col gap-2">
                {picked.map((handle, index) => {
                  const product = byHandle.get(handle);
                  const name = product?.title ?? handle;
                  return (
                    <li key={handle} className="flex items-center gap-3 rounded-control border border-light-525 bg-light-300 p-2">
                      <Thumb product={product} />
                      <ProductText product={product} fallback={handle} />
                      <button type="button" className={iconButton} onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${name} up`}>
                        <ChevronUp className="size-4" strokeWidth={1.5} />
                      </button>
                      <button type="button" className={iconButton} onClick={() => move(index, 1)} disabled={index === picked.length - 1} aria-label={`Move ${name} down`}>
                        <ChevronDown className="size-4" strokeWidth={1.5} />
                      </button>
                      <button type="button" className={iconButton} onClick={() => toggle(handle)} aria-label={`Remove ${name}`}>
                        <X className="size-4" strokeWidth={1.5} />
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className={caption}>Nothing picked yet. Families see gear from the AthaNext store for your sport.</p>
            )}
          </section>

          <section className="flex flex-col gap-2" aria-label="Store products">
            <span className="text-label-sm text-dark">Store products</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products"
                aria-label="Search products"
                className="pl-9"
              />
            </div>
            {isLoading ? (
              <p className={caption}>Loading products…</p>
            ) : isError ? (
              <p className={caption}>Couldn't load the store. Try again in a moment.</p>
            ) : listed.length === 0 ? (
              <p className={caption}>{products.length ? "No products match your search." : "The store has no products yet."}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {listed.map((product) => {
                  const selected = picked.includes(product.handle);
                  const disabled = !selected && full;
                  return (
                    <li key={product.id}>
                      <button
                        type="button"
                        onClick={() => toggle(product.handle)}
                        disabled={disabled}
                        aria-pressed={selected}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-control border p-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:border-light-525 disabled:bg-light-400 disabled:text-dark-200",
                          selected ? "border-primary-300 bg-primary-100" : "border-light-525 bg-light-300 hover:border-primary-300 hover:bg-light-200"
                        )}
                      >
                        <Thumb product={product} />
                        <ProductText product={product} fallback={product.handle} />
                        <span
                          className={cn(
                            "inline-flex size-6 shrink-0 items-center justify-center rounded-pill border",
                            selected ? "border-primary bg-primary text-light" : "border-light-600 text-transparent"
                          )}
                          aria-hidden="true"
                        >
                          <Check className="size-3.5" strokeWidth={2} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {full ? <p className={caption}>You have picked {MAX_COACH_GEAR_PICKS}. Remove one to pick another.</p> : null}
          </section>
        </div>

        <div className="h-px bg-light-525" />

        <DialogFooter className="px-[25px] py-4">
          <Button variant="outline" onClick={close} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save picks"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
