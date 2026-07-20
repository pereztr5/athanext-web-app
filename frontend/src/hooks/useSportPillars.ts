import { useState, useEffect, useCallback } from 'react';
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
  refetch: () => Promise<void>;
  linkPillarsToCoach: (coachId: string, sport: Enums<'sport_type'>, pillarIds: string[]) => Promise<{
    success: boolean;
    data?: CoachSportPillarLink[];
    error?: string;
  }>;
  isLinking: boolean;
}

/**
 * Custom hook to fetch and manage sport pillars
 * 
 * @example
 * // Fetch sport pillars for a specific sport
 * const { sportPillars, loading, error, refetch } = useSportPillars({ sport: 'soccer' });
 * 
 * @example
 * // Manual fetch
 * const { sportPillars, loading, refetch } = useSportPillars({ autoFetch: false });
 * // Later...
 * refetch();
 * 
 * @example
 * // Link pillars to a coach
 * const { linkPillarsToCoach, isLinking } = useSportPillars({ sport: 'soccer' });
 * const result = await linkPillarsToCoach(coachId, 'soccer', [pillarId1, pillarId2]);
 */
export function useSportPillars(options: UseSportPillarsOptions = {}): UseSportPillarsReturn {
  const { sport, autoFetch = true } = options;

  const [sportPillars, setSportPillarsState] = useState<SPORTPILLARS[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);

  const fetchSportPillars = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getSportPillars((sport ?? null) as any);

      if (response.error) {
        setError(response.error.message);
        setSportPillarsState([]);
        setTotal(0);
      } else if (response.data) {
        setSportPillarsState(response.data.sportPillars);
        setTotal(response.data.total);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch sport pillars';
      setError(errorMessage);
      setSportPillarsState([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [sport]);

  const linkPillarsToCoach = useCallback(async (
    coachId: string,
    sportType: Enums<'sport_type'>,
    pillarIds: string[]
  ) => {
    setIsLinking(true);

    try {
      const response = await setSportPillars(coachId, sportType, pillarIds);

      if (response.error) {
        return {
          success: false,
          error: response.error.message,
        };
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to link sport pillars';
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsLinking(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchSportPillars();
    }
  }, [autoFetch, fetchSportPillars]);

  return {
    sportPillars,
    total,
    loading,
    error,
    refetch: fetchSportPillars,
    linkPillarsToCoach,
    isLinking,
  };
}
