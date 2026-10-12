import { cn } from "@/lib/utils";
import type { ScheduleItemKind } from "@/utils/schedule";

/** Class strings for My Schedule views (Working Copy `.sch-*`), local to the schedule page. */

/** Google Calendar busy times and days off. */
export const striped = "bg-[repeating-linear-gradient(135deg,#ECECE2_0_6px,#E5E5DA_6px_12px)]";

/** Week chip (`.sch-chip`): white card with a blue left edge, tinted per kind. */
export const chipBox = (kind: ScheduleItemKind, draft = false) =>
  cn(
    "flex w-full min-w-0 flex-col rounded-[8px] border border-[#EAEADF] border-l-[3px] border-l-[#0054B4] bg-[#F7F7F0] px-2 py-[7px] text-left transition-shadow hover:shadow-[0_2px_8px_rgba(16,19,26,0.1)]",
    kind === "group" && (draft ? "border border-dashed border-[#117A96] bg-transparent" : "border-[#A9D4E0] border-l-[#117A96] bg-[#E7F4F8]"),
    kind === "request" && "border-[#F1D7AC] border-l-[#C26E12] bg-[#FCEFDA]",
    (kind === "open" || kind === "offered") && "border border-dashed border-[#9DB6D6] bg-transparent",
    kind === "busy" && cn(striped, "border-l-[#B9B9AD] hover:shadow-none")
  );
export const chipTime = "w-full truncate text-[11px] leading-[14px] text-[#767980]";
export const chipName = (kind: ScheduleItemKind) =>
  cn(
    "w-full truncate text-[12.5px] font-semibold leading-[16px] text-[#1A202C]",
    (kind === "open" || kind === "offered") && "font-medium text-[#0054B4]",
    kind === "busy" && "font-medium text-[#767980]"
  );
export const chipSub = (kind: ScheduleItemKind) =>
  cn(
    "w-full truncate text-[11px] leading-[14px] text-[#767980]",
    kind === "group" && "text-[#117A96]",
    kind === "request" && "text-[#906A29]"
  );

/** Day row (`.sch-it`): 62px time column, then the item box. */
export const rowGrid = "grid grid-cols-[62px_minmax(0,1fr)] gap-2";
export const rowTime = "pt-3 text-[12px] font-semibold leading-[14px] text-[#484D56]";
export const rowBox = (kind: ScheduleItemKind, draft = false) =>
  cn(
    "flex w-full min-w-0 items-center gap-[10px] rounded-[12px] border border-[#EAEADF] border-l-4 border-l-[#0054B4] bg-[#F7F7F0] px-3 py-[10px] text-left [&_svg]:size-4 [&_svg]:flex-none",
    kind === "group" && (draft ? "border border-dashed border-[#117A96] bg-transparent" : "border-[#A9D4E0] border-l-[#117A96] bg-[#E7F4F8]"),
    kind === "request" && "border-[#F1D7AC] border-l-[#C26E12] bg-[#FCEFDA]",
    kind === "open" && "border border-dashed border-[#9DB6D6] bg-transparent text-[#0054B4]",
    kind === "offered" && "border-dashed border-[#0054B4] bg-transparent [border-left-style:solid]",
    kind === "busy" && cn(striped, "border-l-[#B9B9AD]")
  );
export const rowName = (kind: ScheduleItemKind) =>
  cn(
    "text-[14px] font-semibold leading-[18px] tracking-[-0.03em] text-[#1A202C]",
    (kind === "open" || kind === "offered") && "text-[#0054B4]"
  );
export const rowSub = (kind: ScheduleItemKind) =>
  cn("text-[12px] leading-[16px] tracking-[-0.03em] text-[#767980]", kind === "request" && "text-[#906A29]");

/** Small blue link inside a row (`.lnkx`). */
export const rowLink = "inline-flex flex-none items-center gap-0.5 text-[12px] font-medium text-[#0054B4] [&_svg]:!size-3";

/** Week arrows (`.ibtn.box`). */
export const navArrow =
  "inline-flex size-[30px] flex-none items-center justify-center rounded-[8px] border border-[#EAEADF] bg-[#F7F7F0] text-[#1A202C] transition-colors hover:bg-[#F4F4EB] disabled:cursor-not-allowed disabled:opacity-40 [&>svg]:size-4";

/** The calendar card (`.sch-card`): no card chrome on phone. */
export const calendarCard =
  "flex flex-col gap-[14px] md:rounded-[10px] md:border md:border-[#EAEADF] md:bg-[#F7F7F0] md:px-[18px] md:pb-4 md:pt-[18px]";

/** Group fill bar (`.sch-fb`). */
export const fillTrack = "block h-[5px] w-full flex-none overflow-hidden rounded-[3px] bg-[#C9E3EB]";
export const fillBar = "block h-full rounded-[3px] bg-[#117A96]";

/** Clear day (Working Copy red). */
export const clearDayText = "text-[#B4231B]";

export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
