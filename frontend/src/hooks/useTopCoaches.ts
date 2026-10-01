import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PublicCoach } from "@/hooks/useCoaches";

export type { PublicCoach };

export const useTopCoaches = (limit: number = 3) => {
  const query = useQuery<PublicCoach[]>({
    queryKey: ["top-coaches", limit],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc("get_coaches_public");

        if (error) throw error;

        const topCoaches = (data ?? [])
          .map((coach) => ({
            ...coach,
            position: coach.coach_position ?? null,
          }))
          .filter((coach) => coach.is_verified && coach.status === "active")
          .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
          .slice(0, limit);

        return topCoaches as PublicCoach[];
      } catch (error) {
        console.error("Failed to load top coaches:", error);
        return [];
      }
    },
  });

  return { coaches: query.data ?? [], coachesLoading: query.isLoading };
};
