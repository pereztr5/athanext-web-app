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
      className="group flex min-w-0 flex-col overflow-hidden rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]"
    >
      <div>
        <div className="relative aspect-square overflow-hidden bg-[#F4F4EB]">
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
        <p className="text-[12px] font-medium leading-[13px] tracking-[-0.36px] text-[#767980]">{product.vendor}</p>
        <h2 className="line-clamp-2 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]">
          {product.title}
        </h2>
        <p className="mt-auto pt-2 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]">
          {product.availableForSale ? formatPriceRange(product) : <span className="text-[#A3A6AB]">Sold out</span>}
        </p>
      </div>
    </Link>
  );
};
