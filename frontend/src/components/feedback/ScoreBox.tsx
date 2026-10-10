import type { CSSProperties } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { scoreWord } from "@/utils/feedback";
import { caption } from "./helpers";

// Custom range (Working Copy `.fb-range`): 8px track filled to --p, 30px white thumb with a blue ring.
const range = cn(
  "m-0 h-[34px] w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-none disabled:cursor-not-allowed",
  "[&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-[4px] [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,#0054B4_var(--p),#EAEADF_var(--p))]",
  "[&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-[4px] [&::-moz-range-track]:bg-[linear-gradient(to_right,#0054B4_var(--p),#EAEADF_var(--p))]",
  "[&::-webkit-slider-thumb]:-mt-[11px] [&::-webkit-slider-thumb]:size-[30px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-solid [&::-webkit-slider-thumb]:border-[#0054B4] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_2px_6px_rgba(0,0,0,0.18)]",
  "[&::-moz-range-thumb]:size-[28px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-solid [&::-moz-range-thumb]:border-[#0054B4] [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-[0_2px_6px_rgba(0,0,0,0.18)]",
  "focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-[#6698D2] focus-visible:[&::-moz-range-thumb]:ring-2 focus-visible:[&::-moz-range-thumb]:ring-[#6698D2]"
);
const unset =
  "[&::-webkit-slider-runnable-track]:bg-[#EAEADF] [&::-moz-range-track]:bg-[#EAEADF] [&::-webkit-slider-thumb]:border-[#C9C9BD] [&::-moz-range-thumb]:border-[#C9C9BD]";

/** "How was the session?" box: a 0 to 10 score only the coach sees. */
export const ScoreBox = ({ score, onChange, disabled }: { score: number; onChange: (score: number) => void; disabled?: boolean }) => (
  <div className="flex flex-col gap-2.5 rounded-[14px] border border-[#EAEADF] bg-[#F7F7F0] px-4 py-3.5">
    <div className="flex items-center justify-between gap-3">
      <span className={cn(caption, "flex items-center gap-1.5")}>
        <Lock className="size-3" strokeWidth={1.5} aria-hidden="true" />
        Only you see this score
      </span>
      <span className="text-[14px] font-medium text-[#0054B4]">
        <b className="text-[20px] font-bold">{score}</b>/10{score ? ` · ${scoreWord(score)}` : ""}
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
