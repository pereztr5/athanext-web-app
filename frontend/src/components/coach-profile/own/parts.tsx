/** Small display pieces shared by the coach's own profile. */
import { BrandStar } from "@/components/brand";
import { cn } from "@/lib/utils";

/** Five stars, filled to the nearest whole star. */
export const Stars = ({ value, size = 13 }: { value: number; size?: number }) => (
  <span className="inline-flex items-center gap-px" aria-label={`${value.toFixed(1)} out of 5`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <BrandStar key={n} size={size} filled={n <= Math.round(value)} />
    ))}
  </span>
);

export const Avatar = ({ name, src, size, className }: { name: string; src?: string | null; size: number; className?: string }) => {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "A";
  return src ? (
    <img src={src} alt="" className={cn("shrink-0 rounded-full bg-[#C1C1B8] object-cover", className)} style={{ width: size, height: size }} />
  ) : (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-full bg-[#E5EDF7] font-semibold text-[#0054B4]", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
    >
      {initials}
    </span>
  );
};
