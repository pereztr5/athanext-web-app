import { cn } from "@/lib/utils";

/** Shared class strings for My Schedule (ATH-71), from the brand kit used across the app. */
export const primaryButton =
  "inline-flex h-[34px] items-center justify-center gap-[6px] rounded-[8px] border border-[#6698D2] bg-[#0054B4] px-4 text-[16px] font-medium leading-[18px] tracking-[-0.03em] text-[#F1F1E6] transition-colors hover:bg-[#004390] disabled:cursor-not-allowed disabled:opacity-50 [&>svg]:size-4";
export const secondaryButton =
  "inline-flex h-[34px] items-center justify-center gap-[6px] rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] px-4 text-[16px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C] transition-colors hover:border-[#C1C1B8] disabled:cursor-not-allowed disabled:opacity-50 [&>svg]:size-4";
export const dangerButton =
  "inline-flex h-[34px] items-center justify-center gap-[6px] rounded-[8px] border border-[#FDB5B5] bg-[#FEDADA] px-4 text-[16px] font-medium leading-[18px] tracking-[-0.03em] text-[#972B2B] transition-colors hover:bg-[#FDB5B5] disabled:cursor-not-allowed disabled:opacity-50";
/** Small button size (Working Copy `.btn.sm`): add with cn() after a button class. */
export const smallButton = "h-[30px] px-3 text-[14px]";
export const textButton =
  "inline-flex items-center gap-1 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#0054B4] hover:underline disabled:opacity-50 [&>svg]:size-4";
export const dangerTextButton =
  "inline-flex items-center gap-1 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#972B2B] hover:underline disabled:opacity-50 [&>svg]:size-4";
export const iconButton =
  "inline-flex size-[34px] items-center justify-center rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] text-[#1A202C] transition-colors hover:bg-[#EAEADF] disabled:cursor-not-allowed disabled:opacity-40 [&>svg]:size-4";

export const card =
  "flex flex-col gap-5 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[18px] pb-5 pt-[22px] md:px-[25px] md:pb-[25px] md:pt-[30px]";

/** Page title (Working Copy `.h1`): 32px, 26px on phone. */
export const pageTitle = "text-[26px] font-bold leading-[26px] tracking-[-0.05em] text-[#1A202C] md:text-[32px] md:leading-[28px]";
export const label = "text-[12px] font-medium leading-[13px] tracking-[-0.03em] text-[#767980]";
export const meta = "text-[12px] leading-[16px] tracking-[-0.03em] text-[#767980]";
export const body = "text-[14px] leading-[18px] tracking-[-0.03em] text-[#484D56]";
export const input =
  "h-[38px] w-full rounded-[8px] border-0 bg-[#F1F1E6] px-3 text-[14px] text-[#1A202C] placeholder:text-[#A3A6AB] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]";

export const modalSurface =
  "bg-[#F7F7F0] border border-[#EAEADF] rounded-[10px] sm:rounded-[10px] shadow-[0_0_15px_rgba(0,0,0,0.05)] font-sans text-[#1A202C] tracking-[-0.03em]";
export const closeButtonOverride =
  "[&>button]:text-[#767980] [&>button]:opacity-100 [&>button:hover]:text-[#1A202C] [&>button]:right-[13px] [&>button]:top-[11px] sm:[&>button]:right-[17px] sm:[&>button]:top-[19px] [&>button_svg]:stroke-[1.5]";
export const dialogContent = cn(
  "max-h-[90vh] w-[calc(100vw-32px)] max-w-[520px] gap-0 overflow-y-auto p-0",
  modalSurface,
  closeButtonOverride
);

/** Segmented control button. */
export const segButton = (on: boolean) =>
  cn(
    "inline-flex h-[32px] flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] border px-[10px] text-[14px] font-medium leading-[18px] tracking-[-0.03em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2] [&>svg]:size-4",
    on ? "border-[#EAEADF] bg-[#F7F7F0] text-[#1A202C]" : "border-transparent text-[#767980] hover:text-[#1A202C]"
  );
export const segGroup = "flex gap-1 rounded-[8px] bg-[#F1F1E6] p-[3px]";

/** Choice tile (times, places, athletes). */
export const choice = (on: boolean) =>
  cn(
    "inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[14px] font-medium leading-[18px] tracking-[-0.03em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2] disabled:cursor-not-allowed disabled:opacity-50 [&>svg]:size-4",
    on ? "border-[#6698D2] bg-[#E5EDF7] text-[#0054B4]" : "border-[#EAEADF] bg-[#F4F4EB] text-[#1A202C] hover:bg-[#EAEADF]"
  );

/** Day tile in week strips (Working Copy `.dayc`): solid blue when picked. */
export const dayTile = (on: boolean) =>
  cn(
    "flex flex-col items-center gap-0.5 rounded-[12px] border pb-2 pt-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2] disabled:cursor-default disabled:border-dashed disabled:bg-transparent disabled:opacity-45",
    on ? "border-[#0054B4] bg-[#0054B4] text-[#F1F1E6]" : "border-[#EAEADF] bg-[#F4F4EB] text-[#1A202C] hover:enabled:border-[#6698D2]"
  );
export const dayTileWeekday = (on: boolean) => cn("text-[12px] leading-[14px]", on ? "text-[#D6E3F5]" : "text-[#767980]");
export const dayTileNumber = "text-[17px] font-semibold leading-[22px] md:text-[18px]";

/** Time tile (Working Copy `.tp`): solid blue when picked, dashed when taken. */
export const timeTile = (on: boolean, group = false) =>
  cn(
    "flex flex-col items-center justify-center gap-0.5 rounded-[12px] border text-[16px] font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2] disabled:cursor-default disabled:border-dashed disabled:bg-transparent disabled:text-[#A3A6AB]",
    on
      ? "border-[#0054B4] bg-[#0054B4] text-[#F1F1E6]"
      : group
        ? "border-[#A9D4E0] bg-[#E7F4F8] text-[#1A202C] hover:enabled:border-[#6698D2]"
        : "border-[#EAEADF] bg-[#F7F7F0] text-[#1A202C] hover:enabled:border-[#6698D2]"
  );
export const timeTileNote = (on: boolean, group = false) =>
  cn("inline-flex items-center gap-1 text-[11px] font-medium [&>svg]:size-3", on ? "text-[#D6E3F5]" : group ? "text-[#117A96]" : "text-[#767980]");

/** Left accent and tint per calendar item kind. */
export const ITEM_TONE: Record<string, string> = {
  booked: "border-l-[#0054B4] bg-[#E5EDF7]",
  group: "border-l-[#117A96] bg-[#E7F4F8]",
  request: "border-l-[#F0B144] bg-[#FCEFDA]",
  offered: "border-dashed border-l-[#6698D2] bg-[#F9F9F5]",
  open: "border-dashed border-l-[#C1C1B8] bg-[#F9F9F5]",
  busy: "border-l-[#A3A6AB] bg-[#F1F1E6]",
};
