/** Profile completeness (Working Copy `AN.completeness`): the amber strip in the hero and the full list in edit mode. */
import { Check } from "@/components/icons";
import { textButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import type { StepName } from "./hooks";

type Steps = [StepName, boolean][];

const Bar = ({ done, total, className }: { done: number; total: number; className?: string }) => (
  <span className={cn("block h-[5px] overflow-hidden rounded-card bg-light-550", className)}>
    <i className="block h-full rounded-card bg-primary" style={{ width: `${(done / total) * 100}%` }} />
  </span>
);

/** "7 of 8 done [bar] Add coaching video". Hidden once every step is done. */
export const CompletenessNudge = ({ steps, done, next, onStep }: { steps: Steps; done: number; next: StepName | null; onStep: (step: StepName) => void }) =>
  next ? (
    <div className="flex flex-wrap items-center gap-3 rounded-control border border-info-300 bg-info-50 px-[14px] py-[10px]">
      <span className="text-label-sm text-dark">
        {done} of {steps.length} done
      </span>
      <Bar done={done} total={steps.length} className="min-w-[60px] flex-1" />
      <button type="button" className={cn(textButton, "text-body-m")} onClick={() => onStep(next)}>
        Add {next.toLowerCase()}
      </button>
    </div>
  ) : null;

export const CompletenessList = ({ steps, done, onStep }: { steps: Steps; done: number; onStep: (step: StepName) => void }) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center justify-between gap-3">
      <span className="text-label-sm text-dark">Profile completeness</span>
      <span className="text-caption tabular-nums text-dark-300">
        {done} of {steps.length}
      </span>
    </div>
    <Bar done={done} total={steps.length} />
    <ul className="flex flex-col">
      {steps.map(([step, ok]) => (
        <li key={step} className="flex items-center gap-[10px] py-2 text-body-m">
          <span
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full",
              ok ? "border border-success-300 bg-success-100 text-success-700" : "border border-dashed border-light-600"
            )}
          >
            {ok ? <Check className="size-3" strokeWidth={2} aria-hidden="true" /> : null}
          </span>
          <span className={cn("flex-1", ok ? "text-dark-300" : "text-dark")}>{step}</span>
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
