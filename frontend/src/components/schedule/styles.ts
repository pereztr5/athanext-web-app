import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/** Shared class strings used across the app, built on the AthaNext Design System primitives. */
export const primaryButton = buttonVariants({ variant: "default" });
export const secondaryButton = buttonVariants({ variant: "secondary" });
export const dangerButton = buttonVariants({ variant: "destructive" });
/** Small button size (`btn-sm`): add with cn() after a button class. */
export const smallButton = "h-control-sm px-3 text-label-sm";
export const textButton =
  "inline-flex items-center gap-1 text-label-sm text-primary hover:text-primary-600 disabled:text-dark-200 [&>svg]:size-4";
export const dangerTextButton =
  "inline-flex items-center gap-1 text-label-sm text-error-700 hover:text-error-600 disabled:text-dark-200 [&>svg]:size-4";
export const iconButton =
  "inline-flex size-control items-center justify-center rounded-control border border-light-525 bg-light-400 text-dark transition-colors hover:border-light-600 disabled:cursor-not-allowed disabled:bg-light-400 disabled:text-dark-200 [&>svg]:size-4";

/** Card: light-300, light-525 hairline, radius-card. Padding 30/25/25, phone 22/18/20. No shadow. */
export const card =
  "flex flex-col gap-5 rounded-card border border-light-525 bg-light-300 px-[18px] pb-5 pt-[22px] md:px-[25px] md:pb-[25px] md:pt-[30px]";

/** Page title: t-page-title, t-page-title-phone on phone. */
export const pageTitle = "text-page-title-phone text-dark md:text-page-title";
export const label = "text-label-xsm text-dark-300";
export const meta = "text-caption text-dark-300";
export const body = "text-body-m text-dark";
export const input =
  "h-input w-full rounded-control border border-dark-250 bg-light px-3 text-body-m text-dark placeholder:text-dark-200 hover:border-dark-300 focus:border-primary focus:outline focus:outline-2 focus:-outline-offset-1 focus:outline-primary";

/** Modal surface: the only in-page element with a shadow. */
export const modalSurface =
  "bg-light-300 border border-light-525 rounded-card sm:rounded-card shadow-overlay font-sans text-dark tracking-[-0.03em]";
export const closeButtonOverride =
  "[&>button]:text-dark [&>button]:opacity-100 [&>button:hover]:bg-light-400 [&>button]:right-[13px] [&>button]:top-[11px] sm:[&>button]:right-[17px] sm:[&>button]:top-[15px] [&>button_svg]:stroke-[1.5]";
export const dialogContent = cn(
  "max-h-[90dvh] w-[calc(100vw-32px)] max-w-[520px] gap-0 overflow-y-auto p-0",
  modalSurface,
  closeButtonOverride
);

/** Segmented control: light track, selected chip light-50 with a light-550 border. */
export const segButton = (on: boolean) =>
  cn(
    "inline-flex h-7 flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] border px-2.5 text-label-sm transition-colors [&>svg]:size-4",
    on ? "border-light-550 bg-light-50 text-dark" : "border-transparent text-dark-300 hover:text-dark"
  );
export const segGroup = "flex gap-1 rounded-control bg-light p-[3px]";

/** Choice row/tile: the one selected style for choices (primary-50 fill, 1px primary border). */
export const choice = (on: boolean) =>
  cn(
    "inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-control border px-3 py-1.5 text-body-m transition-colors disabled:cursor-not-allowed disabled:border-light-525 disabled:bg-light-400 disabled:text-dark-200 [&>svg]:size-4",
    on ? "border-primary bg-primary-50 text-primary" : "border-light-525 bg-light-300 text-dark hover:bg-light-200"
  );

/** Day tile in week strips: solid blue when picked. */
export const dayTile = (on: boolean) =>
  cn(
    "flex flex-col items-center gap-0.5 rounded-card border pb-2 pt-2.5 transition-colors disabled:cursor-default disabled:border-dashed disabled:border-light-600 disabled:bg-transparent disabled:text-dark-200",
    on ? "border-primary bg-primary text-light" : "border-light-525 bg-light-400 text-dark hover:enabled:border-primary-300"
  );
export const dayTileWeekday = (on: boolean) => cn("text-caption", on ? "text-primary-100" : "text-dark-300");
export const dayTileNumber = "text-card-title";

/** Time tile: solid blue when picked, dashed when taken. */
export const timeTile = (on: boolean, group = false) =>
  cn(
    "flex flex-col items-center justify-center gap-0.5 rounded-card border text-subtitle tabular-nums transition-colors disabled:cursor-default disabled:border-dashed disabled:border-light-600 disabled:bg-transparent disabled:text-dark-200",
    on
      ? "border-primary bg-primary text-light"
      : group
        ? "border-secondary-300 bg-secondary-50 text-dark hover:enabled:border-primary-300"
        : "border-light-525 bg-light-300 text-dark hover:enabled:border-primary-300"
  );
export const timeTileNote = (on: boolean, group = false) =>
  cn("inline-flex items-center gap-1 text-label-xsm [&>svg]:size-3", on ? "text-primary-100" : group ? "text-secondary-700" : "text-dark-300");

/** Left accent and tint per calendar item kind. */
export const ITEM_TONE: Record<string, string> = {
  booked: "border-primary-300 border-l-primary bg-primary-50",
  group: "border-secondary-300 border-l-secondary-600 bg-secondary-50",
  request: "border-info-300 border-l-info-600 bg-info-100",
  offered: "border-dashed border-l-primary-300 bg-light-200",
  open: "border-dashed border-l-light-600 bg-light-200",
  busy: "border-l-dark-200 bg-light",
};
