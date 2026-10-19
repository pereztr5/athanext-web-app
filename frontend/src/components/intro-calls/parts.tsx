/** Shared pieces for free intro calls (Working Copy `.ic-*`). */
import type { ReactNode } from "react";
import { Video } from "@/components/icons";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { meta } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { capText, mText } from "./helpers";

/** The profile row: blue video box, title and caption, then an action (Working Copy `.ic-row`). */
export const IntroRow = ({ off, title, caption, action }: { off?: boolean; title: string; caption: ReactNode; action?: ReactNode }) => (
  <div
    className={cn(
      "grid grid-cols-[40px_minmax(0,1fr)] items-start gap-3 rounded-control border px-[14px] py-3 md:flex md:items-center",
      off ? "border-dashed border-light-600 bg-transparent" : "border-light-525 bg-light-400"
    )}
  >
    <span
      className={cn(
        "inline-flex size-10 flex-none items-center justify-center rounded-control [&>svg]:size-5",
        off ? "bg-light text-dark-300" : "bg-primary-50 text-primary"
      )}
    >
      <Video strokeWidth={1.5} aria-hidden="true" />
    </span>
    <span className="flex min-w-0 grow flex-col gap-1">
      <span className={mText}>{title}</span>
      <span className={capText}>{caption}</span>
    </span>
    {action ? <span className="col-start-2 justify-self-start md:flex-none">{action}</span> : null}
  </div>
);

export const SheetHeader = ({ title, description }: { title: string; description?: string }) => (
  <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
    <DialogTitle className="text-section">{title}</DialogTitle>
    {description ? <DialogDescription className={meta}>{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
  </DialogHeader>
);
