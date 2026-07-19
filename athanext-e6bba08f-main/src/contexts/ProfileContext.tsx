import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PROFILE_TYPE } from "@/utils/db";
import type { CoachDetails } from "@/hooks/useCoachDetails";
import type { AthleteProfile } from "@/hooks/useProfile";
import type { UserProfile } from "@/api/endpoints/userProfiles";
import { calculateProfileProgress, DEFAULT_PROFILE_PROGRESS, type ProfileData } from "@/utils/profileCompletion";

export type UserType = "coach" | "athlete" | null;

export interface ProfileState {
  type: UserType;
  data: CoachDetails | AthleteProfile | null;
  userProfile: UserProfile | null;
}

interface ProfileContextType {
  profile: ProfileState;
  loading: boolean;
  error: string | null;
  user: any;
  authLoading: boolean;
  refetchProfile: () => Promise<void>;
  saveAthleteProfile: (payload: any) => Promise<any>;
}

const defaultProfileState: ProfileState = {
  type: null,
  data: null,
  userProfile: null,
};

// Global cache that persists across navigation and component re-renders
let globalProfileCache: ProfileState = defaultProfileState;
let globalCachedUserId: string | null = null;
let globalUserImage: string | null = null; // Persistent image cache
let cacheInvalidated = false; // Flag to force cache bypass

/**
 * Clear the global image cache to force reload of new profile images
 * Call this after uploading a new profile picture
 */
export const clearGlobalImageCache = () => {
  globalUserImage = null;
  cacheInvalidated = true; // Mark cache as invalid
};

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const {
    user,
    userProfile,
    loading: authLoading,
    setProfileProgress,
    setProfileCompletion,
  } = useAuth();
  const [profile, setProfile] = useState<ProfileState>(() => globalProfileCache);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isInitialMount = useRef(true);

  const fetchProfile = useCallback(async () => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user?.id) {
      globalProfileCache = defaultProfileState;
      globalCachedUserId = null;
      globalUserImage = null;
      setProfile(defaultProfileState);
      setLoading(false);
      return;
    }

    // If we have cached profile for this user, use it immediately (including image)
    // But skip if cache was explicitly invalidated
    if (globalCachedUserId === user.id && globalProfileCache.userProfile && !cacheInvalidated) {
      setProfile(globalProfileCache);
      setLoading(false);
      return;
    }

    // New user or user changed - fetch fresh data
    if (globalCachedUserId !== user.id) {
      globalCachedUserId = user.id;
    }

    try {
      setLoading(true);
      setError(null);

      const baseProfile = userProfile;

      if (!baseProfile) {
        // Wait for AuthContext to fetch userProfile - but keep existing image if we have it
        setProfile({
          type: null,
          data: null,
          userProfile: globalUserImage ? { ...defaultProfileState.userProfile, image_url: globalUserImage } as UserProfile : null,
        });
        setLoading(false);
        return;
      }

      // Cache the image immediately when we get userProfile
      if (baseProfile.image_url) {
        globalUserImage = baseProfile.image_url;
      }

      const personaHint = (baseProfile?.persona_type ||
        user?.user_metadata?.persona_type ||
        user?.user_metadata?.persona) as UserType | string | undefined;
      const resolvedPersonaHint =
        personaHint === PROFILE_TYPE.parent ? PROFILE_TYPE.athlete : personaHint;

      if (resolvedPersonaHint === PROFILE_TYPE.coach && baseProfile?.coach_id) {
        const { data: coachData, error: coachError } = await supabase
          .from("coaches")
          .select(
            `
              *,
              certifications:coach_certifications!coach_certifications_coach_id_fkey(id, certification_name, issuing_organization, issue_date, expiry_date),
              achievements:coach_achievements!coach_achievements_coach_id_fkey(id, title, description, year),
              user_profiles!user_profiles_coach_id_fkey(gender, zip_code)
            `
          )
          .eq("id", baseProfile.coach_id)
          .maybeSingle();

        if (coachError) {
          console.error("Coach profile query failed:", coachError);
        }

        const resolvedCoachData = coachData as any | null;
        if (resolvedCoachData) {
          const enhancedCoachData = {
            ...resolvedCoachData,
            gender:
              Array.isArray(resolvedCoachData?.user_profiles) &&
              resolvedCoachData.user_profiles.length > 0
                ? resolvedCoachData.user_profiles[0]?.gender
                : null,
            zip_code:
              Array.isArray(resolvedCoachData?.user_profiles) &&
              resolvedCoachData.user_profiles.length > 0
                ? resolvedCoachData.user_profiles[0]?.zip_code
                : null,
          };
          const newProfile = {
            type: "coach" as UserType,
            data: enhancedCoachData,
            userProfile: baseProfile || null,
          };
          globalProfileCache = newProfile;
          setProfile(newProfile);
          setLoading(false);
          return;
        }

        const newProfile = {
          type: "coach" as UserType,
          data: null,
          userProfile: baseProfile || null,
        };
        globalProfileCache = newProfile;
        setProfile(newProfile);
        setLoading(false);
        return;
      } else if (resolvedPersonaHint === PROFILE_TYPE.athlete) {
        const { data: athleteData, error: athleteError } = await supabase
          .from("athlete_profiles")
          .select(
            "id, user_id, full_name, date_of_birth, sport, position, phone_number, location, tags, profile_image_url, cover_image_urls, bio, profile_completed, created_at, updated_at, instagram_handle, graduation_year, current_year, high_school, gpa, height, weight, dominant_hand"
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (athleteError) {
          console.error("Athlete profile query failed:", athleteError);
        }

        const resolvedAthleteData = (athleteData as any) as AthleteProfile | null;
        if (resolvedAthleteData) {
          const newProfile = {
            type: "athlete" as UserType,
            data: resolvedAthleteData,
            userProfile: baseProfile || null,
          };
          globalProfileCache = newProfile;
          setProfile(newProfile);
          setLoading(false);
          return;
        }

        const newProfile = {
          type: "athlete" as UserType,
          data: null,
          userProfile: baseProfile || null,
        };
        globalProfileCache = newProfile;
        setProfile(newProfile);
        setLoading(false);
        return;
      }

      const newProfile = {
        type: resolvedPersonaHint === PROFILE_TYPE.athlete
          ? PROFILE_TYPE.athlete
          : resolvedPersonaHint === PROFILE_TYPE.coach
          ? PROFILE_TYPE.coach
          : null,
        data: null,
        userProfile: baseProfile || null,
      };
      globalProfileCache = newProfile;
      setProfile(newProfile);
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch profile");
    } finally {
      setLoading(false);
      // Reset invalidation flag after all fetches complete
      cacheInvalidated = false;
    }
  }, [user?.id, user?.user_metadata?.persona_type, user?.user_metadata?.persona, userProfile?.persona_type, userProfile?.coach_id, authLoading]);

  const saveAthleteProfile = useCallback(
    async (payload: any) => {
      if (!user?.id) {
        throw new Error("You must be signed in to update your profile.");
      }

      const upsertPayload = {
        ...payload,
        user_id: user.id,
      };

      const { data, error } = await supabase
        .from("athlete_profiles")
        .upsert(upsertPayload as any, { onConflict: "user_id" })
        .select(
          "id, user_id, full_name, date_of_birth, sport, position, phone_number, location, tags, profile_image_url, cover_image_urls, bio, profile_completed, created_at, updated_at, instagram_handle, graduation_year, current_year, high_school, gpa, height, weight, dominant_hand"
        )
        .single();

      if (error) {
        console.error("Failed to save athlete profile:", error);
        throw error;
      }

      const athleteProfile = (data as any) as AthleteProfile;
      const newProfile = {
        type: "athlete" as UserType,
        data: athleteProfile,
        userProfile: profile.userProfile,
      };
      globalProfileCache = newProfile;
      setProfile(newProfile);
      return athleteProfile;
    },
    [user]
  );

  const refetchProfile = useCallback(async () => {
    // Invalidate cache to force fresh fetch
    cacheInvalidated = true;
    clearGlobalImageCache();
    await fetchProfile();
  }, [fetchProfile]);

  // On mount, restore from global cache if available
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      
      // If we have cached data for this user, use it immediately
      if (user?.id && globalCachedUserId === user.id && globalProfileCache.userProfile) {
        setProfile(globalProfileCache);
        setLoading(false);
        return;
      }
    }
    
    // Fetch profile when auth is ready and we have user
    if (!authLoading && user?.id) {
      fetchProfile();
    } else if (!authLoading && !user?.id) {
      // Clear profile when logged out
      globalProfileCache = defaultProfileState;
      globalCachedUserId = null;
      globalUserImage = null;
      setProfile(defaultProfileState);
      setLoading(false);
    }
  }, [user?.id, authLoading, fetchProfile]);

  // Refetch profile when userProfile changes (e.g., coach_id gets populated)
  useEffect(() => {
    if (userProfile && user?.id && globalCachedUserId === user.id) {
      // Clear cache and refetch if coach_id or athlete_id is now available
      const hasPendingProfileData = 
        (userProfile.coach_id && !globalProfileCache.data) ||
        (userProfile.athlete_id && !globalProfileCache.data);
      
      if (hasPendingProfileData) {
        globalCachedUserId = null;
        fetchProfile();
      }
    }
  }, [userProfile?.coach_id, userProfile?.athlete_id, user?.id, fetchProfile]);

  useEffect(() => {
    if (userProfile && user?.id && globalCachedUserId === user.id) {
      // Update cached image when present
      if (userProfile.image_url) {
        globalUserImage = userProfile.image_url;
      }

      const updatedProfile = {
        ...globalProfileCache,
        userProfile: userProfile,
      };
      globalProfileCache = updatedProfile;
      setProfile(updatedProfile);
    }
  }, [userProfile?.image_url, userProfile?.zip_code, userProfile?.gender, (user as any)?.name, user?.id]);

  useEffect(() => {
    if (!user) {
      setProfileProgress(DEFAULT_PROFILE_PROGRESS);
      setProfileCompletion(DEFAULT_PROFILE_PROGRESS.completion);
      return;
    }

    if (profile?.data) {
      const progress = calculateProfileProgress(profile.data as ProfileData);
      setProfileProgress(progress);
      setProfileCompletion(progress.completion);
    } else {
      setProfileProgress(DEFAULT_PROFILE_PROGRESS);
      setProfileCompletion(DEFAULT_PROFILE_PROGRESS.completion);
    }
  }, [user, profile?.data, profile?.type, setProfileCompletion, setProfileProgress]);

  return (
    <ProfileContext.Provider
      value={{
        profile,
        loading,
        error,
        user,
        authLoading,
        refetchProfile,
        saveAthleteProfile,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
};
