/**
 * Plan next week (Working Copy 4 planweek.js, `.pw-*`).
 */
import { cn } from "@/lib/utils";
import { iconButton } from "../styles";

/** `.pw-wrap` */
export const planWrap = "mx-auto flex w-full max-w-[1000px] flex-col gap-5";

export const navArrow = cn(iconButton, "size-[30px] bg-[#F7F7F0]");

export const planCard = "flex flex-col gap-4 rounded-[12px] border border-[#EAEADF] bg-[#F7F7F0] p-4 md:p-5";

export const stepBtn = (state: "on" | "done" | "idle") =>
  cn(
    "flex flex-1 items-center gap-2.5 rounded-[8px] border px-3.5 py-3 text-left text-[14px] font-medium",
    state === "on" && "border-[#0054B4] text-[#1A202C] shadow-[inset_0_0_0_1px_#0054B4]",
    state === "done" && "border-[#EAEADF] bg-[#F7F7F0] text-[#767980]",
    state === "idle" && "border-[#EAEADF] bg-[#F7F7F0] text-[#767980]",
  );

export const stepNum = (state: "on" | "done" | "idle") =>
  cn(
    "flex size-[22px] flex-none items-center justify-center rounded-full text-[12px]",
    state === "on" && "border border-[#0054B4] text-[#0054B4]",
    state === "done" && "border-0 bg-[#CBE7D1] text-[#1E7431]",
    state === "idle" && "border border-[#C1C1B8] text-[#767980]",
  );

export const dayCol = (has: boolean) =>
  cn(
    "flex min-h-0 flex-col gap-2 rounded-[10px] border border-[#EAEADF] p-2 md:min-h-[220px]",
    has ? "bg-[#FDFDFC]" : "bg-[#F1F1E6]",
  );

export const dateTile =
  "flex h-[66px] w-[52px] flex-none flex-col items-center justify-center gap-[3px] rounded-[8px] border border-[#EAEADF] bg-[#F7F7F0] max-md:h-[56px] max-md:w-[44px]";
export const dateTileMonth = "text-[12px] font-semibold leading-[13px] tracking-[-0.03em] text-[#0054B4]";
export const dateTileNumber = "text-[22px] font-bold leading-[22px] tracking-[-0.05em] max-md:text-[18px] max-md:leading-[18px]";
export const dateTileWeekday = "text-[12px] font-medium leading-[13px] text-[#767980]";

export const chip = (isNew: boolean) =>
  cn(
    "flex flex-col gap-1 rounded-[8px] border bg-[#F7F7F0] p-2",
    isNew ? "border-[#6698D2]" : "border-[#EAEADF]",
  );

export const addDay =
  "mt-auto flex h-8 items-center justify-center gap-1 rounded-[8px] border border-dashed border-[#C1C1B8] text-[14px] font-medium text-[#0054B4] hover:border-[#6698D2] [&>svg]:size-3";

export const dayStripDot = (on: boolean) =>
  cn("block size-[14px] rounded-[4px]", on ? "bg-[#0054B4]" : "bg-[#D9D9CF]");

export const pickRow =
  "flex w-full items-center gap-3 rounded-[8px] border border-[#EAEADF] bg-[#FDFDFC] px-3.5 py-3 text-left hover:border-[#6698D2]";

export const sendRow = "flex items-center gap-3 border-t border-[#EAEADF] py-3 first:border-0 first:pt-0";

export const smallSwitch =
  "h-5 w-9 border-0 p-0.5 data-[state=checked]:bg-[#0054B4] [&>span]:size-4 [&>span]:bg-[#FDFDFC] [&>span]:data-[state=checked]:translate-x-4";

/** Kept for PlanSessionDialog edit sheet callers. */
export const planRow = (draft: boolean) =>
  cn("flex items-center gap-3 rounded-[12px] border border-[#EAEADF] p-3", draft ? "bg-[#F7F7F0]" : "bg-transparent");
export const addSession =
  "flex h-[44px] w-full items-center justify-center gap-1.5 rounded-[12px] border border-dashed border-[#C1C1B8] text-[15px] font-medium text-[#0054B4] hover:bg-[#F4F4EB] disabled:opacity-50 [&>svg]:size-4";
export const sendPanel = "flex flex-col gap-3 rounded-[12px] border border-[#EAEADF] bg-[#F7F7F0] p-4";
export const rangeTitle = "text-[30px] font-semibold leading-[1.1] tracking-[-0.04em] text-[#1A202C]";
