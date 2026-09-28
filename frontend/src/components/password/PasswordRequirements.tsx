import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PasswordValidationItem } from "@/hooks/usePasswordValidation";

interface PasswordRequirementsProps {
  items: PasswordValidationItem[];
  className?: string;
  label?: string;
}

export const PasswordRequirements = ({
  items,
  className,
  label = "Password must include",
}: PasswordRequirementsProps) => {
  return (
    <div className={cn("text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]", className)}>
      <p className="font-medium text-[#484D56]">{label}</p>
      <ul className="mt-1.5 space-y-1.5">
        {items.map((item) => (
          <li
            key={item.key}
            className={cn("flex items-center gap-2", item.isValid ? "text-[#1A202C]" : "text-[#767980]")}
          >
            <span
              aria-hidden="true"
              className={cn(
                "inline-flex h-3.5 w-3.5 flex-none items-center justify-center rounded-full",
                item.isValid ? "bg-[#CBE7D1] text-[#1E7431]" : "border border-[#C1C1B8]"
              )}
            >
              {item.isValid && <Check strokeWidth={2.5} className="h-2.5 w-2.5" />}
            </span>
            <span>{item.label}</span>
            <span className="sr-only">{item.isValid ? "(met)" : "(not met)"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
