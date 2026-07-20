// Security monitoring utilities
export const SecurityAudit = {
  // Log security events (in production, this would go to a monitoring service)
  logSecurityEvent: (event: string, details?: Record<string, unknown>) => {
    if (import.meta.env.DEV) {
      console.warn(`[SECURITY] ${event}`, details);
    }
    // In production, send to monitoring service
  },

  // Validate input patterns for common attacks
  validateInput: (input: string, type: 'text' | 'email' | 'phone' = 'text'): boolean => {
    // Check for common XSS patterns
    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i
    ];

    if (xssPatterns.some(pattern => pattern.test(input))) {
      SecurityAudit.logSecurityEvent('XSS_ATTEMPT_DETECTED', { input: input.substring(0, 50) });
      return false;
    }

    // Check for SQL injection patterns
    const sqlPatterns = [
      /union\s+select/i,
      /drop\s+table/i,
      /insert\s+into/i,
      /delete\s+from/i,
      /update\s+.*set/i
    ];

    if (sqlPatterns.some(pattern => pattern.test(input))) {
      SecurityAudit.logSecurityEvent('SQL_INJECTION_ATTEMPT', { input: input.substring(0, 50) });
      return false;
    }

    // Type-specific validation
    if (type === 'email' && !input.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return false;
    }

    if (type === 'phone' && !input.match(/^\+?[\d\s\-()]{10,20}$/)) {
      return false;
    }

    return true;
  },

  // Check for suspicious activity patterns
  checkRateLimit: (action: string, maxAttempts: number = 5, windowMs: number = 60000): boolean => {
    const key = `rate_limit_${action}`;
    const now = Date.now();
    
    const attempts = JSON.parse(localStorage.getItem(key) || '[]') as number[];
    const recentAttempts = attempts.filter(time => now - time < windowMs);
    
    if (recentAttempts.length >= maxAttempts) {
      SecurityAudit.logSecurityEvent('RATE_LIMIT_EXCEEDED', { action, attempts: recentAttempts.length });
      return false;
    }
    
    recentAttempts.push(now);
    localStorage.setItem(key, JSON.stringify(recentAttempts));
    return true;
  },

  // Clear rate limit data (call on successful login/logout)
  clearRateLimit: (action: string) => {
    localStorage.removeItem(`rate_limit_${action}`);
  }
};