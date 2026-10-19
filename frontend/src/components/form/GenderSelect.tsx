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
  sm: "h-control text-body-m",
  md: "h-input text-body-m",
  lg: "h-10 text-body-l",
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
          className="mb-1.5 block text-label-xsm text-dark-300"
          htmlFor={id}
        >
          {label}
          {required && <span className="ml-1 text-error-700">*</span>}
        </Label>
      )}
      <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          id={id}
          className={cn(sizeClass, className)}
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
        <p className="mt-1.5 text-caption text-error-700">{error}</p>
      )}
    </div>
  );
};

export default GenderSelect;
