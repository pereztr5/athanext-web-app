import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { ReactNode } from "react";

interface CoachProfileCardProps {
  children: ReactNode;
  className?: string;
  id?: string;
  "aria-label"?: string;
}

/** Working Copy `.card`: light-300 on the light page, 10px radius, 30/25/25 padding, 22/18/20 on phone */
export function CoachProfileCard({ children, className, id, "aria-label": ariaLabel }: CoachProfileCardProps) {
  return (
    <section
      id={id}
      aria-label={ariaLabel}
      className={cn(
        "flex w-full min-w-0 flex-col gap-5 rounded-card border border-light-525 bg-light-300 px-[18px] pb-5 pt-[22px] md:px-[25px] md:pb-[25px] md:pt-[30px]",
        className
      )}
    >
      {children}
    </section>
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
      <h2 className="text-card-title text-dark">{title}</h2>
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

/** Small button: primary or secondary, 30px tall (btn-sm). */
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
        buttonVariants({ variant: variant === "primary" ? "default" : "secondary", size: "sm" }),
        "gap-[3px]",
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

/** Pillar/label chip: blue pill (primary-100 fill, primary-300 border). */
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
        "inline-flex items-center rounded-pill border border-primary-300 bg-primary-100 px-2 py-1 text-label-sm text-primary",
        className
      )}
    >
      {label}
    </span>
  );
}
