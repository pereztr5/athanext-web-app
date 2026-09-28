import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Teach tailwind-merge the custom font sizes from tailwind.config.ts. Without
// this it reads `text-body-m` as a colour and drops it next to `text-[#1A202C]`.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["page-title", "highlight", "section", "card-title", "subtitle", "body-l", "body-m", "body-sm", "stat"] },
      ],
    },
  },
})

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
