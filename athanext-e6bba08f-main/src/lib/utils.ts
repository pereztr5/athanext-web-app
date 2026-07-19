import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInitials(name?: string | null, email?: string | null): string {
  const text = name || email || "";
  const segments = text.split(" ").filter(Boolean);
  
  if (segments.length >= 2) {
    return `${segments[0]?.[0] ?? ""}${segments[1]?.[0] ?? ""}`.toUpperCase();
  }
  
  return text.substring(0, 2).toUpperCase();
}

/**
 * Capitalize first letter and replace hyphens with spaces
 * @example capitalizeFirst('in-person') => 'In person'
 * @example capitalizeFirst('online') => 'Online'
 */
export function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).replace('-', ' ');
}
