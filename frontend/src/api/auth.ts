/**
 * Auth API Endpoints
 * Centralized API calls for all authentication operations
 */

import { apiClient, type ApiResponse } from "@/api/client";
import type { User, Session } from "@supabase/supabase-js";
import { AUTHENTIC_EMAIL_MESSAGE } from "@/config/security";

export interface SignUpData {
  email: string;
  password: string;
  name?: string;
  metadata?: Record<string, unknown>;
  emailRedirectTo?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User | null;
  session: Session | null;
}

/**
 * Auth API endpoints
 */
export const authAPI = {
  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<ApiResponse<User | null>> {
    try {
      const {
        data: { user },
        error,
      } = await apiClient.getSupabaseClient().auth.getUser();

      if (error) {
        return {
          data: null,
          error: {
            code: error.code || "AUTH_ERROR",
            message: error.message,
            status: 401,
            originalError: error,
          },
        };
      }

      return {
        data: user,
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: {
          code: "UNKNOWN_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to get current user",
          status: 500,
          originalError: error,
        },
      };
    }
  },

  /**
   * Get current session
   */
  async getSession(): Promise<ApiResponse<Session | null>> {
    try {
      const {
        data: { session },
        error,
      } = await apiClient.getSupabaseClient().auth.getSession();

      if (error) {
        return {
          data: null,
          error: {
            code: error.code || "AUTH_ERROR",
            message: error.message,
            status: 401,
            originalError: error,
          },
        };
      }

      return {
        data: session,
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: {
          code: "UNKNOWN_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to get session",
          status: 500,
          originalError: error,
        },
      };
    }
  },

  /**
   * Sign up with email and password
   */
  async signUp(data: SignUpData): Promise<ApiResponse<AuthResponse>> {
    try {
      const normalizedEmail = data.email?.trim().toLowerCase();
      if (!normalizedEmail) {
        return {
          data: null,
          error: {
            code: "INVALID_EMAIL",
            message: "Email is required",
            status: 400,
            originalError: null,
          },
        };
      }
      try {
        const { data: validationData, error: validationError } = await apiClient
          .getSupabaseClient()
          .functions.invoke("validate-email", { body: { email: normalizedEmail } });

        if (validationError || validationData?.valid === false) {
          const message = validationData?.message || AUTHENTIC_EMAIL_MESSAGE;
          return {
            data: null,
            error: {
              code: "INVALID_EMAIL",
              message,
              status: 400,
              originalError: validationError,
            },
          };
        }
      } catch (err) {
        return {
          data: null,
          error: {
            code: "INVALID_EMAIL",
            message: AUTHENTIC_EMAIL_MESSAGE,
            status: 400,
            originalError: err,
          },
        };
      }

      const redirectTo = data.emailRedirectTo || `${window.location.origin}/`;
      const metadata = {
        name: data.name || normalizedEmail.split("@")[0],
        ...data.metadata,
      };

      const { data: response, error } = await apiClient
        .getSupabaseClient()
        .auth.signUp({
          email: normalizedEmail,
          password: data.password,
          options: {
            emailRedirectTo: redirectTo,
            data: metadata,
          },
        });

      if (response?.user?.identities?.length === 0) {
        return {
          data: null,
          error: {
            code: "EMAIL_EXISTS",
            message: "An account with this email already exists.",
            status: 409,
            originalError: null,
          },
        };
      }

      if (error) {
        return {
          data: null,
          error: {
            code: error.code || "AUTH_ERROR",
            message: error.message,
            status: 400,
            originalError: error,
          },
        };
      }

      return {
        data: {
          user: response.user,
          session: response.session,
        },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: {
          code: "UNKNOWN_ERROR",
          message: error instanceof Error ? error.message : "Sign up failed",
          status: 500,
          originalError: error,
        },
      };
   }
  },

  /**
   * Resend the signup confirmation email
   */
  async resendConfirmationEmail(
    email: string,
    emailRedirectTo?: string
  ): Promise<ApiResponse<null>> {
    try {
      const redirectTo = emailRedirectTo || `${window.location.origin}/`;

      const { error } = await apiClient.getSupabaseClient().auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) {
        return {
          data: null,
          error: {
            code: error.code || "AUTH_ERROR",
            message: error.message,
            status: 400,
            originalError: error,
          },
        };
      }

      return {
        data: null,
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: {
          code: "UNKNOWN_ERROR",
          message: error instanceof Error ? error.message : "Failed to resend confirmation email",
          status: 500,
          originalError: error,
        },
      };
    }
  },

  /**
   * Sign in with email and password
   */
  async signIn(data: SignInData): Promise<ApiResponse<AuthResponse>> {
    try {
      const { data: response, error } = await apiClient
        .getSupabaseClient()
        .auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

      if (error) {
        return {
          data: null,
          error: {
            code: error.code || "AUTH_ERROR",
            message: error.message,
            status: 401,
            originalError: error,
          },
        };
      }

      return {
        data: {
          user: response.user,
          session: response.session,
        },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: {
          code: "UNKNOWN_ERROR",
          message: error instanceof Error ? error.message : "Sign in failed",
          status: 500,
          originalError: error,
        },
      };
    }
  },

  /**
   * Sign in with OAuth
   */
  async signInWithOAuth(
    provider: "google" | "github",
    options?: { redirectTo?: string; scopes?: string }
  ): Promise<ApiResponse<null>> {
    try {
      const redirectTo = options?.redirectTo || `${window.location.origin}/`;
      const scopes = options?.scopes;

      const { error } = await apiClient
        .getSupabaseClient()
        .auth.signInWithOAuth({
          provider: provider,
          options: {
            redirectTo,
            scopes,
          },
        });

      if (error) {
        return {
          data: null,
          error: {
            code: error.code || "AUTH_ERROR",
            message: error.message,
            status: 400,
            originalError: error,
          },
        };
      }

      return {
        data: null,
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: {
          code: "UNKNOWN_ERROR",
          message:
            error instanceof Error
              ? error.message
              : `OAuth sign in with ${provider} failed`,
          status: 500,
          originalError: error,
        },
      };
    }
  },

  /**
   * Sign out
   */
  async signOut(): Promise<ApiResponse<null>> {
    // Helper function to clear all Supabase data from localStorage
    const clearSupabaseStorage = () => {
      try {
        const keys = Object.keys(localStorage).filter(key => 
          key.startsWith('sb-') || key.includes('supabase')
        );
        keys.forEach(key => {
          localStorage.removeItem(key);
        });
      } catch (e) {
        console.error('[Auth] Failed to clear localStorage:', e);
      }
    };

    try {
      // First, clear localStorage to prevent session restoration
      clearSupabaseStorage();

      const { error } = await apiClient.getSupabaseClient().auth.signOut({ scope: 'local' });

      if (error) {
        // Log the error but don't fail the logout since we already cleared local storage
        const ignorableErrors = ['session_not_found', '403', 'Forbidden', 'CORS'];
        const shouldIgnore = ignorableErrors.some(errType => 
          error.code?.includes(errType) || 
          error.message?.includes(errType) ||
          (error as any).status === 403
        );

        if (shouldIgnore) {
          return {
            data: null,
            error: null,
          };
        }
        return {
          data: null,
          error: null,
        };
      }

      return {
        data: null,
        error: null,
      };
    } catch (error) {
      console.error('[Auth] Exception during logout:', error);
      clearSupabaseStorage();
      // Always return success for logout to ensure user is logged out locally
      return {
        data: null,
        error: null,
      };
    }
  },

  /**
   * Send a password reset email
   */
  async requestPasswordReset(email: string): Promise<ApiResponse<null>> {
    try {
      const { error } = await apiClient
        .getSupabaseClient()
        .auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

      if (error) {
        return {
          data: null,
          error: {
            code: error.code || "AUTH_ERROR",
            message: error.message,
            status: 400,
            originalError: error,
          },
        };
      }

      return {
        data: null,
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: {
          code: "UNKNOWN_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to send password reset email",
          status: 500,
          originalError: error,
        },
      };
    }
  },

  /**
   * Update the authenticated user's password
   */
  async updatePassword(newPassword: string): Promise<ApiResponse<null>> {
    try {
      const { error } = await apiClient.getSupabaseClient().auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return {
          data: null,
          error: {
            code: error.code || "AUTH_ERROR",
            message: error.message,
            status: 400,
            originalError: error,
          },
        };
      }

      return {
        data: null,
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: {
          code: "UNKNOWN_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to reset password",
          status: 500,
          originalError: error,
        },
      };
    }
  },

  /**
   * Update authenticated user's metadata
   */
  async updateUserMetadata(
    metadata: Record<string, unknown>
  ): Promise<ApiResponse<null>> {
    try {
      const { error } = await apiClient.getSupabaseClient().auth.updateUser({
        data: metadata,
      });

      if (error) {
        return {
          data: null,
          error: {
            code: error.code || "AUTH_ERROR",
            message: error.message,
            status: 400,
            originalError: error,
          },
        };
      }

      return {
        data: null,
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: {
          code: "UNKNOWN_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to update user metadata",
          status: 500,
          originalError: error,
        },
      };
    }
  },

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(
    callback: (event: string, session: Session | null) => void
  ) {
    const {
      data: { subscription },
    } = apiClient
      .getSupabaseClient()
      .auth.onAuthStateChange((event, session) => {
        callback(event, session);
      });

    return subscription;
  },
};
