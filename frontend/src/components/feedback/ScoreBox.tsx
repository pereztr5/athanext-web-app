import type { CSSProperties } from "react";
import { Lock } from "@/components/icons";
import { cn } from "@/lib/utils";
import { scoreWord } from "@/utils/feedback";
import { caption } from "./helpers";

// Custom range (Working Copy `.fb-range`): 8px track filled to --p, 30px white thumb with a blue ring.
const range = cn(
  "m-0 h-[34px] w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-none disabled:cursor-not-allowed",
  "[&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,hsl(var(--primary))_var(--p),theme(colors.light.525)_var(--p))]",
  "[&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[linear-gradient(to_right,hsl(var(--primary))_var(--p),theme(colors.light.525)_var(--p))]",
  "[&::-webkit-slider-thumb]:-mt-[11px] [&::-webkit-slider-thumb]:size-[30px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-solid [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-light-50",
  "[&::-moz-range-thumb]:size-[28px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-solid [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-light-50",
  "focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-primary focus-visible:[&::-moz-range-thumb]:ring-2 focus-visible:[&::-moz-range-thumb]:ring-primary"
);
const unset =
  "[&::-webkit-slider-runnable-track]:bg-light-525 [&::-moz-range-track]:bg-light-525 [&::-webkit-slider-thumb]:border-light-600 [&::-moz-range-thumb]:border-light-600";

/** "How was the session?" box: a 0 to 10 score only the coach sees. */
export const ScoreBox = ({ score, onChange, disabled }: { score: number; onChange: (score: number) => void; disabled?: boolean }) => (
  <div className="flex flex-col gap-2.5 rounded-card border border-light-525 bg-light-300 px-4 py-3.5">
    <div className="flex items-center justify-between gap-3">
      <span className={cn(caption, "flex items-center gap-1.5")}>
        <Lock className="size-3" strokeWidth={1.5} aria-hidden="true" />
        Only you see this score
      </span>
      <span className="text-label-sm text-primary">
        <b className="text-card-title">{score}</b>/10{score ? ` · ${scoreWord(score)}` : ""}
      </span>
    </div>
    <input
      type="range"
      min={0}
      max={10}
      step={1}
      value={score}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label="Session score from 0 to 10"
      aria-valuetext={score ? `${score} out of 10, ${scoreWord(score)}` : "Not scored"}
      className={cn(range, !score && unset)}
      style={{ "--p": `${score * 10}%` } as CSSProperties}
    />
    <div className={cn(caption, "flex justify-between")}>
      <span>0</span>
      <span>10</span>
    </div>
  </div>
);
