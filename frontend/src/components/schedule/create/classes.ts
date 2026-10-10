/**
 * Local pieces of the Create session sheet and its share step (Working Copy 2 coach7.js,
 * `.cs-*` and `.modal.sheet` in styles.css).
 */
import { cn } from "@/lib/utils";

/** `.modal.sheet`: 480 wide; header and footer split off by a line. */
export const sheetContent = "max-w-[480px]";
export const sheetHeader = "gap-1.5 border-b border-[#EAEADF] px-4 py-5 pr-14 text-left md:px-[25px]";
export const sheetTitle = "text-[20px] font-semibold leading-[24px] tracking-[-0.05em] md:text-[24px] md:leading-[30px]";
export const sheetBody = "flex flex-col gap-4 px-4 py-5 md:px-[25px]";
export const sheetFooter = "sticky bottom-0 z-10 flex gap-2.5 border-t border-[#EAEADF] bg-[#F7F7F0] px-4 py-4 md:px-[25px]";
/** `.modal.sheet .mf .btn.full` */
export const sheetButton = "h-[48px] w-full";
export const backLink =
  "-ml-0.5 inline-flex items-center gap-1 self-start text-[14px] font-medium leading-[18px] text-[#767980] hover:text-[#1A202C] [&>svg]:size-4";

/** `.cs-locs button`, `.cs-ath button`: 36px pills. */
export const chip = (on: boolean) =>
  cn(
    "inline-flex h-[36px] items-center gap-1.5 rounded-[18px] border px-3 text-[13px] font-medium leading-[16px] tracking-[-0.03em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2] [&>svg]:size-3.5",
    on ? "border-[#0054B4] bg-[#E5EDF7] text-[#0054B4]" : "border-[#EAEADF] bg-[#F7F7F0] text-[#1A202C] hover:border-[#6698D2]"
  );
export const addChip =
  "inline-flex h-[36px] items-center gap-1.5 rounded-[18px] border border-dashed border-[#EAEADF] px-3 text-[13px] font-medium leading-[16px] text-[#0054B4] hover:border-[#6698D2] [&>svg]:size-3.5";

/** `.cs-share button`: icon over label. */
export const shareTile = (on = false) =>
  cn(
    "flex flex-col items-center gap-1 rounded-[12px] border bg-[#F7F7F0] px-1 py-2.5 text-[12px] font-medium leading-[14px] tracking-[-0.03em] transition-colors hover:border-[#6698D2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2] [&>svg]:size-[18px]",
    on ? "border-[#0054B4] text-[#0054B4]" : "border-[#EAEADF] text-[#1A202C]"
  );

/** `.cs-grp`: group fields on a teal tint, white inputs. */
export const groupBox = "flex flex-col gap-2.5 rounded-[12px] bg-[#E7F4F8] p-3";
export const whiteInput = "bg-white";

/** `.cs-tz` */
export const timeZonePill =
  "inline-flex items-center gap-1 rounded-[4px] bg-[#FCEFDA] px-2 py-0.5 text-[12px] font-medium leading-[16px] text-[#906A29] [&>svg]:size-3";

/** `.info.warm` */
export const warmInfo =
  "flex items-start gap-2.5 rounded-[8px] bg-[#FCEFDA] px-3.5 py-3 text-[12px] leading-[14px] text-[#906A29] [&>svg]:mt-[-1px] [&>svg]:size-4 [&>svg]:flex-none";
