/**
 * Small pieces of the coach's session page (Working Copy): info boxes, avatars, fields and the
 * dialog frame (header, body and footer with dividers).
 */
import type { ReactNode } from "react";
import { CircleAlert, Clock, Info } from "lucide-react";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { label } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";

export const InfoBox = ({ warm = false, icon, children }: { warm?: boolean; icon?: "info" | "clock"; children: ReactNode }) => {
  const Icon = icon === "clock" ? Clock : Info;
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-[8px] px-3.5 py-3 text-[12px] leading-[14px] tracking-[-0.03em]",
        warm ? "bg-[#FCEFDA] text-[#906A29]" : "bg-[#F4F4EB] text-[#767980]"
      )}
    >
      <Icon className="mt-[-1px] size-4 flex-none" strokeWidth={1.5} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
};

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const Avatar = ({ name, imageUrl, size = 36 }: { name: string; imageUrl?: string | null; size?: number }) =>
  imageUrl ? (
    <img src={imageUrl} alt="" className="flex-none rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="inline-flex flex-none items-center justify-center rounded-full bg-[#F1F1E6] text-[13px] font-medium tracking-[-0.03em] text-[#484D56]"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );

export const FieldError = ({ children }: { children: ReactNode }) =>
  children ? (
    <span role="alert" className="inline-flex items-center gap-1 text-[12px] leading-[14px] text-[#972B2B] [&>svg]:size-3">
      <CircleAlert strokeWidth={1.5} aria-hidden="true" />
      {children}
    </span>
  ) : null;

export const Field = ({ title, optional, error, children }: { title: string; optional?: boolean; error?: string | null; children: ReactNode }) => (
  <label className="flex min-w-0 flex-col gap-1.5">
    <span className={label}>
      {title}
      {optional ? <span className="font-normal text-[#A3A6AB]"> (optional)</span> : null}
    </span>
    {children}
    <FieldError>{error}</FieldError>
  </label>
);

/** Working Copy `.mh`, `.mb` and `.mf`. */
export const ModalHeader = ({ title, sub }: { title: string; sub?: string }) => (
  <DialogHeader className="gap-1 border-b border-[#EAEADF] px-5 py-5 pr-14 text-left sm:px-[25px]">
    <DialogTitle className="text-[24px] font-semibold leading-[30px] tracking-[-0.05em]">{title}</DialogTitle>
    <DialogDescription className={cn(sub ? "text-[14px] leading-[18px] text-[#767980]" : "sr-only")}>{sub || title}</DialogDescription>
  </DialogHeader>
);
export const ModalBody = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-col gap-4 px-5 py-5 sm:px-[25px]">{children}</div>
);
export const ModalFooter = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-wrap justify-end gap-2.5 border-t border-[#EAEADF] px-5 py-4 sm:px-[25px]">{children}</div>
);
