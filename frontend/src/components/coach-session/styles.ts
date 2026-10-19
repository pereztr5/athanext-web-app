import { dialogContent } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";

/** Class strings for the coach's session page (Working Copy `.sp-*`). */
/** Working Copy `.cap`. */
export const cap = "text-caption text-dark-300";
/** Working Copy `.h3`. */
export const h3 = "text-subtitle text-dark";
/** Working Copy `.card.sp-card`. */
export const spCard = "flex min-w-0 flex-col gap-3 rounded-card border border-light-525 bg-light-300 p-4 md:p-5";
/** Session dialogs are as wide as the Working Copy modal. */
export const spDialog = cn(dialogContent, "max-w-[640px]");
