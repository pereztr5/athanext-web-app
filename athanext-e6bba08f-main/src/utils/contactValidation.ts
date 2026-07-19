import { z } from "zod";

/**
 * Contact form validation schema with security measures
 * Prevents XSS, injection attacks, and data integrity issues
 */
export const contactFormSchema = z.object({
  fullName: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .trim()
    .regex(
      /^[a-zA-Z\s\-'.]+$/,
      "Name can only contain letters, spaces, hyphens, apostrophes, and periods"
    ),
  email: z.string()
    .email("Please enter a valid email address")
    .max(255, "Email must be less than 255 characters")
    .trim()
    .toLowerCase()
    .regex(
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      "Please enter a valid email format"
    ),
  subject: z.string()
    .min(3, "Subject must be at least 3 characters")
    .max(200, "Subject must be less than 200 characters")
    .trim()
    .regex(
      /^[a-zA-Z0-9\s\-_,.!?()]+$/,
      "Subject contains invalid characters"
    ),
  message: z.string()
    .min(10, "Message must be at least 10 characters")
    .max(2000, "Message must be less than 2000 characters")
    .trim()
    .refine(
      (val) => {
        // Check for suspicious patterns (basic spam/injection detection)
        const suspiciousPatterns = [
          /<script/i,
          /javascript:/i,
          /on\w+\s*=/i,
          /<iframe/i,
          /eval\(/i,
          /exec\(/i,
        ];
        return !suspiciousPatterns.some(pattern => pattern.test(val));
      },
      "Message contains prohibited content"
    ),
});

/**
 * Sanitizes user input to prevent XSS attacks
 * Removes potentially dangerous HTML/JS content
 */
export const sanitizeInput = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

/**
 * Rate limiting helper - tracks submission timestamps
 * Prevents spam and abuse
 */
export const checkRateLimit = (storageKey: string, limitMinutes: number = 5): boolean => {
  try {
    const lastSubmission = localStorage.getItem(storageKey);
    if (!lastSubmission) return true;

    const lastTime = new Date(lastSubmission).getTime();
    const now = new Date().getTime();
    const diffMinutes = (now - lastTime) / (1000 * 60);

    return diffMinutes >= limitMinutes;
  } catch (error) {
    console.error('Rate limit check error:', error);
    return true; // Allow on error
  }
};

/**
 * Sets rate limit timestamp
 */
export const setRateLimit = (storageKey: string): void => {
  try {
    localStorage.setItem(storageKey, new Date().toISOString());
  } catch (error) {
    console.error('Error setting rate limit:', error);
  }
};

/**
 * Validates email format with comprehensive checks
 */
export const isValidEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') return false;
  
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const hasValidLength = email.length >= 5 && email.length <= 255;
  const hasValidFormat = emailRegex.test(email);
  const hasSingleAt = (email.match(/@/g) || []).length === 1;
  
  return hasValidLength && hasValidFormat && hasSingleAt;
};
