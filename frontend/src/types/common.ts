/**
 * Shared type definitions used across multiple components
 * Centralizes common types to avoid duplication and improve type safety
 */

/**
 * Validation result type for file and input validation
 * Discriminated union ensures type-safe error handling
 */
export type ValidationResult = 
  | { valid: true }
  | { valid: false; error: string };

/**
 * Booking type enum for coach scheduling
 * Centralizes booking options to avoid string literal duplication
 */
export enum BookingType {
  FreeConsultation = "Free Consultation",
  SingleSession = "Single Session",
}

/**
 * Sport types supported by the platform
 * Provides type-safe sport selection and comparison
 */
export enum Sport {
  Soccer = "soccer",
  Rowing = "rowing",
}

/**
 * Type alias for components that need string-based sport values
 * Provides backwards compatibility while maintaining type safety
 */
export type SportValue = `${Sport}`;
