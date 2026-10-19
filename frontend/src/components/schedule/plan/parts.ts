/**
 * Plan next week (Working Copy 4 planweek.js, `.pw-*`).
 */
import { cn } from "@/lib/utils";
import { iconButton } from "../styles";

/** `.pw-wrap` */
export const planWrap = "mx-auto flex w-full max-w-[1000px] flex-col gap-5";

export const navArrow = cn(iconButton, "size-[30px] bg-light-300");

export const planCard = "flex flex-col gap-5 rounded-card border border-light-525 bg-light-300 px-[18px] pb-5 pt-[22px] md:px-[25px] md:pb-[25px] md:pt-[30px]";

export const stepBtn = (state: "on" | "done" | "idle") =>
  cn(
    "flex flex-1 items-center gap-2.5 rounded-control border px-3.5 py-3 text-left text-label-sm",
    state === "on" && "border-primary bg-primary-50 text-dark",
    state === "done" && "border-light-525 bg-light-300 text-dark-300",
    state === "idle" && "border-light-525 bg-light-300 text-dark-300",
  );

export const stepNum = (state: "on" | "done" | "idle") =>
  cn(
    "flex size-[22px] flex-none items-center justify-center rounded-full text-label-xsm",
    state === "on" && "border border-primary text-primary",
    state === "done" && "border border-success-300 bg-success-100 text-success-800",
    state === "idle" && "border border-light-600 text-dark-300",
  );

export const dayCol = (has: boolean) =>
  cn(
    "flex min-h-0 flex-col gap-2 rounded-card border border-light-525 p-2 md:min-h-[220px]",
    has ? "bg-light-300" : "bg-light",
  );

export const dateTile =
  "flex h-[66px] w-[52px] flex-none flex-col items-center justify-center gap-[3px] rounded-control border border-light-525 bg-light-300 max-md:h-[56px] max-md:w-[44px]";
export const dateTileMonth = "text-label-xsm text-primary";
export const dateTileNumber = "text-card-title";
export const dateTileWeekday = "text-label-xsm text-dark-300";

export const chip = (isNew: boolean) =>
  cn(
    "flex flex-col gap-1 rounded-control border bg-light-300 p-2",
    isNew ? "border-primary-300" : "border-light-525",
  );

export const addDay =
  "mt-auto flex h-8 items-center justify-center gap-1 rounded-control border border-dashed border-light-600 text-label-sm text-dark-300 hover:border-dark-200 hover:text-dark [&>svg]:size-3";

export const dayStripDot = (on: boolean) =>
  cn("block size-[14px] rounded-pill", on ? "bg-primary" : "bg-light-550");

export const pickRow =
  "flex w-full items-center gap-3 rounded-control border border-light-525 bg-light-300 px-3.5 py-3 text-left hover:bg-light-200";

export const sendRow = "flex items-center gap-3 border-t border-light-525 py-3 first:border-0 first:pt-0";

export const smallSwitch =
  "h-5 w-9 border-0 p-0.5 data-[state=checked]:bg-primary [&>span]:size-4 [&>span]:bg-light-50 [&>span]:data-[state=checked]:translate-x-4";

/** Kept for PlanSessionDialog edit sheet callers. */
export const planRow = (draft: boolean) =>
  cn("flex items-center gap-3 rounded-control border border-light-525 p-3", draft ? "bg-light-300" : "bg-transparent");
export const addSession =
  "flex min-h-target w-full items-center justify-center gap-2 rounded-control border border-dashed border-light-600 text-body-m text-dark-300 hover:border-dark-200 hover:text-dark disabled:border-light-525 disabled:text-dark-200 [&>svg]:size-4";
export const sendPanel = "flex flex-col gap-3 rounded-card border border-light-525 bg-light-300 p-4";
export const rangeTitle = "text-highlight text-dark";
