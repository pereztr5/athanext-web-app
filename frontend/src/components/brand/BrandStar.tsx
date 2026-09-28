import { cn } from "@/lib/utils";

/** Brand-kit rating star: #E7DF3E fill with #B9B232 stroke, or an outline when empty. */
export const BrandStar = ({
  filled = true,
  size = 16,
  className,
}: {
  filled?: boolean;
  size?: number;
  className?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={filled ? "#E7DF3E" : "none"}
    stroke={filled ? "#B9B232" : "#C1C1B8"}
    strokeWidth={1.5}
    strokeLinejoin="round"
    aria-hidden="true"
    className={cn("flex-none", className)}
  >
    <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3Z" />
  </svg>
);
