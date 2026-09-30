import type { Brand } from "@/utils/brands";

/** Wrapped row of brand logos (name as fallback) for the coach profile Brands card. */
export function BrandLogos({ brands }: { brands: Pick<Brand, "id" | "name" | "logo_url">[] }) {
  if (brands.length === 0) {
    return <p className="text-[12px] font-medium leading-[13px] tracking-[-0.36px] text-[#484D56]">—</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-[15px] gap-y-[10px]">
      {brands.map((brand) =>
        brand.logo_url ? (
          <img
            key={brand.id}
            src={brand.logo_url}
            alt={brand.name}
            title={brand.name}
            className="h-[28px] w-auto max-w-[120px] object-contain"
          />
        ) : (
          <span
            key={brand.id}
            className="text-[12px] font-medium leading-[13px] tracking-[-0.36px] text-[#484D56]"
          >
            {brand.name}
          </span>
        )
      )}
    </div>
  );
}
