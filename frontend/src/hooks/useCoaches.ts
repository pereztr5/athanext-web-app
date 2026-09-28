import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

// Public coach type without email for privacy.
// get_coaches_public does not return profile_faqs / slug the same way as the table row.
export type PublicCoach = Omit<Tables<"coaches">, "email" | "slug" | "profile_faqs"> & {
  is_verified?: boolean;
  zip_code?: string | null;
  pathway_tags?: string[];
  slug?: string | null;
  position?: string | null;
  profile_faqs?: Tables<"coaches">["profile_faqs"];
};

export const useCoaches = () => {
  const query = useQuery<PublicCoach[]>({
    queryKey: ["coaches"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc("get_coaches_public");
        if (error) throw error;

        const mappedCoaches = (data ?? []).map((coach) => ({
          ...coach,
          position: coach.coach_position ?? null,
        }));

        return mappedCoaches as PublicCoach[];
      } catch (error) {
        console.error("Failed to initialize coaches:", error);
        return [];
      }
    },
  });

  return { coaches: query.data ?? [], coachesLoading: query.isLoading };
};
