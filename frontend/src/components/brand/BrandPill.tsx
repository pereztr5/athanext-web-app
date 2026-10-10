import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BrandPillTone = "blue" | "teal" | "neutral" | "sunk" | "amber" | "green" | "red" | "solid" | "muted";

const TONES: Record<BrandPillTone, string> = {
  blue: "bg-[#E5EDF7] text-[#0054B4]",
  teal: "bg-[#E7F4F8] text-[#117A96]",
  neutral: "bg-[#F1F1E6] text-[#484D56]",
  sunk: "bg-[#F4F4EB] text-[#484D56]",
  amber: "bg-[#FCEFDA] text-[#906A29]",
  green: "bg-[#CBE7D1] text-[#1E7431]",
  red: "bg-[#FEDADA] text-[#972B2B]",
  solid: "bg-[#0054B4] text-[#F1F1E6]",
  muted: "bg-[#F1F1E6] text-[#A3A6AB]",
};

/** Brand-kit pill: 4px radius, 12px medium, no border. */
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
      "inline-flex items-center gap-1 whitespace-nowrap rounded-[4px] px-2 py-[3px] text-[12px] font-medium leading-[13px] tracking-[-0.03em] [&>svg]:size-3",
      TONES[tone],
      className,
    )}
  >
    {children}
  </span>
);
