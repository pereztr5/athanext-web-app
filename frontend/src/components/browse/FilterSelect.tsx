import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Filter chip select (Working Copy `.input.sel-chip`): 34px, sunk background, sized to its text. */
export const FilterSelect = <T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}) => (
  <span className={cn("relative inline-flex min-w-0", className)}>
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className="h-[34px] w-full min-w-0 cursor-pointer appearance-none rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] pl-3 pr-8 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
  </span>
);
