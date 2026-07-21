/**
 * Input validation and sanitization utilities
 * (validators, HTML escaping, upload limits)
 */

// File upload restrictions
export const FILE_UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 8 * 1024 * 1024, // 8MB
  MAX_COVER_IMAGES: 3,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
} as const;

// Input validation limits
export const INPUT_LIMITS = {
  MAX_NAME_LENGTH: 100,
  MAX_TAG_LENGTH: 50,
  MAX_TAGS_COUNT: 10,
  MAX_SPORT_LENGTH: 50,
  MAX_POSITION_LENGTH: 50,
  MAX_LOCATION_LENGTH: 100,
  MAX_BIO_LENGTH: 500,
  MIN_AGE: 5,
  MAX_AGE: 120,
} as const;

/**
 * Sanitize HTML input to prevent XSS attacks
 */
/**
 * Sanitizes HTML input by converting special characters to HTML entities
 * This prevents XSS (Cross-Site Scripting) attacks by escaping potentially dangerous characters
 * 
 * @param input - The string to sanitize
 * @returns Sanitized string with HTML entities replacing special characters
 * @example
 * sanitizeHtml('<script>alert("xss")</script>') 
 * // Returns: '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
 */
export const sanitizeHtml = (input: string): string => {
  const entityMap: Record<string, string> = {
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '&': '&amp;',
    '/': '&#x2F;',
  };
  
  return input.replace(/[<>"'&/]/g, (char) => entityMap[char] || char);
};

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  return emailRegex.test(normalizedEmail) && normalizedEmail.length <= 254;
};

export const AUTHENTIC_EMAIL_MESSAGE =
  'Please use a real, non-temporary email address.';

/**
 * Validate phone number format (international format)
 */
export const isValidPhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
  return phoneRegex.test(phone);
};

/**
 * Calculate age from date of birth
 */
export const calculateAge = (dateOfBirth: string): number | null => {
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;
  
  const age = Math.floor((Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  return age;
};

/**
 * Validate age is within acceptable range
 */
export const isValidAge = (dateOfBirth: string): boolean => {
  const age = calculateAge(dateOfBirth);
  if (age === null) return false;
  return age >= INPUT_LIMITS.MIN_AGE && age <= INPUT_LIMITS.MAX_AGE;
};

/**
 * Validates image file authenticity by checking magic bytes (file signature)
 * This prevents file type bypass attacks by verifying actual file content
 * rather than relying solely on MIME type or file extension
 * 
 * @param file - The file to validate
 * @returns Promise<boolean> - True if file signature matches allowed image types
 * @example
 * const isValid = await validateImageMagicBytes(fileInput.files[0]);
 * if (!isValid) {
 *   console.error('Invalid image file');
 * }
 * 
 * Supported formats:
 * - JPEG: Checks for FFD8FF signature
 * - PNG: Checks for 89504E47 signature
 * - WebP: Checks for 52494646 (RIFF) signature
 */
export const validateImageMagicBytes = (file: File): Promise<boolean> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const arr = new Uint8Array(e.target?.result as ArrayBuffer).subarray(0, 4);
      let header = '';
      for (let i = 0; i < arr.length; i++) {
        header += arr[i].toString(16);
      }
      
      // Check magic bytes for common image formats
      const magicBytes = {
        jpeg: 'ffd8ff',
        png: '89504e47',
        webp: '52494646',
      };
      
      const isValid = Object.values(magicBytes).some(magic => header.startsWith(magic));
      resolve(isValid);
    };
    
    reader.onerror = () => resolve(false);
    reader.readAsArrayBuffer(file.slice(0, 4));
  });
};

/**
 * Truncate string to maximum length
 */
export const truncateString = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength);
};
