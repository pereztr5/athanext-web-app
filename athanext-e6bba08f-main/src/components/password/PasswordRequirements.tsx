import { Label } from "@/components/ui/label";
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
  label = "Password must include:",
}: PasswordRequirementsProps) => {
  return (
    <div className={cn("text-xs text-muted-foreground", className)}>
      <Label className="text-xs font-medium text-foreground">{label}</Label>
      <ul className="mt-1 space-y-1">
        {items.map((item) => (
          <li
            key={item.key}
            className={cn(
              "flex items-center gap-2",
              item.isValid ? "text-emerald-600" : "text-destructive"
            )}
          >
            <span
              className={cn(
                "inline-flex h-2.5 w-2.5 rounded-full",
                item.isValid ? "bg-emerald-500" : "bg-destructive"
              )}
            />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
};
