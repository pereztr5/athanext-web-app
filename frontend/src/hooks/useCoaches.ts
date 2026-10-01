import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables } from "@/integrations/supabase/types";

// Public coach row as returned by get_coaches_public (no email or private columns).
// The RPC exposes the coaches.position column as coach_position.
export type PublicCoach = Database["public"]["Functions"]["get_coaches_public"]["Returns"][number] & {
  position?: string | null;
  slug?: string | null;
  profile_faqs?: Tables<"coaches">["profile_faqs"];
};

export const useCoaches = (enabled: boolean = true) => {
  const query = useQuery<PublicCoach[]>({
    queryKey: ["coaches"],
    enabled,
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
