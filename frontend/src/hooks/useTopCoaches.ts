import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type PublicCoach = Omit<Tables<"coaches">, "email"> & {
  is_verified?: boolean;
};

export const useTopCoaches = (limit: number = 3) => {
  const [coaches, setCoaches] = useState<PublicCoach[]>([]);
  const [coachesLoading, setCoachesLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchTopCoaches = async () => {
      try {
        setCoachesLoading(true);

        const { data, error } = await supabase.rpc("get_coaches_public");

        if (error) throw error;
        if (!isMounted) return;

        const topCoaches = (data ?? [])
          .map((coach) => ({
            ...coach,
            position: coach.coach_position ?? null,
          }))
          .filter((coach) => coach.is_verified && coach.status === "active")
          .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
          .slice(0, limit);

        setCoaches(topCoaches as PublicCoach[]);
      } catch (error) {
        if (!isMounted) return;
        setCoaches([]);
        console.error("Failed to load top coaches:", error);
      } finally {
        if (isMounted) {
          setCoachesLoading(false);
        }
      }
    };

    void fetchTopCoaches();

    return () => {
      isMounted = false;
    };
  }, [limit]);

  return { coaches, coachesLoading };
};
