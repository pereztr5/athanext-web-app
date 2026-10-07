import { useQuery } from "@tanstack/react-query";
import { useProfile } from "@/contexts/ProfileContext";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";

/** "app" when families pay in AthaNext, "self" in booking only mode (ATH-86). */
export const useCoachPayMode = () => {
  const { isCoach } = useRole();
  const { profile } = useProfile();
  const coachId = profile?.userProfile?.coach_id ?? undefined;
  return useQuery({
    queryKey: ["coach-pay-mode", coachId],
    enabled: isCoach && Boolean(coachId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("coaches").select("pay_mode").eq("id", coachId!).maybeSingle();
      if (error) throw error;
      return data?.pay_mode === "self" ? ("self" as const) : ("app" as const);
    },
  });
};
