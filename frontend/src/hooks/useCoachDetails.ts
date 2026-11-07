import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { resolveCoachId } from "@/api/coachShare";
import { normalizeCoachFaqs } from "@/components/coach-profile/FAQSection";

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

export type PublicCoach = Omit<Tables<"coaches">, "email" | "profile_faqs"> & {
  slug?: string | null;
  zip_code?: string | null;
  profile_faqs?: Tables<"coaches">["profile_faqs"] | null;
};

export type CoachDetails = Omit<PublicCoach, "profile_faqs" | "is_verified" | "cover_image_urls"> & {
  certifications?: CoachCertification[];
  achievements?: CoachAchievement[];
  position?: string | null;
  /** Only set when the coach came from get_coaches_public; the table column is position. */
  coach_position?: string | null;
  is_verified?: boolean | null;
  cover_image_urls?: string[] | null;
  sport?: string | null;
  gender?: string | null;
  zip_code?: string | null;
  slug: string;
  favourite_positions?: string[] | null;
  profile_faqs?: { id: string; question: string; answer: string }[] | null;
};

/** A hidden coach seen by someone other than its owner; retrying won't change it. */
export class CoachNotFoundError extends Error {
  constructor() {
    super("Coach not found");
    this.name = "CoachNotFoundError";
  }
}

export const useCoachDetails = (coachKey: string | undefined) => {
  // null = no coach has this slug or id. That's an answer, not an error: it isn't retried, and a
  // remount (e.g. the app shell taking over once auth settles) doesn't drop back to loading.
  const query = useQuery<CoachDetails | null>({
    queryKey: ["coach-details", coachKey],
    queryFn: async () => {
      const resolvedId = await resolveCoachId(coachKey as string);
      if (!resolvedId) return null;

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
        .eq("id", resolvedId)
        .single();

      // PGRST116: .single() matched no row.
      if (coachError?.code === "PGRST116" || (!coachError && !coachData)) return null;
      if (coachError) throw new Error(coachError.message);

      if (coachData.status === "hidden") {
        const { data: authData } = await supabase.auth.getUser();
        const profiles = Array.isArray(coachData.user_profiles) ? coachData.user_profiles : [];
        const isOwner = profiles.some((profile) => profile.id === authData.user?.id);
        if (!isOwner) {
          throw new CoachNotFoundError();
        }
      }

      // Fetch certifications
      const { data: certifications, error: certError } = await supabase
        .from("coach_certifications")
        .select(
          "id, certification_name, issuing_organization, issue_date, expiry_date"
        )
        .eq("coach_id", resolvedId)
        .order("issue_date", { ascending: false });

      if (certError) throw certError;

      // Fetch achievements
      const { data: achievements, error: achieveError } = await supabase
        .from("coach_achievements")
        .select("id, title, description, year")
        .eq("coach_id", resolvedId)
        .order("year", { ascending: false });

      if (achieveError) throw achieveError;

      const userProfile =
        Array.isArray(coachData.user_profiles) && coachData.user_profiles.length > 0
          ? (coachData.user_profiles[0] as any)
          : null;

      const slug = (coachData as { slug?: string | null }).slug;
      if (!slug) return null;

      return {
        ...coachData,
        slug,
        sport: userProfile?.sport ?? null,
        gender: userProfile?.gender ?? null,
        zip_code: userProfile?.zip_code ?? null,
        certifications: certifications || [],
        achievements: achievements || [],
        profile_faqs: normalizeCoachFaqs(
          (coachData as { profile_faqs?: unknown }).profile_faqs
        ),
      } as unknown as CoachDetails;
    },
    enabled: !!coachKey,
    // A hidden coach stays hidden for this viewer: show "Coach not found" at once, not after 3 retries.
    retry: (failureCount, err) => !(err instanceof CoachNotFoundError) && failureCount < 3,
  });

  return {
    coach: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? query.error.message : null,
  };
};
