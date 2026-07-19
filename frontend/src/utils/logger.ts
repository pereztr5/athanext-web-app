/**
 * Logger utility that respects environment modes
 * Logs are disabled in production builds
 */

const isDevelopment = import.meta.env.MODE === 'development';
const isQA = import.meta.env.MODE === 'qa';
const isProduction = import.meta.env.MODE === 'production';

// Disable logging in ALL environments
const LOGGING_ENABLED = false;

export const logger = {
  log: (...args: any[]) => {
    if (LOGGING_ENABLED) {
      console.log(...args);
    }
  },
  
  error: (...args: any[]) => {
    if (LOGGING_ENABLED) {
      console.error(...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (LOGGING_ENABLED) {
      console.warn(...args);
    }
  },
  
  info: (...args: any[]) => {
    if (LOGGING_ENABLED) {
      console.info(...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (LOGGING_ENABLED) {
      console.debug(...args);
    }
  },
};

// Export environment flags for conditional logic
export const ENV = {
  isDevelopment,
  isQA,
  isProduction,
  isLoggingEnabled: LOGGING_ENABLED,
} as const;
