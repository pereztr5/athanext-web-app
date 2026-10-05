import { cn } from "@/lib/utils";

/** Shared class strings for My Schedule (ATH-71), from the brand kit used across the app. */
export const primaryButton =
  "inline-flex h-[34px] items-center justify-center gap-[6px] rounded-[8px] border border-[#6698D2] bg-[#0054B4] px-4 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#F1F1E6] transition-colors hover:bg-[#004390] disabled:cursor-not-allowed disabled:opacity-50 [&>svg]:size-4";
export const secondaryButton =
  "inline-flex h-[34px] items-center justify-center gap-[6px] rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] px-4 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C] transition-colors hover:bg-[#EAEADF] disabled:cursor-not-allowed disabled:opacity-50 [&>svg]:size-4";
export const dangerButton =
  "inline-flex h-[34px] items-center justify-center gap-[6px] rounded-[8px] border border-[#FDB5B5] bg-[#FEDADA] px-4 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#972B2B] transition-colors hover:bg-[#FDB5B5] disabled:cursor-not-allowed disabled:opacity-50";
export const textButton =
  "inline-flex items-center gap-1 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#0054B4] hover:underline disabled:opacity-50 [&>svg]:size-4";
export const dangerTextButton =
  "inline-flex items-center gap-1 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#972B2B] hover:underline disabled:opacity-50 [&>svg]:size-4";
export const iconButton =
  "inline-flex size-[34px] items-center justify-center rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] text-[#1A202C] transition-colors hover:bg-[#EAEADF] disabled:cursor-not-allowed disabled:opacity-40 [&>svg]:size-4";

export const card = "flex flex-col gap-5 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] p-4 md:p-[25px]";
export const label = "text-[12px] font-medium leading-[13px] tracking-[-0.03em] text-[#767980]";
export const meta = "text-[12px] leading-[16px] tracking-[-0.03em] text-[#767980]";
export const body = "text-[14px] leading-[18px] tracking-[-0.03em] text-[#484D56]";
export const input =
  "h-[38px] w-full rounded-[8px] border border-[#EAEADF] bg-[#F9F9F5] px-3 text-[14px] text-[#1A202C] placeholder:text-[#A3A6AB] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]";

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
    "inline-flex h-[32px] flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] px-3 text-[14px] font-medium leading-[18px] tracking-[-0.03em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2] [&>svg]:size-4",
    on ? "bg-[#F9F9F5] text-[#0054B4] shadow-[0_0_0_1px_#EAEADF]" : "text-[#767980] hover:text-[#1A202C]"
  );
export const segGroup = "flex gap-1 rounded-[8px] bg-[#F1F1E6] p-1";

/** Choice tile (times, places, athletes). */
export const choice = (on: boolean) =>
  cn(
    "inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[14px] font-medium leading-[18px] tracking-[-0.03em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2] disabled:cursor-not-allowed disabled:opacity-50 [&>svg]:size-4",
    on ? "border-[#6698D2] bg-[#E5EDF7] text-[#0054B4]" : "border-[#EAEADF] bg-[#F4F4EB] text-[#1A202C] hover:bg-[#EAEADF]"
  );

/** Left accent and tint per calendar item kind. */
export const ITEM_TONE: Record<string, string> = {
  booked: "border-l-[#0054B4] bg-[#E5EDF7]",
  group: "border-l-[#117A96] bg-[#E7F4F8]",
  request: "border-l-[#F0B144] bg-[#FCEFDA]",
  offered: "border-dashed border-l-[#6698D2] bg-[#F9F9F5]",
  open: "border-dashed border-l-[#C1C1B8] bg-[#F9F9F5]",
  busy: "border-l-[#A3A6AB] bg-[#F1F1E6]",
};
