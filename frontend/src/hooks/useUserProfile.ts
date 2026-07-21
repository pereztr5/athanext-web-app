import { useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userProfilesAPI, type UserProfile } from "@/api/userProfiles";
import { useAuth } from "./useAuth";

interface UseUserProfileReturn {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  updateProfile: (updates: Partial<UserProfile>) => Promise<UserProfile | null>;
}

/**
 * Hook to fetch and manage the current user's profile from user_profiles table
 */
export const useUserProfile = (): UseUserProfileReturn => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [updateError, setUpdateError] = useState<string | null>(null);

  const query = useQuery<UserProfile | null>({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      const response = await userProfilesAPI.getUserProfile(user!.id);
      if (response.error) {
        throw new Error(response.error.message || "Failed to fetch user profile");
      }
      return response.data ?? null;
    },
    enabled: !!user?.id,
  });

  const profile = query.data ?? null;

  const updateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>): Promise<UserProfile | null> => {
      const response = await userProfilesAPI.upsertUserProfile(payload as any);
      if (response.error) {
        throw new Error(response.error.message || "Failed to update profile");
      }
      return response.data ?? null;
    },
    onSuccess: (data) => {
      if (data && user?.id) {
        queryClient.setQueryData(["user-profile", user.id], data);
      }
    },
  });

  const updateProfile = useCallback(
    async (updates: Partial<UserProfile>): Promise<UserProfile | null> => {
      if (!user) return null;

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
        setUpdateError("Missing basic profile information to save your account.");
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

      try {
        const data = await updateMutation.mutateAsync(upsertPayload);
        setUpdateError(null);
        return data;
      } catch (err) {
        console.error("Error updating user profile:", err);
        setUpdateError(err instanceof Error ? err.message : "Failed to update profile");
        return null;
      }
    },
    [user, profile, updateMutation]
  );

  return {
    profile,
    loading: query.isLoading,
    error: query.error ? query.error.message : updateError,
    refetch: query.refetch,
    updateProfile,
  };
};

/**
 * Hook to fetch a specific user profile by ID
 */
export const useUserProfileById = (userId: string | undefined): Omit<UseUserProfileReturn, "updateProfile"> => {
  const query = useQuery<UserProfile | null>({
    queryKey: ["user-profile", userId],
    queryFn: async () => {
      const response = await userProfilesAPI.getUserProfile(userId!);
      if (response.error) {
        throw new Error(response.error.message || "Failed to fetch user profile");
      }
      return response.data ?? null;
    },
    enabled: !!userId,
  });

  return {
    profile: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? query.error.message : null,
    refetch: query.refetch,
  };
};
