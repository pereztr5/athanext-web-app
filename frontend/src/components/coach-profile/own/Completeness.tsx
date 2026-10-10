/** Profile completeness (Working Copy `AN.completeness`): the amber strip in the hero and the full list in edit mode. */
import { Check } from "lucide-react";
import { textButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import type { StepName } from "./hooks";

type Steps = [StepName, boolean][];

const Bar = ({ done, total, className }: { done: number; total: number; className?: string }) => (
  <span className={cn("block h-[5px] overflow-hidden rounded-[10px] bg-[#D9D9CF]", className)}>
    <i className="block h-full rounded-[10px] bg-[#0054B4]" style={{ width: `${(done / total) * 100}%` }} />
  </span>
);

/** "7 of 8 done [bar] Add coaching video". Hidden once every step is done. */
export const CompletenessNudge = ({ steps, done, next, onStep }: { steps: Steps; done: number; next: StepName | null; onStep: (step: StepName) => void }) =>
  next ? (
    <div className="flex flex-wrap items-center gap-3 rounded-[8px] border border-[#FCEFDA] bg-[#FDF7EC] px-[14px] py-[10px]">
      <span className="text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]">
        {done} of {steps.length} done
      </span>
      <Bar done={done} total={steps.length} className="min-w-[60px] flex-1" />
      <button type="button" className={cn(textButton, "text-[14px]")} onClick={() => onStep(next)}>
        Add {next.toLowerCase()}
      </button>
    </div>
  ) : null;

export const CompletenessList = ({ steps, done, onStep }: { steps: Steps; done: number; onStep: (step: StepName) => void }) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center justify-between gap-3">
      <span className="text-[14px] font-medium text-[#1A202C]">Profile completeness</span>
      <span className="text-[12px] tabular-nums text-[#767980]">
        {done} of {steps.length}
      </span>
    </div>
    <Bar done={done} total={steps.length} />
    <ul className="flex flex-col">
      {steps.map(([step, ok]) => (
        <li key={step} className="flex items-center gap-[10px] py-2 text-[14px]">
          <span
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full",
              ok ? "bg-[#CBE7D1] text-[#1E7431]" : "border border-dashed border-[#C1C1B8]"
            )}
          >
            {ok ? <Check className="size-3" strokeWidth={2.5} aria-hidden="true" /> : null}
          </span>
          <span className={cn("flex-1", ok ? "text-[#767980]" : "text-[#1A202C]")}>{step}</span>
          {!ok ? (
            <button type="button" className={textButton} onClick={() => onStep(step)}>
              Add
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  </div>
);
