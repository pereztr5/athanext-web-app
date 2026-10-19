import { Check } from "@/components/icons";
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
    <div className={cn("text-caption text-dark-300", className)}>
      <p className="text-label-xsm text-dark-400">{label}</p>
      <ul className="mt-1.5 space-y-1.5">
        {items.map((item) => (
          <li
            key={item.key}
            className={cn("flex items-center gap-2", item.isValid ? "text-dark" : "text-dark-300")}
          >
            <span
              aria-hidden="true"
              className={cn(
                "inline-flex h-3.5 w-3.5 flex-none items-center justify-center rounded-full",
                item.isValid ? "border border-success-300 bg-success-100 text-success-700" : "border border-light-600"
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
