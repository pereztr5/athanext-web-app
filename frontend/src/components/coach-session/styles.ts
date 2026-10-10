import { dialogContent } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";

/** Class strings for the coach's session page (Working Copy `.sp-*`). */
/** Working Copy `.cap`. */
export const cap = "text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]";
/** Working Copy `.h3`. */
export const h3 = "text-[16px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]";
/** Working Copy `.card.sp-card`. */
export const spCard = "flex min-w-0 flex-col gap-3 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] p-4 md:p-5";
/** Session dialogs are as wide as the Working Copy modal. */
export const spDialog = cn(dialogContent, "max-w-[640px]");
