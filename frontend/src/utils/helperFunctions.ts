import { INPUT_LIMITS, sanitizeHtml, truncateString } from "@/config/security";
import { MAX_COVER_IMAGES, MAX_TAGS } from "@/utils/validations";

/**
 * Normalizes a phone number to ensure it always starts with a '+' prefix.
 * Limits the total length to 16 characters (+ followed by 15 digits max).
 * @param value - The phone number string to normalize
 * @returns The normalized phone number with '+' prefix
 */
export const normalizePhone = (value: string): string => {
  const safeValue = typeof value === "string" ? value : "";
  const digitsOnly = safeValue.replace(/\D/g, "").slice(0, 15);
  return digitsOnly.length > 0 ? `+${digitsOnly}` : "+";
};

/**
 * Capitalizes the first letter of a string.
 * @param str - The string to capitalize
 * @returns The string with the first letter capitalized
 */
export const capitalize = (str: string | null | undefined): string => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Formats an ISO date string to USA format (e.g., "December 18, 2025")
 * @param dateString - The ISO format date string (e.g., "2025-12-18T12:42:44.900Z")
 * @returns The formatted date string in USA format, or empty string if invalid
 */
export const formatDateToUSA = (dateString: string): string => {
  // Check for empty or invalid string
  if (!dateString || typeof dateString !== 'string' || dateString.trim() === '') {
    return '';
  }

  const date = new Date(dateString);

  // Check if the date is valid
  if (isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Capitalize first letter and replace hyphens with spaces
 * @param str - The string to capitalize
 * @returns The string with first letter capitalized and hyphens replaced with spaces
 * @example capitalizeFirst('in-person') => 'In person'
 * @example capitalizeFirst('online') => 'Online'
 */
export const capitalizeFirst = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).replace('-', ' ');
};

/**
 * Formats a Date object to YYYY-MM-DD format for HTML input elements
 * @param date - The Date object to format
 * @returns The formatted date string in YYYY-MM-DD format
 * @example formatDateForInput(new Date('2025-12-18')) => '2025-12-18'
 */
export const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Sanitizes a multi-line string into a tags array.
 * Trims, strips unsafe HTML, enforces length, and caps total tags.
 */
export const sanitizeTagsFromString = (value: string): string[] => {
  if (typeof value !== "string") return [];
  const maxTagLength = INPUT_LIMITS?.MAX_TAG_LENGTH ?? 50;
  return value
    .split(/\r?\n/)
    .map((tag) => truncateString(sanitizeHtml(tag), maxTagLength))
    .filter((tag) => typeof tag === "string" && tag.trim() !== "")
    .slice(0, MAX_TAGS);
};

/**
 * Sanitizes a set of image URLs by trimming and limiting the count.
 */
export const sanitizeImages = (images: string[]): string[] => {
  if (!Array.isArray(images)) return [];
  return images
    .map((img) => (typeof img === "string" ? img.trim() : ""))
    .filter(Boolean)
    .slice(0, MAX_COVER_IMAGES);
};

/**
 * Generates initials from a full name string.
 */
export const deriveInitials = (value?: string | null): string => {
  if (!value || typeof value !== "string") return "";
  const parts = value
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};
