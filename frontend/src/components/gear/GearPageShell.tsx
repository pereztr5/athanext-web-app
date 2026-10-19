import type { ReactNode } from "react";
import type { LucideIcon } from "@/components/icons";
import { useRole } from "@/hooks/useRole";
import { GearCartButton } from "./GearCart";

/**
 * Gear pages are dual-chrome: app shell for signed-in users, marketing
 * header for visitors (which is fixed, so the content is pushed below it).
 */
export const GearPageShell = ({
  title,
  subtitle,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
}) => {
  const { isAuthenticated, ready } = useRole();
  const inAppShell = ready && isAuthenticated;

  return (
    <div className={inAppShell ? "overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12" : "min-h-screen bg-light px-4 pb-16 pt-[calc(3.8rem+40px)] font-sans"}>
      <div className="mx-auto flex w-full max-w-wrapper flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-[10px]">
            <h1 className="text-page-title-phone text-dark md:text-page-title">{title}</h1>
            {subtitle ? (
              <p className="text-body-m text-dark-300">{subtitle}</p>
            ) : null}
          </div>
          <GearCartButton />
        </div>
        {children}
      </div>
    </div>
  );
};

/** Centered notice card for loading-failed, not-configured and empty states. */
export const GearNotice = ({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) => (
  <div className="flex flex-col items-center gap-[15px] rounded-card border border-light-525 bg-light-300 px-[25px] pb-[25px] pt-[30px] text-center">
    <span className="inline-flex size-10 items-center justify-center rounded-control bg-light-400 text-dark-300" aria-hidden="true">
      <Icon className="size-5" strokeWidth={1.5} />
    </span>
    <div className="flex flex-col gap-[6px]">
      <p className="text-card-title text-dark">{title}</p>
      <p className="text-body-m text-dark-300">{description}</p>
    </div>
    {action}
  </div>
);

export const GearLoading = ({ label }: { label: string }) => (
  <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
    <div className="size-10 animate-spin rounded-full border-2 border-light-525 border-t-primary" />
    <p className="text-label-sm text-dark">{label}</p>
  </div>
);
