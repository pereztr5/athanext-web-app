// Common database / API error codes used across the app
export const ERROR_CODES = {
  RLS_PERMISSION_DENIED: 42501,
} as const;

export type ErrorCodeKey = keyof typeof ERROR_CODES;
