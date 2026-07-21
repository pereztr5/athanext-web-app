import { useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getSportPillars, setSportPillars, type SPORTPILLARS, type CoachSportPillarLink } from '@/api/sport-pillars';
import type { Enums } from '@/integrations/supabase/types';

interface UseSportPillarsOptions {
  sport?: Enums<'sport_type'>;
  autoFetch?: boolean;
}

interface UseSportPillarsReturn {
  sportPillars: SPORTPILLARS[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  linkPillarsToCoach: (coachId: string, sport: Enums<'sport_type'>, pillarIds: string[]) => Promise<{
    success: boolean;
    data?: CoachSportPillarLink[];
    error?: string;
  }>;
  isLinking: boolean;
}

interface SportPillarsResult {
  sportPillars: SPORTPILLARS[];
  total: number;
}

/**
 * Custom hook to fetch and manage sport pillars
 *
 * @example
 * const { sportPillars, loading, error, refetch } = useSportPillars({ sport: 'soccer' });
 * @example
 * const { sportPillars, loading, refetch } = useSportPillars({ autoFetch: false });
 * @example
 * const { linkPillarsToCoach, isLinking } = useSportPillars({ sport: 'soccer' });
 */
export function useSportPillars(options: UseSportPillarsOptions = {}): UseSportPillarsReturn {
  const { sport, autoFetch = true } = options;

  const query = useQuery<SportPillarsResult>({
    queryKey: ['sport-pillars', sport ?? null],
    queryFn: async () => {
      const response = await getSportPillars((sport ?? null) as any);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data ?? { sportPillars: [], total: 0 };
    },
    enabled: autoFetch,
    staleTime: Infinity,
  });

  const linkMutation = useMutation({
    mutationFn: async (vars: { coachId: string; sportType: Enums<'sport_type'>; pillarIds: string[] }) => {
      const response = await setSportPillars(vars.coachId, vars.sportType, vars.pillarIds);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
  });

  const linkPillarsToCoach = useCallback(async (
    coachId: string,
    sportType: Enums<'sport_type'>,
    pillarIds: string[]
  ) => {
    try {
      const data = await linkMutation.mutateAsync({ coachId, sportType, pillarIds });
      return { success: true, data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to link sport pillars';
      return { success: false, error: errorMessage };
    }
  }, [linkMutation]);

  return {
    sportPillars: query.data?.sportPillars ?? [],
    total: query.data?.total ?? 0,
    loading: query.isLoading,
    error: query.error ? query.error.message : null,
    refetch: () => { query.refetch(); },
    linkPillarsToCoach,
    isLinking: linkMutation.isPending,
  };
}
