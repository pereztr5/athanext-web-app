import { z } from "zod";
import {
  FILE_UPLOAD_CONFIG,
  INPUT_LIMITS,
  isValidAge,
} from "@/config/security";
import { isValidE164 } from "@/utils/phone";
import { ValidationResult } from "@/types/common";
import { strings } from "@/config/strings";
import { PERSONA_TYPES } from "@/utils/db";

type PersonaType = typeof PERSONA_TYPES[number];

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
  phoneNumber: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .refine(isValidE164, "Enter a valid phone number for the selected country"),
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

/**
 * Schema for sign up form validation
 */
export const signupSchema = z.object({
  persona: z.enum(PERSONA_TYPES as [PersonaType, ...PersonaType[]], { message: "Please select who you are" }),
  name: z.string().min(1, "Name is required"),
  dateOfBirth: z.string()
    .regex(/^\d{2}\/\d{2}\/\d{4}$/, { message: "Date must be in DD/MM/YYYY format" })
    .refine((dateStr) => {
      const [day, month, year] = dateStr.split('/').map(Number);
      const date = new Date(year, month - 1, day);
      // Check if date is valid
      if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
        return false;
      }
      // Check if date is in the past
      return date < new Date();
    }, { message: "Please enter a valid date in the past" })
    .optional(),
  sport: z.string().min(1, "Sport is required"),
  position: z.string().min(1, "Position is required"),
  phone: z.string().min(1, "Phone number is required").refine((val) => {
    // International format: must start with + and contain 7-15 digits.
    const digitsCount = val.replace(/[^\d]/g, '').length;
    return /^\+[\d\s\-()]+$/.test(val) && digitsCount >= 7 && digitsCount <= 15;
  }, { message: "Phone number must start with + and contain 7 to 15 digits" }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address"),
  password: z.string().min(8, strings.form.validation.passwordTooShort),
});

/**
 * Schema for profile completion validation
 */
export const profileCompletionSchema = z.object({
  persona: signupSchema.shape.persona,
  name: signupSchema.shape.name,
  dateOfBirth: signupSchema.shape.dateOfBirth,
  sport: signupSchema.shape.sport,
  position: signupSchema.shape.position,
  phone: signupSchema.shape.phone,
  gender: z.string().min(1, "Gender is required"),
  zipCode: z
    .string()
    .max(20, "Zip code is too long")
    .refine((value) => value.trim() === "" || value.trim().length >= 3, {
      message: "Zip code must be at least 3 characters",
    }),
});

export type AuthSchemaType = z.infer<typeof authSchema>;
export type SignupSchemaType = z.infer<typeof signupSchema>;
export type ProfileCompletionSchemaType = z.infer<typeof profileCompletionSchema>;
