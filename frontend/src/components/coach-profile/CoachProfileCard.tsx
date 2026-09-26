import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface CoachProfileCardProps {
  children: ReactNode;
  className?: string;
}

/** Figma WIP card: #F7F7F0 on page #F1F1E6, 10px radius, 30×25 padding */
export function CoachProfileCard({ children, className }: CoachProfileCardProps) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col gap-5 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] py-[30px]",
        className
      )}
    >
      {children}
    </div>
  );
}

interface CoachProfileCardHeaderProps {
  title: string;
  actions?: ReactNode;
  className?: string;
}

export function CoachProfileCardHeader({
  title,
  actions,
  className,
}: CoachProfileCardHeaderProps) {
  return (
    <div className={cn("flex min-h-[30px] w-full items-center justify-between gap-3", className)}>
      <h2 className="text-[20px] font-medium leading-[18px] tracking-[-1px] text-[#1A202C]">{title}</h2>
      {actions ? <div className="flex shrink-0 items-center gap-[10px]">{actions}</div> : null}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary";

interface CoachProfileButtonProps {
  children?: ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: ButtonVariant;
  type?: "button" | "submit";
}

/** Figma: primary #0054B4 / secondary #F4F4EB, h=30, radius=8 */
export function CoachProfileButton({
  children = "Edit",
  onClick,
  className,
  variant = "secondary",
  type = "button",
}: CoachProfileButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-[3px] rounded-[8px] border px-4 py-[6px] text-[14px] font-medium leading-[18px] tracking-[-0.42px]",
        variant === "primary"
          ? "border-[#6698D2] bg-[#0054B4] text-[#F1F1E6]"
          : "border-[#EAEADF] bg-[#F4F4EB] text-[#1A202C]",
        className
      )}
    >
      {children}
    </button>
  );
}

/** @deprecated use CoachProfileButton */
export function CoachProfileEditButton(props: CoachProfileButtonProps) {
  return <CoachProfileButton variant="secondary" {...props} />;
}

/** Figma pillar/label chip: #E5EDF7, radius 4, h=26 */
export function CoachProfileChip({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[4px] border border-[#CCDDF0] bg-[#E5EDF7] px-2 py-1 text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#0054B4]",
        className
      )}
    >
      {label}
    </span>
  );
}
