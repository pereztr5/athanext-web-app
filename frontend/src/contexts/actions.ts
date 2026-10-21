import { User } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";
import { authAPI, apiClient } from "@/api";
import { userProfilesAPI, type UserProfile } from "@/api/userProfiles";
import { friendlyPasswordError } from "@/utils/passwordErrors";

// Toast type definition
export interface ToastFunction {
  (options: {
    title: string;
    description: string;
    variant?: "default" | "destructive";
  }): void;
}

// In-flight profile fetches, so parallel callers share one request. Results are not cached:
// a stale profile could send a finished account back to sign-up.
const profileFetchPromises = new Map<string, Promise<UserProfile | null | undefined>>();

/**
 * Fetches user profile from user_profiles table. With `quiet`, a failed fetch keeps the
 * current profile instead of clearing it (background refreshes).
 */
export const fetchUserProfile = async (
  userId: string,
  setUserProfile: (profile: UserProfile | null) => void,
  options: { quiet?: boolean } = {}
): Promise<void> => {
  let fetchPromise = profileFetchPromises.get(userId);
  if (!fetchPromise) {
    // undefined = the fetch failed; null = no profile row yet.
    fetchPromise = (async () => {
      try {
        const response = await userProfilesAPI.getUserProfile(userId);
        if (response.error) return undefined;
        return response.data ?? null;
      } catch (err) {
        console.error("Error fetching user profile:", err);
        return undefined;
      } finally {
        profileFetchPromises.delete(userId);
      }
    })();
    profileFetchPromises.set(userId, fetchPromise);
  }

  const profile = await fetchPromise;
  if (profile === undefined && options.quiet) return;
  setUserProfile(profile ?? null);
};

/**
 * Refreshes the current user's profile
 */
export const refreshUserProfile = async (
  user: User | null,
  setUserProfile: (profile: UserProfile | null) => void
): Promise<void> => {
  if (user?.id) {
    await fetchUserProfile(user.id, setUserProfile, { quiet: true });
  }
};

/**
 * Signs in a user with email and password
 */
export const signIn = async (
  email: string,
  password: string,
  toast: ToastFunction
): Promise<{ error: any }> => {
  const response = await authAPI.signIn({
    email,
    password,
  });

  if (response.error) {
    const errorMessage =
      typeof response.error.message === "string"
        ? response.error.message.toLowerCase()
        : "";

    const isUnconfirmed =
      response.error.code === "email_not_confirmed" ||
      errorMessage.includes("confirm");

    toast({
      title: isUnconfirmed ? "Confirm your email" : "Sign in failed",
      description: isUnconfirmed
        ? "Check your inbox for the confirmation link before signing in."
        : response.error.message,
      variant: "destructive",
    });
    return { error: response.error };
  }

  toast({
    title: "Welcome back",
    description: "You're signed in.",
  });

  return { error: null };
};

/**
 * Signs out the current user and clears all caches
 */
export const signOut = async (
  user: User | null,
  toast: ToastFunction,
  setUser: (user: User | null) => void,
  setSession: (session: any) => void,
  setUserProfile: (profile: UserProfile | null) => void,
  setUserImg?: (img: string | null) => void,
  setUserName?: (name: string | null) => void,
  queryClient?: QueryClient
): Promise<{ error: any }> => {
  const response = await authAPI.signOut();

  profileFetchPromises.clear();

  // Clear all React Query caches (reviews, coach details, profile, etc.) on sign-out
  queryClient?.clear();

  // Reset local state
  setUser(null);
  setSession(null);
  setUserProfile(null);
  setUserImg?.(null);
  setUserName?.(null);

  if (response.error) {
    toast({
      title: "Signed out",
      description: "You're signed out.",
    });
  } else {
    toast({
      title: "Signed out",
      description: "You're signed out.",
    });
  }

  return { error: null };
};

/**
 * Requests a password reset email for the given email address
 */
export const requestPasswordReset = async (
  email: string
): Promise<{ error: any }> => {
  // The page shows the result in place (Check your email), so no toast here.
  const response = await authAPI.requestPasswordReset(email);
  return { error: response.error ?? null };
};

/**
 * Updates the user's password (for password reset flow)
 */
export const updatePassword = async (
  newPassword: string
): Promise<{ error: any }> => {
  // The reset page shows the error next to the form.
  const response = await authAPI.updatePassword(newPassword);
  if (response.error) {
    return { error: new Error(friendlyPasswordError(response.error.originalError ?? response.error)) };
  }
  return { error: null };
};

/**
 * Changes the user's password (requires current password verification)
 */
export const changePassword = async (
  user: User | null,
  currentPassword: string,
  newPassword: string,
  toast: ToastFunction
): Promise<{ error: any }> => {
  if (!user?.email) {
    const error = new Error("No authenticated user.");
    toast({
      title: "Unable to update password",
      description: "Sign in again and try changing your password.",
      variant: "destructive",
    });
    return { error };
  }

  const { error: verifyError } = await apiClient
    .getSupabaseClient()
    .auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

  if (verifyError) {
    return { error: new Error(friendlyPasswordError(verifyError)) };
  }

  const response = await authAPI.updatePassword(newPassword);
  if (response.error) {
    return { error: new Error(friendlyPasswordError(response.error.originalError ?? response.error)) };
  }
  return { error: null };
};

/**
 * Drops any in-flight profile fetches (sign-out)
 */
export const clearAllUserProfileCaches = (): void => {
  profileFetchPromises.clear();
};
