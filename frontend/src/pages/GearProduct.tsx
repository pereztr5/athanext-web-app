import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Loader2, Minus, Plus, ShoppingBag } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { BrandPill } from "@/components/brand";
import { GearLoading, GearNotice, GearPageShell } from "@/components/gear/GearPageShell";
import { isShopifyConfigured } from "@/api/shopify";
import { useGearCart, useGearProduct } from "@/hooks/useGear";
import { useToast } from "@/hooks/use-toast";
import { ROUTES } from "@/routes";
import { cn } from "@/lib/utils";
import {
  clampQuantity,
  findVariant,
  formatMoney,
  formatPriceRange,
  getInitialOptions,
  hasOnlyDefaultVariant,
  MAX_LINE_QUANTITY,
} from "@/utils/gear";

const qtyButtonClass =
  "inline-flex size-[34px] items-center justify-center text-dark-300 transition-colors hover:text-dark disabled:pointer-events-none disabled:text-dark-200";

const GearProduct = () => {
  const { handle } = useParams<{ handle: string }>();
  const { data: product, isLoading, isError, refetch, isFetching } = useGearProduct(handle);
  const { addLines } = useGearCart();
  const { toast } = useToast();

  const [selected, setSelected] = useState<Record<string, string>>({});
  const [imageIndex, setImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!product) return;
    setSelected(getInitialOptions(product.variants));
    setImageIndex(0);
    setQuantity(1);
  }, [product]);

  const variant = useMemo(
    () => (product ? findVariant(product.variants, selected) : undefined),
    [product, selected]
  );

  const backLink = (
    <Link
      to={ROUTES.GEAR}
      className="inline-flex items-center gap-[5px] text-label-sm text-dark-300 hover:text-dark"
    >
      <ArrowLeft className="size-4" strokeWidth={1.5} />
      All gear
    </Link>
  );

  const renderContent = () => {
    if (!isShopifyConfigured) {
      return (
        <GearNotice
          icon={ShoppingBag}
          title="The gear store is coming soon"
          description="We're getting the shelves ready. Check back shortly."
        />
      );
    }
    if (isLoading) return <GearLoading label="Loading product" />;
    if (isError) {
      return (
        <GearNotice
          icon={AlertCircle}
          title="We couldn't load this product"
          description="Something went wrong on our side. Please try again in a moment."
          action={
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              Try again
            </Button>
          }
        />
      );
    }
    if (!product) {
      return (
        <GearNotice
          icon={ShoppingBag}
          title="Product not found"
          description="This product doesn't exist or is no longer available."
          action={
            <Button asChild variant="outline">
              <Link to={ROUTES.GEAR}>Browse all gear</Link>
            </Button>
          }
        />
      );
    }

    const images = product.images.length ? product.images : product.featuredImage ? [product.featuredImage] : [];
    const mainImage = images[imageIndex] ?? images[0];
    const showOptions = !hasOnlyDefaultVariant(product);
    const canBuy = Boolean(variant?.availableForSale);

    const handleAddToCart = () => {
      if (!variant) return;
      addLines.mutate([{ merchandiseId: variant.id, quantity }], {
        onSuccess: () =>
          toast({ title: "Added to cart", description: `${quantity} × ${product.title}` }),
        onError: (error) =>
          toast({ title: "Couldn't add to cart", description: error.message, variant: "destructive" }),
      });
    };

    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-10">
        <div className="flex min-w-0 flex-col gap-[10px]">
          <div className="aspect-square overflow-hidden rounded-card border border-light-525 bg-light-100">
            {mainImage ? (
              <img src={mainImage.url} alt={mainImage.altText || product.title} className="size-full object-contain" />
            ) : null}
          </div>
          {images.length > 1 && (
            <div className="flex gap-[10px] overflow-x-auto">
              {images.map((image, index) => (
                <button
                  key={image.url}
                  type="button"
                  aria-label={`Show image ${index + 1}`}
                  aria-pressed={index === imageIndex}
                  onClick={() => setImageIndex(index)}
                  className={cn(
                    "size-16 shrink-0 overflow-hidden rounded-control border bg-light-100",
                    index === imageIndex ? "border-primary" : "border-light-525"
                  )}
                >
                  <img src={image.url} alt="" className="size-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-[10px]">
            <div className="flex flex-wrap items-center gap-[6px]">
              <BrandPill tone="neutral">{product.vendor}</BrandPill>
              {product.productType ? <BrandPill tone="teal">{product.productType}</BrandPill> : null}
            </div>
            <h2 className="text-section text-dark">{product.title}</h2>
            <p className="text-card-title text-dark">
              {variant ? formatMoney(variant.price) : formatPriceRange(product)}
            </p>
          </div>

          {showOptions &&
            product.options.map((option) => (
              <div key={option.name} className="flex flex-col gap-[10px]">
                <p className="text-label-sm text-dark-300">
                  {option.name}
                  {selected[option.name] ? <span className="text-body-m text-dark-300"> · {selected[option.name]}</span> : null}
                </p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={option.name}>
                  {option.optionValues.map(({ name: value }) => {
                    const isSelected = selected[option.name] === value;
                    const available = findVariant(product.variants, { ...selected, [option.name]: value })?.availableForSale;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setSelected((prev) => ({ ...prev, [option.name]: value }))}
                        className={cn(
                          "min-w-[44px] rounded-control border px-3 py-2 text-label-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                          isSelected
                            ? "border-primary bg-primary-50 text-primary"
                            : "border-light-525 bg-light-300 text-dark hover:bg-light-525",
                          !available && "text-dark-200 line-through"
                        )}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

          <div className="flex flex-col gap-[10px]">
            <p className="text-label-sm text-dark-300">Quantity</p>
            <div className="inline-flex w-fit items-center rounded-control border border-light-525 bg-light-300">
              <button
                type="button"
                aria-label="Decrease quantity"
                className={qtyButtonClass}
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => clampQuantity(q - 1))}
              >
                <Minus className="size-4" strokeWidth={1.5} />
              </button>
              <span className="min-w-[28px] text-center text-label-sm text-dark" aria-live="polite">
                {quantity}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                className={qtyButtonClass}
                disabled={quantity >= MAX_LINE_QUANTITY}
                onClick={() => setQuantity((q) => clampQuantity(q + 1))}
              >
                <Plus className="size-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          <Button size="lg" className="w-full sm:w-auto" disabled={!canBuy || addLines.isPending} onClick={handleAddToCart}>
            {addLines.isPending ? <Loader2 className="animate-spin" /> : null}
            {canBuy ? "Add to cart" : "Sold out"}
          </Button>

          {product.description ? (
            <p className="whitespace-pre-line text-paragraph text-dark-300">
              {product.description}
            </p>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <GearPageShell title="Gear" subtitle={backLink}>
      {renderContent()}
    </GearPageShell>
  );
};

export default GearProduct;
