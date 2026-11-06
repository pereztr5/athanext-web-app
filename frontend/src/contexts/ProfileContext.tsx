import { errorMessage } from "@/utils/errorMessage";
import { createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PROFILE_TYPE } from "@/utils/db";
import { resolveRole } from "@/utils/role";
import type { CoachDetails } from "@/hooks/useCoachDetails";
import type { AthleteProfile } from "@/hooks/useProfile";
import type { UserProfile } from "@/api/userProfiles";
import { calculateProfileProgress, DEFAULT_PROFILE_PROGRESS, type ProfileData, type ProfileProgress } from "@/utils/profileCompletion";

export type UserType = "coach" | "athlete" | null;

export interface ProfileState {
  type: UserType;
  data: CoachDetails | AthleteProfile | null;
  userProfile: UserProfile | null;
}

interface ProfileContextType {
  profile: ProfileState;
  profileProgress: ProfileProgress;
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

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const {
    user,
    userProfile,
    loading: authLoading,
  } = useAuth();
  const [profile, setProfile] = useState<ProfileState>(defaultProfileState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    try {
      setLoading(true);
      setError(null);

      const baseProfile = userProfile;

      if (!baseProfile) {
        // AuthContext hasn't fetched user_profiles yet; effect re-runs when it lands
        setProfile(defaultProfileState);
        setLoading(false);
        return;
      }

      const role = resolveRole(user, baseProfile);
      // parent uses the athlete data path
      const resolvedPersonaHint = role === "parent" ? PROFILE_TYPE.athlete : role;

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
          setProfile(newProfile);
          setLoading(false);
          return;
        }

        const newProfile = {
          type: "coach" as UserType,
          data: null,
          userProfile: baseProfile || null,
        };
        setProfile(newProfile);
        setLoading(false);
        return;
      } else if (resolvedPersonaHint === PROFILE_TYPE.athlete) {
        const { data: athleteData, error: athleteError } = await supabase
          .from("athlete_profiles")
          .select(
            "id, user_id, full_name, date_of_birth, sport, position, phone_number, location, tags, pathway_tags, profile_image_url, cover_image_urls, bio, profile_completed, created_at, updated_at, instagram_handle, graduation_year, current_year, high_school, gpa, height, weight, dominant_hand"
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
          setProfile(newProfile);
          setLoading(false);
          return;
        }

        const newProfile = {
          type: "athlete" as UserType,
          data: null,
          userProfile: baseProfile || null,
        };
        setProfile(newProfile);
        setLoading(false);
        return;
      }

      const newProfile = {
        // Athletes returned above, so only a coach without a coach row reaches here.
        type: resolvedPersonaHint === PROFILE_TYPE.coach ? PROFILE_TYPE.coach : null,
        data: null,
        userProfile: baseProfile || null,
      };
      setProfile(newProfile);
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError(errorMessage(err, "Failed to fetch profile"));
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.user_metadata?.persona_type, userProfile?.persona_type, userProfile?.coach_id, userProfile?.athlete_id, authLoading]);

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
          "id, user_id, full_name, date_of_birth, sport, position, phone_number, location, tags, pathway_tags, profile_image_url, cover_image_urls, bio, profile_completed, created_at, updated_at, instagram_handle, graduation_year, current_year, high_school, gpa, height, weight, dominant_hand"
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
      setProfile(newProfile);
      return athleteProfile;
    },
    [user]
  );

  const refetchProfile = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (!authLoading && user?.id) {
      fetchProfile();
    } else if (!authLoading && !user?.id) {
      setProfile(defaultProfileState);
      setLoading(false);
    }
  }, [user?.id, authLoading, fetchProfile]);

  useEffect(() => {
    if (userProfile && user?.id) {
      setProfile((prev) => ({ ...prev, userProfile }));
    }
  }, [userProfile?.image_url, userProfile?.zip_code, userProfile?.gender, user?.id]);

  const profileProgress = useMemo(
    () =>
      user && profile.data
        ? calculateProfileProgress(profile.data as ProfileData)
        : DEFAULT_PROFILE_PROGRESS,
    [user, profile.data]
  );

  return (
    <ProfileContext.Provider
      value={{
        profile,
        profileProgress,
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
