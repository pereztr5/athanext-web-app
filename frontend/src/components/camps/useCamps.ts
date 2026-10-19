import { useQuery } from "@tanstack/react-query";
import { packagesAPI } from "@/api/packages";

export const useCamps = (coachId: string | undefined, includeInactive = false) =>
  useQuery({
    queryKey: ["coach-camps", coachId, includeInactive],
    enabled: Boolean(coachId),
    queryFn: async () => {
      const res = await packagesAPI.listCamps(coachId as string, { includeInactive });
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
  });

export const useCampTeammates = (enabled: boolean) =>
  useQuery({
    queryKey: ["camp-teammates"],
    enabled,
    queryFn: async () => {
      const res = await packagesAPI.listCampTeammates();
      if (res.error) throw new Error(res.error.message);
      return res.data ?? { coaches: [], unavailable: false };
    },
  });
