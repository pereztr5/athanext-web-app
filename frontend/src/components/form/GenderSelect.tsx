import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type GenderValue = 'male' | 'female' | 'other' | 'prefer-not-to-say';

export interface GenderSelectProps {
  value: string;
  onChange: (value: GenderValue) => void;
  disabled?: boolean;
  error?: string;
  label?: string;
  id?: string;
  placeholder?: string;
  showLabel?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
  required?: boolean;
}

const GENDER_OPTIONS: { value: GenderValue; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const SIZE_CLASSES: Record<"sm" | "md" | "lg", string> = {
  sm: "h-[34px] text-[14px]",
  md: "h-[38px] text-[14px]",
  lg: "h-10 text-[16px]",
};

/**
 * Reusable Gender Select Component
 * Can be used in forms, profile pages, and other sections where gender selection is needed
 */
export const GenderSelect = ({
  value,
  onChange,
  disabled = false,
  error,
  label = 'Gender',
  id = 'gender-select',
  placeholder = 'Select your gender',
  className = "",
  showLabel = true,
  size = "md",
  required = false,
}: GenderSelectProps) => {
  const sizeClass = SIZE_CLASSES[size];

  return (
    <div>
      {showLabel && (
        <Label
          className="mb-1.5 block text-[12px] font-medium leading-[14px] tracking-[-0.03em] text-[#767980]"
          htmlFor={id}
        >
          {label}
          {required && <span className="ml-1 text-destructive">*</span>}
        </Label>
      )}
      <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          id={id}
          className={cn("tracking-[-0.03em]", sizeClass, className)}
          aria-invalid={Boolean(error)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {GENDER_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p className="mt-1.5 text-[12px] leading-[14px] tracking-[-0.03em] text-destructive">{error}</p>
      )}
    </div>
  );
};

export default GenderSelect;
