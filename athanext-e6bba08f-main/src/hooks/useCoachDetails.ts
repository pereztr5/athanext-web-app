import { useState, useEffect } from "react";
import { coachesAPI } from "@/api";
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

// Cache for coach details to prevent duplicate fetches
const coachCache = new Map<string, CoachDetails>();
const fetchPromises = new Map<string, Promise<void>>();

// Export function to clear cache
export const clearCoachCache = () => {
  coachCache.clear();
  fetchPromises.clear();
};

export const useCoachDetails = (
  coachId: string,
  refetchTrigger: number = 0
) => {
  const [coach, setCoach] = useState<CoachDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCoachDetails = async () => {
      if (!coachId) {
        setLoading(false);
        return;
      }

      // Check cache first
      const cached = coachCache.get(coachId);
      if (cached) {
        setCoach(cached);
        setLoading(false);
        return;
      }

      // Check if already fetching
      const existingPromise = fetchPromises.get(coachId);
      if (existingPromise) {
        await existingPromise;
        const cachedAfterWait = coachCache.get(coachId);
        if (cachedAfterWait) {
          setCoach(cachedAfterWait);
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch coach basic info with user_profiles join to get sport, gender, and zip_code
        const { data: coachData, error: coachError } = await supabase
          .from("coaches")
          .select(
            `
            *,
            user_profiles!user_profiles_coach_id_fkey (
              sport,
              gender,
              zip_code
            )
          `
          )
          .eq("id", coachId)
          .single();
          
        if (coachError || !coachData) {
          throw new Error(coachError?.message || "Coach not found");
        }

        // Fetch certifications
        const { data: certifications, error: certError } = await supabase
          .from("coach_certifications")
          .select(
            "id, certification_name, issuing_organization, issue_date, expiry_date"
          )
          .eq("coach_id", coachId)
          .order("issue_date", { ascending: false });

        if (certError) throw certError;

        // Fetch achievements
        const { data: achievements, error: achieveError } = await supabase
          .from("coach_achievements")
          .select("id, title, description, year")
          .eq("coach_id", coachId)
          .order("year", { ascending: false });

        if (achieveError) throw achieveError;

        const coachDetails = {
          ...coachData,
          sport: Array.isArray(coachData.user_profiles) && coachData.user_profiles.length > 0 
            ? (coachData.user_profiles[0] as any)?.sport 
            : null, // Extract sport from user_profiles
          gender: Array.isArray(coachData.user_profiles) && coachData.user_profiles.length > 0 
            ? (coachData.user_profiles[0] as any)?.gender 
            : null, // Extract gender from user_profiles
          zip_code: Array.isArray(coachData.user_profiles) && coachData.user_profiles.length > 0 
            ? (coachData.user_profiles[0] as any)?.zip_code 
            : null, // Extract zip_code from user_profiles
          certifications: certifications || [],
          achievements: achievements || [],
        };

        // Store in cache
        coachCache.set(coachId, coachDetails);
        setCoach(coachDetails);
      } catch (err) {
        console.error("Error fetching coach details:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch coach details"
        );
      } finally {
        fetchPromises.delete(coachId);
        setLoading(false);
      }
    };

    const promise = fetchCoachDetails();
    fetchPromises.set(coachId, promise);
  }, [coachId, refetchTrigger]);

  return { coach, loading, error };
};
