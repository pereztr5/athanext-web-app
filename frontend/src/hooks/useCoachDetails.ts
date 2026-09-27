import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export interface CoachCertification {
  id: string;
  certification_name: string;
  issuing_organization?: string;
  issue_date?: string;
  expiry_date?: string;
}

export interface CoachAchievement {
  id: string;
  title: string;
  description?: string;
  year?: number;
}

// Public coach details without email for privacy
export type PublicCoach = Omit<Tables<"coaches">, "email">;

export interface CoachDetails extends PublicCoach {
  certifications?: CoachCertification[];
  achievements?: CoachAchievement[];
  position?: string | null;
  is_verified?: boolean;
  cover_image_urls?: string[];
  sport?: string | null;
  gender?: string | null;
  zip_code?: string | null;
}

export const useCoachDetails = (coachId: string | undefined) => {
  const query = useQuery<CoachDetails>({
    queryKey: ["coach-details", coachId],
    queryFn: async () => {
      // Fetch coach basic info with user_profiles join to get sport, gender, and zip_code
      const { data: coachData, error: coachError } = await supabase
        .from("coaches")
        .select(
          `
          *,
          user_profiles!user_profiles_coach_id_fkey (
            id,
            sport,
            gender,
            zip_code
          )
        `
        )
        .eq("id", coachId as string)
        .single();

      if (coachError || !coachData) {
        throw new Error(coachError?.message || "Coach not found");
      }

      if (coachData.status === "hidden") {
        const { data: authData } = await supabase.auth.getUser();
        const profiles = Array.isArray(coachData.user_profiles) ? coachData.user_profiles : [];
        const isOwner = profiles.some((profile) => profile.id === authData.user?.id);
        if (!isOwner) {
          throw new Error("Coach not found");
        }
      }

      // Fetch certifications
      const { data: certifications, error: certError } = await supabase
        .from("coach_certifications")
        .select(
          "id, certification_name, issuing_organization, issue_date, expiry_date"
        )
        .eq("coach_id", coachId as string)
        .order("issue_date", { ascending: false });

      if (certError) throw certError;

      // Fetch achievements
      const { data: achievements, error: achieveError } = await supabase
        .from("coach_achievements")
        .select("id, title, description, year")
        .eq("coach_id", coachId as string)
        .order("year", { ascending: false });

      if (achieveError) throw achieveError;

      const userProfile =
        Array.isArray(coachData.user_profiles) && coachData.user_profiles.length > 0
          ? (coachData.user_profiles[0] as any)
          : null;

      return {
        ...coachData,
        sport: userProfile?.sport ?? null,
        gender: userProfile?.gender ?? null,
        zip_code: userProfile?.zip_code ?? null,
        certifications: certifications || [],
        achievements: achievements || [],
      } as CoachDetails;
    },
    enabled: !!coachId,
  });

  return {
    coach: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? query.error.message : null,
  };
};
