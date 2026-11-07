import { z } from "zod";
import {
  FILE_UPLOAD_CONFIG,
  INPUT_LIMITS,
  isValidAge,
} from "@/config/security";
import { isValidE164 } from "@/utils/phone";
import { ValidationResult } from "@/types/common";
// Constants with safety checks and fallback values
export const MAX_FILE_SIZE = FILE_UPLOAD_CONFIG?.MAX_FILE_SIZE ?? 8388608; // 8MB default
export const MAX_COVER_IMAGES = FILE_UPLOAD_CONFIG?.MAX_COVER_IMAGES ?? 3;
export const MAX_TAGS = INPUT_LIMITS?.MAX_TAGS_COUNT ?? 10;

/**
 * Validates an image file based on allowed types
 * @param file - The file to validate
 * @returns ValidationResult with valid status and optional error message
 */
export const validateImageFile = (file: File): ValidationResult => {
  // Safety checks: ensure file exists and has required properties
  if (!file || typeof file !== 'object') {
    return { valid: false, error: 'Invalid file object' };
  }
  
  if (!file.type || typeof file.type !== 'string') {
    return { valid: false, error: 'File type is missing or invalid' };
  }
  
  // Safety check: ensure allowedTypes is a valid array
  const allowedTypes = FILE_UPLOAD_CONFIG?.ALLOWED_IMAGE_TYPES as readonly string[];
  if (!Array.isArray(allowedTypes) || allowedTypes.length === 0) {
    return { valid: false, error: 'Configuration error: allowed types not defined' };
  }
  
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Only JPG, PNG, and WebP images are allowed.' };
  }
  
  return { valid: true };
};

/**
 * Zod schema for athlete profile form validation
 */
export const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Full name is required")
    .max(INPUT_LIMITS?.MAX_NAME_LENGTH ?? 100, `Name too long (max ${INPUT_LIMITS?.MAX_NAME_LENGTH ?? 100} characters)`),
  initials: z
    .string()
    .trim()
    .min(1, "Initials are required")
    .max(4, "Initials must be up to 4 characters"),
  sport: z
    .string()
    .trim()
    .min(1, "Sport is required")
    .max(INPUT_LIMITS?.MAX_SPORT_LENGTH ?? 50, `Sport name too long (max ${INPUT_LIMITS?.MAX_SPORT_LENGTH ?? 50} characters)`),
  position: z
    .string()
    .trim()
    .min(1, "Position is required")
    .max(INPUT_LIMITS?.MAX_POSITION_LENGTH ?? 50, `Position too long (max ${INPUT_LIMITS?.MAX_POSITION_LENGTH ?? 50} characters)`),
  dateOfBirth: z
    .string()
    .trim()
    .min(1, "Date of birth is required")
    .refine(isValidAge, "Please enter a valid date of birth (age must be between 5-120 years)"),
  // Optional, as on Create your profile; checked only when given.
  phoneNumber: z
    .string()
    .trim()
    .refine((value) => value === "" || isValidE164(value), "Enter a valid phone number for the selected country"),
  tags: z
    .array(z.string().trim().min(1, "Tag cannot be empty").max(INPUT_LIMITS?.MAX_TAG_LENGTH ?? 50, "Tag too long"))
    .max(MAX_TAGS, `You can only add up to ${MAX_TAGS} tags`)
    .default([]),
  pathwayTags: z.array(z.string()).max(5).optional().default([]),
  profileImageUrl: z.string().nullable(),
  coverImageUrls: z
    .array(z.string().trim().min(1, "Cover image data cannot be empty"))
    .max(MAX_COVER_IMAGES, `Only ${MAX_COVER_IMAGES} cover images are supported`),
  gender: z.string().nullable(),
  zipCode: z.string().nullable(),
});

export type ProfileSchemaType = z.infer<typeof profileSchema>;

// ============================================================================
// AUTH VALIDATION SCHEMAS
// ============================================================================

/**
 * Schema for basic authentication (sign in)
 */
export const authSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required").optional(),
});

export type AuthSchemaType = z.infer<typeof authSchema>;
