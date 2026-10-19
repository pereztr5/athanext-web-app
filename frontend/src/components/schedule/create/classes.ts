/**
 * Local pieces of the Create session sheet and its share step (Working Copy 2 coach7.js,
 * `.cs-*` and `.modal.sheet` in styles.css).
 */
import { cn } from "@/lib/utils";

/** `.modal.sheet`: 480 wide; header and footer split off by a line. Phone pins it to the bottom. */
export const sheetContent = "max-w-[480px]";
export const phoneSheet =
  "max-md:!inset-x-0 max-md:!bottom-0 max-md:!top-auto max-md:!h-auto max-md:!max-h-[92svh] max-md:!w-full max-md:!max-w-none max-md:!translate-x-0 max-md:!translate-y-0 max-md:!rounded-b-none";
export const sheetHeader = "gap-1.5 border-b border-light-525 px-4 py-5 pr-14 text-left md:px-[25px]";
export const sheetTitle = "text-card-title text-dark md:text-section";
export const sheetBody = "flex flex-col gap-4 px-4 py-5 md:px-[25px]";
export const sheetFooter = "sticky bottom-0 z-10 flex gap-2.5 border-t border-light-525 bg-light-300 px-4 py-4 md:px-[25px]";
/** `.modal.sheet .mf .btn.full` */
export const sheetButton = "h-[48px] w-full";
export const backLink =
  "-ml-0.5 inline-flex items-center gap-1 self-start text-label-sm text-dark-300 hover:text-dark [&>svg]:size-4";

/** `.cs-locs button`, `.cs-ath button`: 36px pills. */
export const chip = (on: boolean) =>
  cn(
    "inline-flex h-[36px] items-center gap-1.5 rounded-control border px-3 text-label-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&>svg]:size-3.5",
    on ? "border-primary bg-primary-50 text-primary" : "border-light-525 bg-light-300 text-dark hover:bg-light-200"
  );
export const addChip =
  "inline-flex h-[36px] items-center gap-1.5 rounded-control border border-dashed border-light-600 px-3 text-label-sm text-primary hover:bg-light-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&>svg]:size-3.5";

/** `.cs-share button`: icon over label. */
export const shareTile = (on = false) =>
  cn(
    "flex flex-col items-center gap-1 rounded-card border px-1 py-2.5 text-label-xsm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&>svg]:size-[18px]",
    on ? "border-primary bg-primary-50 text-primary" : "border-light-525 bg-light-300 text-dark hover:bg-light-200"
  );

/** `.cs-grp`: group fields on a teal tint, white inputs. */
export const groupBox = "flex flex-col gap-2.5 rounded-card border border-secondary-300 bg-secondary-50 p-3";
export const whiteInput = "bg-light-50";

/** `.cs-tz` */
export const timeZonePill =
  "inline-flex items-center gap-1 rounded-pill border border-info-300 bg-info-100 px-2 py-0.5 text-label-xsm text-info-800 [&>svg]:size-3";

/** `.info.warm` */
export const warmInfo =
  "flex items-start gap-2.5 rounded-control border border-info-300 bg-info-50 px-3.5 py-3 text-paragraph-sm text-info-700 [&>svg]:mt-[-1px] [&>svg]:size-4 [&>svg]:flex-none";
