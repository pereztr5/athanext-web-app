/**
 * Shared pieces for the booking and package checkouts (Working Copy `.modal.sheet`, `.apple`,
 * `.paym`, `.info`). Payment always happens on Stripe's page; nothing is saved to the account.
 */
import type { ButtonHTMLAttributes, ComponentType, ReactNode } from "react";
import { CreditCard } from "lucide-react";
import { dialogContent } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";

export type PayMethod = "apple" | "card";

/** 480px sheet on desktop, bottom sheet (22px top radius, 88% tall) on phone. */
export const sheetContent = cn(
  dialogContent,
  "flex max-w-[480px] flex-col overflow-hidden max-[430px]:overflow-hidden",
  "max-sm:bottom-0 max-sm:left-0 max-sm:top-auto max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-h-[88svh] max-sm:rounded-b-none max-sm:rounded-t-[22px] max-sm:border-b-0",
  "max-[430px]:top-auto max-[430px]:max-h-[88svh]",
  "max-sm:data-[state=open]:slide-in-from-left-0 max-sm:data-[state=closed]:slide-out-to-left-0 max-sm:data-[state=open]:slide-in-from-bottom-full max-sm:data-[state=closed]:slide-out-to-bottom-full max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=closed]:zoom-out-100"
);
export const wideContent = cn(dialogContent, "flex max-w-[940px] flex-col overflow-hidden max-[430px]:overflow-hidden");
export const sheetHeader = "flex-none space-y-1 border-b border-[#EAEADF] px-4 py-5 pr-14 text-left sm:px-[25px]";
export const sheetTitle = "text-[24px] font-semibold leading-[30px] tracking-[-0.05em] text-[#1A202C]";
export const sheetBody = "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-5 sm:px-[25px]";
export const sheetFooter = "flex flex-none flex-wrap gap-2.5 border-t border-[#EAEADF] px-4 py-4 sm:px-[25px]";
/** Working Copy `.stat-28`. */
export const stat28 = "text-[28px] font-bold leading-[30px] tracking-[-0.05em] tabular-nums text-[#1A202C]";

const AppleLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 384 512" aria-hidden="true" className={className}>
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
  </svg>
);

/** Black Apple Pay button: "{label}  Pay". */
export const ApplePayButton = ({ label, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) => (
  <button
    type="button"
    aria-label={`${label} Apple Pay`}
    className={cn(
      "inline-flex h-[44px] items-center justify-center gap-1 rounded-[8px] bg-black px-5 text-[16px] font-semibold tracking-[-0.01em] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35",
      className
    )}
    {...props}
  >
    {label} <AppleLogo className="-mt-[3px] size-4 fill-white" />
    Pay
  </button>
);

const AppleBadge = () => (
  <span className="inline-flex flex-none items-center gap-0.5 rounded-[4px] bg-black px-1.5 py-[3px] text-[12px] font-semibold text-white">
    <AppleLogo className="size-[11px] fill-white" />
    Pay
  </span>
);

const PayRow = ({ name, checked, onSelect, children }: { name: string; checked: boolean; onSelect: () => void; children: ReactNode }) => (
  <label
    className={cn(
      "flex cursor-pointer items-center gap-2.5 rounded-[8px] border px-3 py-2.5 text-[14px] leading-[18px] text-[#1A202C]",
      checked ? "border-[#0054B4] bg-[#F7F7F0] shadow-[0_0_0_1px_#0054B4]" : "border-[#EAEADF] bg-[#F4F4EB]"
    )}
  >
    <input type="radio" name={name} checked={checked} onChange={onSelect} className="accent-[#0054B4]" />
    {children}
  </label>
);

/** Pay with: Apple Pay (only where supported) or a card on Stripe's secure page. */
export const PayMethodList = ({
  name,
  value,
  onChange,
  applePay,
}: {
  name: string;
  value: PayMethod;
  onChange: (method: PayMethod) => void;
  applePay: boolean;
}) => (
  <div className="flex flex-col gap-2" role="radiogroup" aria-label="Pay with">
    {applePay ? (
      <PayRow name={name} checked={value === "apple"} onSelect={() => onChange("apple")}>
        <AppleBadge />
        <span className="flex-1">Apple Pay</span>
      </PayRow>
    ) : null}
    <PayRow name={name} checked={value === "card"} onSelect={() => onChange("card")}>
      <CreditCard className="size-4 flex-none text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
      <span className="flex-1">Card, Apple Pay or Google Pay on Stripe's secure page</span>
    </PayRow>
  </div>
);

/** Working Copy `.info`: sunk box with an icon and muted 12px text. */
export const InfoBox = ({ icon: Icon, children, className }: { icon: ComponentType<{ className?: string; strokeWidth?: string | number }>; children: ReactNode; className?: string }) => (
  <div className={cn("flex items-start gap-2.5 rounded-[8px] bg-[#F4F4EB] px-3.5 py-3 text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]", className)}>
    <Icon className="-mt-px size-4 flex-none" strokeWidth={1.5} />
    <span>{children}</span>
  </div>
);
