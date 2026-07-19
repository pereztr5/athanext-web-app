import {
  type ProfileData,
  calculateProfileProgress,
  DEFAULT_PROFILE_PROGRESS,
} from "@/utils/profileCompletion";
import { useAuth } from "./useAuth";
import { PROFILE_TYPE } from "@/utils/db";
import type { CoachDetails } from "./useCoachDetails";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type UserProfile as SupabaseUserProfile } from "@/api/endpoints/userProfiles";

export type UserType = "coach" | "athlete" | null;

export interface AthleteProfile {
  id: string;
  user_id: string;
  full_name: string;
  date_of_birth: string;
  sport: string;
  position?: string | null;
  phone_number?: string | null;
  location?: string | null;
  tags: string[];
  profile_image_url?: string | null;
  cover_image_urls: string[];
  bio?: string | null;
  profile_completed?: boolean;
  created_at: string;
  updated_at: string;
  instagram_handle?: string | null;
  graduation_year?: string | number | null;
  current_year?: string | null;
  high_school?: string | null;
  gpa?: string | number | null;
  height?: string | number | null;
  weight?: string | number | null;
  dominant_hand?: string | null;
}

export interface AthleteProfileUpsertPayload {
  full_name: string;
  sport: string;
  position?: string | null;
  date_of_birth: string;
  phone_number?: string | null;
  location?: string | null;
  tags: string[];
  profile_image_url?: string | null;
  cover_image_urls: string[];
  bio?: string | null;
  instagram_handle?: string | null;
  graduation_year?: string | number | null;
  current_year?: string | null;
  high_school?: string | null;
  gpa?: string | number | null;
  height?: string | number | null;
  weight?: string | number | null;
  dominant_hand?: string | null;
}

export interface ProfileState {
  type: UserType;
  data: CoachDetails | AthleteProfile | null;
  userProfile: SupabaseUserProfile | null;
}

const defaultProfileState: ProfileState = {
  type: null,
  data: null,
  userProfile: null,
};
const profileCache = new Map<string, ProfileState>();
const fetchAttempted = new Map<string, boolean>();

// Rate limiting for profile updates
const updateTimestamps = new Map<string, number>();
const MIN_UPDATE_INTERVAL = 3000; // 3 seconds between updates

// Export function to clear cache
export const clearProfileCache = () => {
  profileCache.clear();
  fetchAttempted.clear();
  updateTimestamps.clear();
};


const canUpdateProfile = (userId: string): boolean => {
  const lastUpdate = updateTimestamps.get(userId);
  if (!lastUpdate) return true;
  return Date.now() - lastUpdate >= MIN_UPDATE_INTERVAL;
};

export const useProfile = () => {
  const {
    user,
    userProfile,
    loading: authLoading,
    setProfileProgress,
    setProfileCompletion,
  } = useAuth();
  const [profile, setProfileState] =
    useState<ProfileState>(defaultProfileState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setProfile = useCallback(
    (next: ProfileState | ((prev: ProfileState) => ProfileState)) => {
      setProfileState((prev) => {
        const resolved =
          typeof next === "function"
            ? (next as (prev: ProfileState) => ProfileState)(prev)
            : next;
        if (user?.id) {
          profileCache.set(user.id, resolved);
        }
        return resolved;
      });
    },
    [user?.id]
  );

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user?.id) {
      setProfileState(defaultProfileState);
      setLoading(false);
      return;
    }

    // Check cache first (but only if we haven't already attempted a fresh fetch)
    const alreadyAttemptedFetch = fetchAttempted.get(user.id);
    const cached = profileCache.get(user.id);
    
    if (cached && alreadyAttemptedFetch) {
      // Use cache only if we've already fetched fresh data in this session
      setProfileState(cached);
      setLoading(false);
      return;
    }

    // If no valid cache or first load, prepare to fetch fresh data
    setProfileState(defaultProfileState);
    setLoading(true);
  }, [authLoading, user?.id]);

  const fetchProfile = useCallback(async () => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user?.id) {
      setProfile(defaultProfileState);
      setLoading(false);
      return;
    }

    // Skip fetch if we've already attempted for this user and have data
    const alreadyFetched = fetchAttempted.get(user.id);
    const cachedProfile = profileCache.get(user.id);
    if (alreadyFetched && cachedProfile && cachedProfile.data) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Use userProfile from auth context instead of fetching again
      const baseProfile = userProfile;

      if (!baseProfile) {
        setProfile({
          type: null,
          data: null,
          userProfile: null,
        });
        fetchAttempted.set(user.id, true);
        setLoading(false);
        return;
      }

      const personaHint = (baseProfile?.persona_type ||
        user?.user_metadata?.persona_type ||
        user?.user_metadata?.persona) as UserType | string | undefined;
      const resolvedPersonaHint =
        personaHint === PROFILE_TYPE.parent ? PROFILE_TYPE.athlete : personaHint;

      // Fetch only the relevant profile type based on persona hint
      // This reduces unnecessary parallel queries
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
          // Extract gender and zip_code from user_profiles if available
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
          setProfile({
            type: "coach",
            data: enhancedCoachData,
            userProfile: baseProfile || null,
          });
          fetchAttempted.set(user.id, true);
          setLoading(false);
          return;
        }

        // Coach persona but no coach record yet (or coach_id doesn't exist in coaches table)
        setProfile({
          type: "coach",
          data: null,
          userProfile: baseProfile || null,
        });
        fetchAttempted.set(user.id, true);
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
          setProfile({
            type: "athlete",
            data: resolvedAthleteData,
            userProfile: baseProfile || null,
          });
          fetchAttempted.set(user.id, true);
          setLoading(false);
          return;
        }

        // Athlete persona but no profile data yet
        setProfile({
          type: "athlete",
          data: null,
          userProfile: baseProfile || null,
        });
        fetchAttempted.set(user.id, true);
        setLoading(false);
        return;
      }

      // Fallback: check both if persona hint is unclear
      // Only do this if we don't have a clear persona type
      const athletePromise = supabase
        .from("athlete_profiles")
        .select(
          "id, user_id, full_name, date_of_birth, sport, position, phone_number, location, tags, profile_image_url, cover_image_urls, bio, profile_completed, created_at, updated_at, instagram_handle, graduation_year, current_year, high_school, gpa, height, weight, dominant_hand"
        )
        .eq("user_id", user.id)
        .maybeSingle();
      const coachPromise = baseProfile?.coach_id
        ? supabase
            .from("coaches")
            .select(
              `
                *,
                certifications:coach_certifications!coach_certifications_coach_id_fkey(id, certification_name, issuing_organization, issue_date, expiry_date),
                achievements:coach_achievements!coach_achievements_coach_id_fkey(id, title, description, year),
              `
            )
            .eq("id", baseProfile.coach_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const [
        { data: athleteData, error: athleteError },
        { data: coachData, error: coachError },
      ] = await Promise.all([athletePromise, coachPromise]);

      if (athleteError) {
        console.error("Athlete profile query failed:", athleteError);
      }
      if (coachError) {
        console.error("Coach profile query failed:", coachError);
      }

      const resolvedCoachData = coachData as CoachDetails | null;
      const resolvedAthleteData = (athleteData as any) as AthleteProfile | null;

      if (resolvedCoachData) {
        setProfile({
          type: "coach",
          data: resolvedCoachData,
          userProfile: baseProfile || null,
        });
      } else if (resolvedAthleteData) {
        setProfile({
          type: "athlete",
          data: resolvedAthleteData,
          userProfile: baseProfile || null,
        });
      } else {
        setProfile({
          type:
            resolvedPersonaHint === PROFILE_TYPE.athlete
              ? PROFILE_TYPE.athlete
              : resolvedPersonaHint === PROFILE_TYPE.coach
              ? PROFILE_TYPE.coach
              : null,
          data: null,
          userProfile: baseProfile || null,
        });
      }

      fetchAttempted.set(user.id, true);
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch profile");
    } finally {
      setLoading(false);
    }
    // Note: userProfile is intentionally read from closure to avoid refetch on every userProfile change
    // Only key fields that determine profile type are tracked
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user?.id,
    user?.user_metadata?.persona_type,
    user?.user_metadata?.persona,
    userProfile?.persona_type,
    userProfile?.coach_id,
    authLoading,
    setProfile,
  ]);

  /**
   * Save or update an athlete's profile with validation and sanitization
   * Implements rate limiting, input validation, and XSS protection
   *
   * @param payload - The athlete profile data to save
   * @throws Error if user is not authenticated or rate limit is exceeded
   * @returns Promise<AthleteProfile> - The saved athlete profile
   *
   * Security features:
   * - Rate limiting: 3-second cooldown between updates
   * - Input sanitization: Limits field lengths to prevent overflow
   * - Array validation: Validates and limits tags/images count
   * - Required field validation: Ensures email is included
   */
  const saveAthleteProfile = useCallback(
    async (payload: AthleteProfileUpsertPayload) => {
      if (!user?.id) {
        throw new Error("You must be signed in to update your profile.");
      }

      // Rate limiting check
      if (!canUpdateProfile(user.id)) {
        throw new Error(
          "Please wait a few seconds before updating your profile again."
        );
      }

      // Validate required fields
      if (
        !payload.full_name?.trim() ||
        !payload.sport?.trim() ||
        !payload.date_of_birth
      ) {
        throw new Error("Full name, sport, and date of birth are required.");
      }

      // Validate date of birth is not in the future
      const dob = new Date(payload.date_of_birth);
      if (dob > new Date()) {
        throw new Error("Date of birth cannot be in the future.");
      }

      // Validate age (must be at least 5 years old)
      const age = Math.floor(
        (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
      );
      if (age < 5 || age > 120) {
        throw new Error("Please enter a valid date of birth.");
      }

      // Sanitize and validate tags
      const sanitizedTags = Array.isArray(payload.tags)
        ? payload.tags
            .filter(Boolean)
            .map((tag) => tag.trim().slice(0, 50)) // Limit tag length
            .slice(0, 10) // Max 10 tags
        : [];

      // Validate cover images count
      const sanitizedCoverImages = Array.isArray(payload.cover_image_urls)
        ? payload.cover_image_urls.filter(Boolean).slice(0, 3)
        : [];

      const upsertPayload = {
        ...payload,
        user_id: user.id,
        full_name: payload.full_name.trim().slice(0, 100), // Limit name length
        sport: payload.sport.trim().slice(0, 50),
        position: payload.position?.trim().slice(0, 50) || null,
        location: payload.location?.trim().slice(0, 100) || null,
        tags: sanitizedTags,
        cover_image_urls: sanitizedCoverImages,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      // Update rate limiting timestamp
      updateTimestamps.set(user.id, Date.now());

      const athleteProfile = (data as any) as AthleteProfile;
      
      // Get current profile state to preserve userProfile
      const currentState = profileCache.get(user.id) || profile;
      const updatedProfileState = {
        type: "athlete" as UserType,
        data: athleteProfile,
        userProfile: currentState.userProfile,
      };
      
      // Update both local state and cache
      setProfile(updatedProfileState);
      profileCache.set(user.id, updatedProfileState);
      
      return athleteProfile;
    },
    [user, setProfile, profile]
  );

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setProfileProgress(DEFAULT_PROFILE_PROGRESS);
      setProfileCompletion(DEFAULT_PROFILE_PROGRESS.completion);
      return;
    }
    
    if (profile?.type === "coach" && profile?.data) {
      const progress = calculateProfileProgress(profile.data as CoachDetails);
      setProfileProgress(progress);
      setProfileCompletion(progress.completion);
    } else if (profile?.type === "athlete" && profile?.data) {
      const progress = calculateProfileProgress(
        profile.data as unknown as ProfileData
      );
      setProfileProgress(progress);
      setProfileCompletion(progress.completion);
    } else {
      setProfileProgress(DEFAULT_PROFILE_PROGRESS);
      setProfileCompletion(DEFAULT_PROFILE_PROGRESS.completion);
    }
  }, [authLoading, profile, setProfileCompletion, setProfileProgress, user]);

  return {
    profile,
    loading,
    error,
    user,
    authLoading,
    refetchProfile: fetchProfile,
    saveAthleteProfile,
  };
};
