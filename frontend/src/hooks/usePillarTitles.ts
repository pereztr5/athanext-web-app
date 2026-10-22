import { useQuery } from "@tanstack/react-query";
import { getSportPillars, type SportPillarsResponse } from "@/api/sport-pillars";
import { pillarSportKey, pillarTitles } from "@/utils/sessionPillars";

/**
 * The pillar titles for a sport from sport_pillars (same cache as useSportPillars), with the
 * built-in list while loading or offline. Sign up and the session tag picker use this.
 */
export const usePillarTitles = (sport: string | null | undefined) => {
  const key = pillarSportKey(sport);
  const query = useQuery<SportPillarsResponse>({
    queryKey: ["sport-pillars", key],
    queryFn: async () => {
      const response = await getSportPillars(key);
      if (response.error) throw new Error(response.error.message);
      return response.data ?? { sportPillars: [], total: 0 };
    },
    staleTime: Infinity,
    retry: 1,
  });
  return pillarTitles(sport, query.data?.sportPillars.map((p) => p.title));
};
