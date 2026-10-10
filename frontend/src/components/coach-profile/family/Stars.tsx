import { BrandStar } from "@/components/brand";

/** Five brand stars (Working Copy `AN.stars`), rounded to the nearest whole star. */
export const Stars = ({ value, size = 14 }: { value: number; size?: number }) => (
  <span className="inline-flex items-center gap-[2px]" role="img" aria-label={`${value.toFixed(1)} of 5 stars`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <BrandStar key={i} size={size} filled={i <= Math.round(value)} />
    ))}
  </span>
);
