import { useQuery } from "@tanstack/react-query";
import { packagesAPI } from "@/api";

export interface CoachPackage {
  id: string;
  coach_id: string;
  package_name: string;
  description: string | null;
  session_count: number;
  duration_minutes: number;
  total_price: number;
  price_per_session: number;
  validity_days: number;
  features: string[];
  is_active: boolean;
  display_order: number;
}

export const useCoachPackages = (coachId: string | undefined) => {
  return useQuery({
    queryKey: ["coach-packages", coachId],
    queryFn: async () => {
      if (!coachId) return [];

      const response = await packagesAPI.getCoachPackages(coachId);
      
      if (response.error) {
        throw response.error;
      }

      return response.data as CoachPackage[] || [];
    },
    enabled: !!coachId,
  });
};
