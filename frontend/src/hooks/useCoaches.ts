import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

// Public coach type without email for privacy
export type PublicCoach = Omit<Tables<"coaches">, "email"> & {
  is_verified?: boolean;
};

export const useCoaches = () => {
  const [coaches, setCoaches] = useState<PublicCoach[]>([]);
  const [coachesLoading, setCoachesLoading] = useState(true);

  useEffect(() => {
    initializeCoaches();
  }, []);

  const initializeCoaches = async () => {
    try {
      setCoachesLoading(true);
      const { data, error } = await supabase.rpc("get_coaches_public");
      if (error) throw error;

      const mappedCoaches = (data ?? []).map((coach) => ({
        ...coach,
        position: coach.coach_position ?? null,
      }));

      setCoaches(mappedCoaches as PublicCoach[]);
    } catch (error) {
      setCoaches([]);
      console.error("Failed to initialize coaches:", error);
    } finally {
      setCoachesLoading(false);
    }
  };

  return { coaches, coachesLoading };
};
