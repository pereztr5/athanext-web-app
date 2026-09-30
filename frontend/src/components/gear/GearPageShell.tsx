import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
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
    <div className={inAppShell ? "overflow-x-hidden px-4 pb-16 md:px-10" : "min-h-screen bg-[#F1F1E6] px-4 pb-16 pt-[calc(3.8rem+40px)] font-sans"}>
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-[10px]">
            <h1 className="text-[32px] font-bold leading-[28px] tracking-[-1.6px] text-[#1A202C]">{title}</h1>
            {subtitle ? (
              <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#767980]">{subtitle}</p>
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
  <div className="flex flex-col items-center gap-[15px] rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] pb-[25px] pt-[30px] text-center">
    <span className="inline-flex size-10 items-center justify-center rounded-[8px] bg-[#F4F4EB] text-[#767980]" aria-hidden="true">
      <Icon className="size-5" strokeWidth={1.5} />
    </span>
    <div className="flex flex-col gap-[6px]">
      <p className="text-[20px] font-medium leading-[24px] tracking-[-0.05em] text-[#1A202C]">{title}</p>
      <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">{description}</p>
    </div>
    {action}
  </div>
);

export const GearLoading = ({ label }: { label: string }) => (
  <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
    <div className="size-10 animate-spin rounded-full border-2 border-[#EAEADF] border-t-[#0054B4]" />
    <p className="text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]">{label}</p>
  </div>
);
