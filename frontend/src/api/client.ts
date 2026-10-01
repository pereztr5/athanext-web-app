import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

/**
 * API Error Response Type
 */
export interface ApiError {
  code: string;
  message: string;
  status: number;
  originalError?: unknown;
}

/**
 * API Response Wrapper
 */
export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
  isLoading?: boolean;
}

/**
 * Generic error object type
 */
interface SupabaseErrorResponse {
  data: unknown;
  error: {
    code: string;
    message: string;
    status?: number;
  } | null;
}

/**
 * API Client Configuration
 */
export interface ApiClientConfig {
  supabaseClient: SupabaseClient;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * API Client - Central point for all API calls
 * Provides consistent error handling, logging, and response formatting
 */
export class ApiClient {
  private supabase: SupabaseClient;
  private timeout: number;
  private retryAttempts: number;
  private retryDelay: number;

  constructor(config: ApiClientConfig) {
    this.supabase = config.supabaseClient;
    this.timeout = config.timeout || 30000;
    this.retryAttempts = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 1000;
  }

  /**
   * Format error response
   */
  private formatError(error: unknown, context: string): ApiError {
    const err = error as Record<string, unknown>;
    console.error(`[API Error - ${context}]`, error);
    
    return {
      code: (err?.code as string) || 'UNKNOWN_ERROR',
      message: (err?.message as string) || 'An unknown error occurred',
      status: (err?.status as number) || 500,
      originalError: error,
    };
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string,
    retries = this.retryAttempts
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (retries > 0 && this.isRetryableError(error)) {
        console.warn(`[API Retry - ${context}] Retrying... (${this.retryAttempts - retries + 1}/${this.retryAttempts})`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.executeWithRetry(operation, context, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    const err = error as Record<string, unknown>;
    const retryableCodes = ['NETWORK_ERROR', 'TIMEOUT', 'RATE_LIMIT'];
    return retryableCodes.includes(err?.code as string) || ((err?.status as number) >= 500 && (err?.status as number) < 600);
  }

  /**
   * Get Supabase client
   */
  getSupabaseClient(): SupabaseClient {
    return this.supabase;
  }

  /**
   * Generic query method
   */
  async query<T>(
    operation: (client: SupabaseClient) => Promise<SupabaseErrorResponse>,
    context: string
  ): Promise<ApiResponse<T>> {
    try {
      const result = await this.executeWithRetry(
        () => operation(this.supabase),
        context
      );

      if (result.error) {
        return {
          data: null,
          error: this.formatError(result.error, context),
        };
      }

      return {
        data: result.data as T,
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: this.formatError(error, context),
      };
    }
  }

  /**
   * Generic mutation method
   */
  async mutate<T>(
    operation: (client: SupabaseClient) => Promise<SupabaseErrorResponse>,
    context: string
  ): Promise<ApiResponse<T>> {
    try {
      const result = await this.executeWithRetry(
        () => operation(this.supabase),
        context
      );

      if (result.error) {
        return {
          data: null,
          error: this.formatError(result.error, context),
        };
      }

      return {
        data: result.data as T,
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: this.formatError(error, context),
      };
    }
  }

  /**
   * Generic RPC call method
   */
  async rpc<T>(
    functionName: string,
    params?: Record<string, unknown>,
    context?: string
  ): Promise<ApiResponse<T>> {
    const contextLabel = context || `RPC: ${functionName}`;
    
    try {
      const result = await this.supabase.rpc(functionName, params) as SupabaseErrorResponse;

      if (result.error) {
        return {
          data: null,
          error: this.formatError(result.error, contextLabel),
        };
      }

      return {
        data: result.data as T,
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: this.formatError(error, contextLabel),
      };
    }
  }

  /**
   * Generic function invoke method (for Supabase Edge Functions)
   */
  async invoke<T>(
    functionName: string,
    body?: Record<string, unknown>,
    context?: string
  ): Promise<ApiResponse<T>> {
    const contextLabel = context || `Function: ${functionName}`;
    
    try {
      const result = await this.supabase.functions.invoke(functionName, { body }) as SupabaseErrorResponse;

      if (result.error) {
        return {
          data: null,
          error: this.formatError(result.error, contextLabel),
        };
      }

      return {
        data: result.data as T,
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: this.formatError(error, contextLabel),
      };
    }
  }
}

// Export singleton instance with reduced retries
export const apiClient = new ApiClient({
  supabaseClient: supabase,
  timeout: 30000,
  retryAttempts: 0, // Disable retries to prevent duplicate calls
  retryDelay: 1000,
});
