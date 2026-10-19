import { ChevronDown } from "@/components/icons";
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
      className="h-[34px] w-full min-w-0 cursor-pointer appearance-none rounded-control border border-dark-250 bg-light pl-3 pr-8 text-label-sm text-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
  </span>
);
