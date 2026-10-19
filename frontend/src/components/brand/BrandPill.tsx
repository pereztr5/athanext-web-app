import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BrandPillTone = "blue" | "teal" | "neutral" | "sunk" | "amber" | "green" | "red" | "solid" | "muted";

// Design system Pill: the 100 fill, a 1px border in the 300 step and the darkest text of the hue.
// Status colours (green, amber, red) only ever mean status; categories use blue or teal.
const TONES: Record<BrandPillTone, string> = {
  blue: "border-primary-300 bg-primary-100 text-primary",
  teal: "border-secondary-300 bg-secondary-100 text-secondary-700",
  neutral: "border-light-600 bg-light-525 text-dark-400",
  sunk: "border-light-525 bg-light-400 text-dark-400",
  amber: "border-info-300 bg-info-100 text-info-800",
  green: "border-success-300 bg-success-100 text-success-800",
  red: "border-error-300 bg-error-100 text-error-700",
  solid: "border-primary bg-primary text-light",
  muted: "border-light-525 bg-light-400 text-dark-300",
};

/** Design system pill: one size, 4px radius, t-label-xsm, 2 / 7 padding plus a 1px border. */
export const BrandPill = ({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BrandPillTone;
  className?: string;
  children: ReactNode;
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 whitespace-nowrap rounded-pill border px-[7px] py-[2px] text-label-xsm [&>svg]:size-3",
      TONES[tone],
      className,
    )}
  >
    {children}
  </span>
);
