import { useMemo } from "react";

export const PASSWORD_RULE_MESSAGE =
  "New password must be at least 8 characters and include an uppercase letter, lowercase letter, number, and special character.";

const PASSWORD_REQUIREMENTS = [
  {
    key: "length",
    label: "At least 8 characters",
    test: (value: string) => value.length >= 8,
  },
  {
    key: "uppercase",
    label: "At least one uppercase letter (A-Z)",
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    key: "lowercase",
    label: "At least one lowercase letter (a-z)",
    test: (value: string) => /[a-z]/.test(value),
  },
  {
    key: "number",
    label: "At least one number (0-9)",
    test: (value: string) => /\d/.test(value),
  },
  {
    key: "special",
    label: "At least one symbol (such as @, # or $)",
    test: (value: string) => /[^A-Za-z0-9]/.test(value),
  },
] as const;

export type PasswordRequirementKey = (typeof PASSWORD_REQUIREMENTS)[number]["key"];

export interface PasswordValidationItem {
  key: PasswordRequirementKey;
  label: string;
  isValid: boolean;
}

interface UsePasswordValidationReturn {
  items: PasswordValidationItem[];
  allValid: boolean;
}

export const usePasswordValidation = (password: string): UsePasswordValidationReturn => {
  return useMemo(() => {
    const items = PASSWORD_REQUIREMENTS.map((requirement) => ({
      key: requirement.key,
      label: requirement.label,
      isValid: requirement.test(password),
    }));

    return {
      items,
      allValid: items.every((item) => item.isValid),
    };
  }, [password]);
};
