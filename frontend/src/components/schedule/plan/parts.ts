/**
 * Local pieces of New schedule (Working Copy 2 coach6.js, `.pl-*` in styles.css).
 */
import { cn } from "@/lib/utils";
import { iconButton } from "../styles";

/** `.pl-wrap` */
export const planWrap = "mx-auto flex w-full max-w-[640px] flex-col gap-[14px]";
/** `.pl-nav .ibtn.box`: 30px arrows. */
export const navArrow = cn(iconButton, "size-[30px] bg-[#F7F7F0]");
/** `.pl-big` */
export const rangeTitle = "text-[30px] font-semibold leading-[1.1] tracking-[-0.04em] text-[#1A202C]";

/** `.pl-row`: drafts on a card, live sessions see-through. */
export const planRow = (draft: boolean) =>
  cn("flex items-center gap-3 rounded-[12px] border border-[#EAEADF] p-3", draft ? "bg-[#F7F7F0]" : "bg-transparent");
/** `.pl-row .dt.lt` */
export const dateTile =
  "flex h-[48px] w-[44px] flex-none flex-col items-center justify-center rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] text-[#1A202C]";
export const dateTileWeekday = "text-[10px] font-medium uppercase leading-[12px] tracking-[0.05em] text-[#767980]";
export const dateTileNumber = "text-[18px] font-bold leading-none tracking-[-0.03em]";

/** `.addmore` */
export const addSession =
  "flex h-[44px] w-full items-center justify-center gap-1.5 rounded-[12px] border border-dashed border-[#C1C1B8] text-[15px] font-medium text-[#0054B4] hover:bg-[#F4F4EB] disabled:opacity-50 [&>svg]:size-4";

/** `.pl-send` */
export const sendPanel = "flex flex-col gap-3 rounded-[12px] border border-[#EAEADF] bg-[#F7F7F0] p-4";

/** `.sw`: 36 by 20 switch, for the shadcn Switch. */
export const smallSwitch =
  "h-5 w-9 border-0 p-0.5 data-[state=checked]:bg-[#0054B4] [&>span]:size-4 [&>span]:bg-[#FDFDFC] [&>span]:data-[state=checked]:translate-x-4";
