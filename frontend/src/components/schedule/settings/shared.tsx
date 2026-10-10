import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Card heading (Working Copy `.ch`): 20px icon and 20px/500 title. */
export const CardHeading = ({ icon: Icon, title }: { icon: LucideIcon; title: string }) => (
  <div className="flex items-center gap-2">
    <Icon className="size-5 flex-none" strokeWidth={1.5} aria-hidden="true" />
    <h2 className="text-[20px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]">{title}</h2>
  </div>
);

/** Working Copy `.cap`. */
export const caption = "text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]";

/** Working Copy `.sw`: 36x20 track, 16px knob. */
export const Switch = ({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  label: string;
  disabled?: boolean;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!on)}
    className={cn(
      "flex h-5 w-9 flex-none items-center rounded-[10px] p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2] disabled:opacity-50",
      on ? "justify-end bg-[#0054B4]" : "justify-start bg-[#D9D9CF]"
    )}
  >
    <span className="size-4 rounded-full bg-[#FDFDFC]" />
  </button>
);
