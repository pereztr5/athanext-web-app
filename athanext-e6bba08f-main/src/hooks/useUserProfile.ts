import { useState, useEffect, useCallback } from "react";
import { userProfilesAPI, type UserProfile } from "@/api/endpoints/userProfiles";
import { useAuth } from "./useAuth";

interface UseUserProfileReturn {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<UserProfile | null>;
}

// Cache to prevent duplicate fetches
const profileCache = new Map<string, UserProfile>();
const fetchAttempted = new Map<string, boolean>();

/**
 * Clear the user profile cache for a specific user ID.
 * Call this after updating a profile to force a fresh fetch.
 */
export const clearUserProfileCache = (userId: string | undefined): void => {
  if (userId) {
    profileCache.delete(userId);
    fetchAttempted.delete(userId);
  }
};

/**
 * Hook to fetch and manage the current user's profile from user_profiles table
 */
export const useUserProfile = (): UseUserProfileReturn => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      setProfile(null);
      return;
    }

    // Check cache first
    const cached = profileCache.get(user.id);
    if (cached && fetchAttempted.get(user.id)) {
      setProfile(cached);
      setLoading(false);
      return;
    }

    // Skip if already fetching
    if (fetchAttempted.get(user.id)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      fetchAttempted.set(user.id, true);

      const response = await userProfilesAPI.getUserProfile(user.id);

      if (response.error) {
        setError(response.error.message || "Failed to fetch user profile");
        setProfile(null);
      } else {
        setProfile(response.data);
        if (response.data) {
          profileCache.set(user.id, response.data);
        }
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch user profile");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const updateProfile = async (updates: Partial<UserProfile>): Promise<UserProfile | null> => {
    if (!user) return null;

    try {
      const email =
        (updates as any)?.email ??
        profile?.email ??
        user.email ??
        "";

      const name =
        (updates as any)?.name ??
        profile?.name ??
        (user.user_metadata?.name as string | undefined) ??
        user.email?.split("@")[0] ??
        "";

      if (!email || !name) {
        setError("Missing basic profile information to save your account.");
        return null;
      }

      const upsertPayload: Record<string, unknown> = {
        id: user.id,
        email,
        name,
      };

      // Preserve any explicit updates (including null) but skip undefined values
      Object.entries(updates as Record<string, unknown>).forEach(([key, value]) => {
        if (value !== undefined) {
          upsertPayload[key] = value;
        }
      });

      // Fill in common fields from existing profile or auth metadata when not provided
      const fallbackFields: Record<string, unknown> = {
        persona_type: profile?.persona_type ?? user.user_metadata?.persona_type,
        phone_number: profile?.phone_number ?? user.user_metadata?.phone_number,
        sport: profile?.sport ?? user.user_metadata?.sport,
        position: profile?.position ?? user.user_metadata?.position,
        date_of_birth: profile?.date_of_birth ?? user.user_metadata?.date_of_birth,
        coach_id: profile?.coach_id,
        athlete_id: profile?.athlete_id,
        instagram_handle: (profile as any)?.instagram_handle,
        website: (profile as any)?.website,
        image_url: (profile as any)?.image_url,
        gender: (profile as any)?.gender ?? (user.user_metadata as any)?.gender,
        zip_code: (profile as any)?.zip_code ?? (user.user_metadata as any)?.zip_code,
      };

      Object.entries(fallbackFields).forEach(([key, value]) => {
        if (upsertPayload[key] === undefined && value !== undefined) {
          upsertPayload[key] = value;
        }
      });

      // Preserve server-driven completion flag; do not auto-calculate here

      const response = await userProfilesAPI.upsertUserProfile(upsertPayload as any);

      if (response.error) {
        setError(response.error.message || "Failed to update profile");
        return null;
      }

      setProfile(response.data);
      // Update cache with new data
      if (response.data && user.id) {
        profileCache.set(user.id, response.data);
      }
      return response.data;
    } catch (err) {
      console.error("Error updating user profile:", err);
      setError(err instanceof Error ? err.message : "Failed to update profile");
      return null;
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    loading,
    error,
    refetch: fetchProfile,
    updateProfile,
  };
};

/**
 * Hook to fetch a specific user profile by ID
 */
export const useUserProfileById = (userId: string | undefined): Omit<UseUserProfileReturn, "updateProfile"> => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setProfile(null);
      return;
    }

    // Check cache first
    const cached = profileCache.get(userId);
    if (cached && fetchAttempted.get(userId)) {
      setProfile(cached);
      setLoading(false);
      return;
    }

    // Skip if already fetching
    if (fetchAttempted.get(userId)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      fetchAttempted.set(userId, true);

      const response = await userProfilesAPI.getUserProfile(userId);

      if (response.error) {
        setError(response.error.message || "Failed to fetch user profile");
        setProfile(null);
      } else {
        setProfile(response.data);
        if (response.data) {
          profileCache.set(userId, response.data);
        }
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch user profile");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    loading,
    error,
    refetch: fetchProfile,
  };
};
