import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  sm: "h-8 text-xs",
  md: "h-9 text-sm",
  lg: "h-10 text-base",
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
        <Label className="mb-2" htmlFor={id}>
          {label}
          {required && <span className="ml-1 text-destructive">*</span>}
        </Label>
      )}
      <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className={`${sizeClass} ${className}`}>
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
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
};

export default GenderSelect;
