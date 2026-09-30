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
      <div className="p-[7px]">
        <div className="relative aspect-square overflow-hidden rounded-[6px] bg-[#FCFCFA]">
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
      <div className="flex min-w-0 flex-1 flex-col gap-[5px] px-[17px] pb-[15px] pt-[3px]">
        <p className="text-[12px] font-medium leading-[13px] tracking-[-0.36px] text-[#767980]">{product.vendor}</p>
        <h2 className="line-clamp-2 text-[16px] font-medium leading-[18px] tracking-[-0.48px] text-[#1A202C]">
          {product.title}
        </h2>
        <p className="mt-auto pt-[10px] text-[16px] font-medium leading-[18px] tracking-[-0.48px] text-[#1A202C]">
          {product.availableForSale ? formatPriceRange(product) : <span className="text-[#A3A6AB]">Sold out</span>}
        </p>
      </div>
    </Link>
  );
};
