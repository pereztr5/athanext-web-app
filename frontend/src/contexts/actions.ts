import { User } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";
import { authAPI, apiClient } from "@/api";
import { strings } from "@/config/strings";
import { userProfilesAPI, type UserProfile } from "@/api/userProfiles";

// Toast type definition
export interface ToastFunction {
  (options: {
    title: string;
    description: string;
    variant?: "default" | "destructive";
  }): void;
}

// Cache for user profiles to prevent duplicate fetches
const userProfileCache = new Map<string, UserProfile>();
const profileFetchPromises = new Map<string, Promise<void>>();

/**
 * Fetches user profile from user_profiles table with caching
 */
export const fetchUserProfile = async (
  userId: string,
  setUserProfile: (profile: UserProfile | null) => void
): Promise<void> => {
  // Check cache first
  const cached = userProfileCache.get(userId);
  if (cached) {
    setUserProfile(cached);
    return;
  }

  // Check if already fetching
  const existingPromise = profileFetchPromises.get(userId);
  if (existingPromise) {
    await existingPromise;
    const cachedAfterWait = userProfileCache.get(userId);
    if (cachedAfterWait) {
      setUserProfile(cachedAfterWait);
    }
    return;
  }

  const fetchPromise = (async () => {
    try {
      const response = await userProfilesAPI.getUserProfile(userId);
      if (!response.error && response.data) {
        userProfileCache.set(userId, response.data);
        setUserProfile(response.data);
      } else {
        setUserProfile(null);
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
      setUserProfile(null);
    } finally {
      profileFetchPromises.delete(userId);
    }
  })();

  profileFetchPromises.set(userId, fetchPromise);
  await fetchPromise;
};

/**
 * Refreshes the current user's profile by clearing cache and re-fetching
 */
export const refreshUserProfile = async (
  user: User | null,
  setUserProfile: (profile: UserProfile | null) => void
): Promise<void> => {
  if (user?.id) {
    userProfileCache.delete(user.id);
    await fetchUserProfile(user.id, setUserProfile);
  }
};

/**
 * Signs up a new user with email and password
 */
export const signUp = async (
  email: string,
  password: string,
  toast: ToastFunction,
  name?: string
): Promise<{ error: any }> => {
  const response = await authAPI.signUp({
    email,
    password,
    name: name || email.split("@")[0],
    emailRedirectTo: `${window.location.origin}/auth?mode=complete-profile`,
  });

  if (response.error) {
    toast({
      title: "Sign up failed",
      description: response.error.message,
      variant: "destructive",
    });
    return { error: response.error };
  }

  toast({
    title: "Check your email",
    description:
      "We've sent you a confirmation link to complete your signup.",
  });

  return { error: null };
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

  if (user?.id) {
    userProfileCache.delete(user.id);
  }
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
  email: string,
  toast: ToastFunction
): Promise<{ error: any }> => {
  const response = await authAPI.requestPasswordReset(email);

  if (response.error) {
    toast({
      title: "Password reset failed",
      description: response.error.message,
      variant: "destructive",
    });
    return { error: response.error };
  }

  toast({
    title: "Check your email",
    description: strings.success.checkEmail,
  });

  return { error: null };
};

/**
 * Updates the user's password (for password reset flow)
 */
export const updatePassword = async (
  newPassword: string,
  toast: ToastFunction
): Promise<{ error: any }> => {
  const response = await authAPI.updatePassword(newPassword);

  if (response.error) {
    toast({
      title: "Could not update password",
      description: response.error.message,
      variant: "destructive",
    });
    return { error: response.error };
  }

  toast({
    title: "Password updated",
    description: "You can now sign in with your new password.",
  });

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
    const text = verifyError.message?.toLowerCase() ?? "";
    const wrongPassword =
      verifyError.status === 400 ||
      text.includes("invalid login") ||
      text.includes("invalid credentials");
    return {
      error: new Error(wrongPassword ? "That password isn't right" : "Couldn't update your password. Try again."),
    };
  }

  const response = await authAPI.updatePassword(newPassword);
  if (response.error) {
    return { error: new Error("Couldn't update your password. Try again.") };
  }
  return { error: null };
};

/**
 * Clears the user profile cache for a specific user
 */
export const clearUserProfileCache = (userId: string): void => {
  userProfileCache.delete(userId);
};

/**
 * Clears all cached user profiles
 */
export const clearAllUserProfileCaches = (): void => {
  userProfileCache.clear();
  profileFetchPromises.clear();
};
