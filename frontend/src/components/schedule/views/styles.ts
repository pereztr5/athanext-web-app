import { cn } from "@/lib/utils";
import type { ScheduleItemKind } from "@/utils/schedule";

/** Class strings for My schedule views (Working Copy `.sch-*`), local to the schedule page. */

/** Google Calendar busy times and days off. */
export const striped = "bg-light-525";

/** Week chip (`.sch-chip`): white card with a blue left edge, tinted per kind. */
export const chipBox = (kind: ScheduleItemKind, draft = false) =>
  cn(
    "flex w-full min-w-0 flex-col rounded-control border border-light-525 border-l-[3px] border-l-primary bg-light-300 px-2 py-[7px] text-left transition-colors hover:bg-light-200",
    kind === "group" && (draft ? "border border-dashed border-primary-200 bg-transparent" : "border-secondary-300 border-l-secondary-600 bg-secondary-50"),
    kind === "request" && "border-info-300 border-l-info-600 bg-info-100",
    (kind === "open" || kind === "offered") && "border border-dashed border-primary-200 bg-transparent",
    kind === "busy" && cn(striped, "border-l-light-600 hover:bg-light-525")
  );
export const chipTime = "w-full truncate text-caption text-dark-300";
export const chipName = (kind: ScheduleItemKind) =>
  cn(
    "w-full truncate text-label-xsm text-dark",
    (kind === "open" || kind === "offered") && "text-primary",
    kind === "busy" && "text-dark-300"
  );
export const chipSub = (kind: ScheduleItemKind) =>
  cn(
    "w-full truncate text-caption text-dark-300",
    kind === "group" && "text-secondary-700",
    kind === "request" && "text-info-700"
  );

/** Day row (`.sch-it`): 62px time column, then the item box. */
export const rowGrid = "grid grid-cols-[62px_minmax(0,1fr)] gap-2";
export const rowTime = "pt-3 text-label-xsm text-dark-400";
export const rowBox = (kind: ScheduleItemKind, draft = false) =>
  cn(
    "flex w-full min-w-0 items-center gap-[10px] rounded-card border border-light-525 border-l-4 border-l-primary bg-light-300 px-3 py-[10px] text-left [&_svg]:size-4 [&_svg]:flex-none",
    kind === "group" && (draft ? "border border-dashed border-primary-200 bg-transparent" : "border-secondary-300 border-l-secondary-600 bg-secondary-50"),
    kind === "request" && "border-info-300 border-l-info-600 bg-info-100",
    kind === "open" && "border border-dashed border-primary-200 bg-transparent text-primary",
    kind === "offered" && "border-dashed border-primary-200 bg-transparent [border-left-style:solid] border-l-primary",
    kind === "busy" && cn(striped, "border-l-light-600")
  );
export const rowName = (kind: ScheduleItemKind) =>
  cn(
    "text-label-sm text-dark",
    (kind === "open" || kind === "offered") && "text-primary"
  );
export const rowSub = (kind: ScheduleItemKind) =>
  cn("text-caption text-dark-300", kind === "request" && "text-info-700");

/** Small blue link inside a row (`.lnkx`). */
export const rowLink = "inline-flex flex-none items-center gap-0.5 text-label-xsm text-primary [&_svg]:!size-3";

/** Week arrows (`.ibtn.box`). */
export const navArrow =
  "inline-flex size-[30px] flex-none items-center justify-center rounded-control border border-light-525 bg-light-300 text-dark transition-colors hover:bg-light-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-light-400 disabled:text-dark-200 [&>svg]:size-4";

/** The calendar card (`.sch-card`): no card chrome on phone. */
export const calendarCard =
  "flex flex-col gap-[14px] md:rounded-card md:border md:border-light-525 md:bg-light-300 md:px-[18px] md:pb-4 md:pt-[18px]";

/** Group fill bar (`.sch-fb`). */
export const fillTrack = "block h-[5px] w-full flex-none overflow-hidden rounded-pill bg-secondary-100";
export const fillBar = "block h-full rounded-pill bg-secondary-600";

/** Clear day: error text. */
export const clearDayText = "text-error-700";

export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
