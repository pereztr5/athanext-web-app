import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { initials } from "./helpers";

export const FeedbackAvatar = ({ name, imageUrl, size = 36, className }: { name: string; imageUrl?: string | null; size?: 28 | 32 | 36; className?: string }) => (
  <span
    className={cn(
      "flex flex-none items-center justify-center overflow-hidden rounded-full bg-primary-50 font-medium text-primary",
      size === 36 ? "size-[36px] text-caption" : size === 32 ? "size-[32px] text-caption" : "size-[28px] text-caption",
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
    <h2 className="text-subtitle text-dark">{title}</h2>
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
        className="inline-flex h-[30px] items-center gap-1 rounded-control border border-light-525 bg-light px-2.5 text-label-xsm text-dark-400 transition-colors hover:border-primary-200 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:border-light-525 disabled:bg-light-400 disabled:text-dark-200"
      >
        {c}
      </button>
    ))}
  </div>
);

/** Sticky bottom bar card (Working Copy `.fb-bar`); stacks on phone above the tab bar. */
export const FeedbackBar = ({ children }: { children: ReactNode }) => (
  <div className="sticky bottom-[calc(66px+env(safe-area-inset-bottom))] z-[2] mt-1 flex flex-col items-stretch gap-3 rounded-card border border-light-525 bg-light-300 px-4 py-3 text-center shadow-overlay md:bottom-0 md:flex-row md:items-center md:justify-between md:text-left [&_button]:h-[48px] [&_button]:w-full md:[&_button]:h-[34px] md:[&_button]:w-auto">
    {children}
  </div>
);
