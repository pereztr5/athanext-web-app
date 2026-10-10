import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { initials } from "./helpers";

export const FeedbackAvatar = ({ name, imageUrl, size = 36, className }: { name: string; imageUrl?: string | null; size?: 28 | 32 | 36; className?: string }) => (
  <span
    className={cn(
      "flex flex-none items-center justify-center overflow-hidden rounded-full bg-[#E5EDF7] font-semibold text-[#0054B4]",
      size === 36 ? "size-[36px] text-[12px]" : size === 32 ? "size-[32px] text-[12px]" : "size-[28px] text-[10px]",
      className
    )}
    aria-hidden="true"
  >
    {imageUrl ? <img src={imageUrl} alt="" className="size-full object-cover" /> : initials(name)}
  </span>
);

/** Section heading on the check-in (Working Copy `.fb-q`). */
export const Question = ({ title, children }: { title: ReactNode; children?: ReactNode }) => (
  <div className="-mb-1.5 mt-1.5 flex items-center justify-between gap-3">
    <h2 className="text-[18px] font-semibold leading-[22px] tracking-[-0.05em] text-[#1A202C]">{title}</h2>
    {children}
  </div>
);

/** Tap-to-add starter phrases (Working Copy `.fbchip`). */
export const StarterChips = ({ chips, onPick, disabled }: { chips: string[]; onPick: (chip: string) => void; disabled?: boolean }) => (
  <div className="flex flex-wrap items-center gap-1.5">
    {chips.map((c) => (
      <button
        key={c}
        type="button"
        disabled={disabled}
        onClick={() => onPick(c)}
        className="inline-flex h-[30px] items-center gap-1 rounded-[15px] border border-[#EAEADF] bg-[#F1F1E6] px-2.5 text-[12px] font-medium tracking-[-0.03em] text-[#484D56] transition-colors hover:border-[#99BBE1] hover:text-[#0054B4] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {c}
      </button>
    ))}
  </div>
);

/** Sticky bottom bar card (Working Copy `.fb-bar`); stacks on phone above the tab bar. */
export const FeedbackBar = ({ children }: { children: ReactNode }) => (
  <div className="sticky bottom-[calc(66px+env(safe-area-inset-bottom))] z-[2] mt-1 flex flex-col items-stretch gap-3 rounded-[14px] border border-[#EAEADF] bg-[#F7F7F0] px-4 py-3 text-center shadow-[0_-6px_18px_-12px_rgba(16,19,26,0.25)] md:bottom-0 md:flex-row md:items-center md:justify-between md:text-left [&_button]:h-[48px] [&_button]:w-full md:[&_button]:h-[34px] md:[&_button]:w-auto">
    {children}
  </div>
);
