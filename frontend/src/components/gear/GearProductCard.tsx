import { Link } from "react-router-dom";
import type { ShopifyProduct } from "@/api/shopify";
import { BrandPill } from "@/components/brand";
import { ROUTES } from "@/routes";
import { formatPriceRange } from "@/utils/gear";

export const GearProductCard = ({ product }: { product: ShopifyProduct }) => {
  const image = product.featuredImage ?? product.images[0] ?? null;

  return (
    <Link
      to={`${ROUTES.GEAR}/${product.handle}`}
      className="group flex min-w-0 flex-col overflow-hidden rounded-card border border-light-525 bg-light-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div>
        <div className="relative aspect-square overflow-hidden bg-light-400">
          {image ? (
            <img
              src={image.url}
              alt={image.altText || product.title}
              loading="lazy"
              className="size-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : null}
          {!product.availableForSale && (
            <BrandPill tone="muted" className="absolute left-2 top-2">
              Sold out
            </BrandPill>
          )}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 px-4 pb-4 pt-3.5">
        <p className="text-label-xsm text-dark-300">{product.vendor}</p>
        <h2 className="line-clamp-2 text-label-sm text-dark">
          {product.title}
        </h2>
        <p className="mt-auto pt-2 text-label-sm text-dark">
          {product.availableForSale ? formatPriceRange(product) : <span className="text-dark-200">Sold out</span>}
        </p>
      </div>
    </Link>
  );
};
