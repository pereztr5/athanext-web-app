/**
 * useMySessions Hook
 * React Query hook for managing user sessions with caching and refetching
 */

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getMySessions, cancelSession } from '@/api/sessions';
import type { SessionUIModel, SessionGrouped, SessionFilters } from '@/types/sessions-api';
import { useMemo, useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useViewerTimeZone } from '@/hooks/useViewerTimeZone';
import { isoDateInZone } from '@/utils/viewerTime';

/**
 * Query key factory for sessions
 */
const SESSIONS_QUERY_KEYS = {
  all: ['sessions'] as const,
  my: ['sessions', 'my'] as const,
  coach: (coachId: string) => ['sessions', 'coach', coachId] as const,
  athlete: (athleteId: string) => ['sessions', 'athlete', athleteId] as const,
} as const;

/**
 * Hook to fetch and manage user sessions from coach_slot_bookings
 * Only issues a single query based on the resolved persona role.
 */
export const useMySessions = (userRole?: 'coach' | 'athlete') => {
  const { user, userProfile } = useAuth();
  const timeZone = useViewerTimeZone();
  const userMetadata = user?.user_metadata as Record<string, unknown> | undefined;

  const coachId = userProfile?.coach_id ?? (userMetadata?.coach_id as string | undefined);
  const rawAthleteId = userProfile?.athlete_id ?? (userMetadata?.athlete_id as string | undefined);
  const athleteId = rawAthleteId && rawAthleteId !== user?.id ? rawAthleteId : userProfile?.athlete_id;
  const baseRole: 'coach' | 'athlete' | undefined =
    userRole ?? (coachId ? 'coach' : athleteId ? 'athlete' : undefined);
  const basePersonaId = baseRole === 'coach' ? coachId : baseRole === 'athlete' ? athleteId : undefined;
  const [resolvedRole, setResolvedRole] = useState<typeof baseRole>(baseRole);
  const [personaId, setPersonaId] = useState<string | undefined>(basePersonaId);
  const queryClient = useQueryClient();

  useEffect(() => {
    setResolvedRole(baseRole);
    setPersonaId(basePersonaId);
  }, [baseRole, basePersonaId]);

  useEffect(() => {
    const fetchAthleteId = async () => {
      if (personaId || (!resolvedRole && coachId) || (resolvedRole && resolvedRole !== 'athlete') || !user?.id) return;
      const { data, error } = await supabase
        .from('athlete_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) {
        console.warn('useMySessions: failed to resolve athlete_id via athlete_profiles', error);
        return;
      }
      if ((data as any)?.id) {
        setPersonaId((data as any).id);
        if (!resolvedRole) {
          setResolvedRole('athlete');
        }
      }
    };
    fetchAthleteId();
  }, [resolvedRole, personaId, user?.id, coachId]);

  const queryKey = resolvedRole === 'coach'
    ? SESSIONS_QUERY_KEYS.coach(personaId || '')
    : resolvedRole === 'athlete'
      ? SESSIONS_QUERY_KEYS.athlete(personaId || '')
      : SESSIONS_QUERY_KEYS.my;

  // Fetch sessions
  const {
    data: sessions = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => {
      if (!personaId || !resolvedRole) return Promise.resolve([]);
      return getMySessions(personaId, resolvedRole).then((res) => res.data || []);
    },
    enabled: Boolean(personaId && resolvedRole),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
  });

  // Cancel session mutation
  const { mutate: cancelSessionMutation, isPending: isCanceling } = useMutation({
    mutationFn: (payload: { sessionId: string; reason?: string }) =>
      cancelSession(payload.sessionId, payload.reason),
    onSuccess: () => {
      // Invalidate and refetch
      if (!personaId || !resolvedRole) return;
      queryClient.invalidateQueries({
        queryKey,
      });
    },
  });

  // Group sessions by computed status
  const grouped: SessionGrouped = useMemo(() => {
    return {
      inProgress: sessions.filter((s) => s.computedStatus === 'in-progress'),
      upcoming: sessions.filter((s) => s.computedStatus === 'upcoming'),
      past: sessions.filter((s) => s.computedStatus === 'past'),
      completed: sessions.filter((s) => s.computedStatus === 'completed'),
      canceled: sessions.filter((s) => s.computedStatus === 'canceled'),
    };
  }, [sessions]);

  // Filter sessions
  const filterSessions = useCallback(
    (filters: SessionFilters): SessionUIModel[] => {
      return sessions.filter((session) => {
        // Search filter
        if (filters.search) {
          const searchTerm = filters.search.toLowerCase();
          const athleteNames = session.athleteNames || [];
          const matchesSearch =
            session.title.toLowerCase().includes(searchTerm) ||
            session.location.toLowerCase().includes(searchTerm) ||
            (session.pillarSlot || '').toLowerCase().includes(searchTerm) ||
            (session.coachName || '').toLowerCase().includes(searchTerm) ||
            (session.athleteNamesDisplay || '').toLowerCase().includes(searchTerm) ||
            athleteNames.some((name) => name.toLowerCase().includes(searchTerm));
          if (!matchesSearch) return false;
        }

        // Date filter
        // Cards show the viewer's calendar day, so filter on it too (ATH-22).
        if (filters.date) {
          if (isoDateInZone(new Date(session.start), timeZone) !== filters.date) return false;
        }

        // Session type filter
        if (filters.type && filters.type !== 'all') {
          if (session.type !== filters.type) return false;
        }

        // Status filter
        if (filters.status && filters.status !== 'all') {
          if (session.computedStatus !== filters.status) return false;
        }

        // Location type filter
        if (filters.locationType && filters.locationType !== 'all') {
          if (session.location !== filters.locationType) return false;
        }

        // Pillar filter
        if (filters.pillar && filters.pillar !== 'all') {
          if (session.pillarSlot !== filters.pillar) return false;
        }

        return true;
      });
    },
    [sessions, timeZone]
  );

  return {
    sessions,
    grouped,
    isLoading,
    error: error instanceof Error ? error.message : null,
    refetch,
    filterSessions,
    cancelSession: cancelSessionMutation,
    isCanceling,
  };
};

/**
 * Hook to get sessions grouped and filtered
 */
export const useMySessionsGrouped = (userRole: 'coach' | 'athlete', filters?: SessionFilters) => {
  const { sessions, grouped, isLoading, error, filterSessions, refetch } =
    useMySessions(userRole);

  const filtered = useMemo(() => {
    if (!filters) return grouped;

    const filteredSessions = filterSessions(filters);
    return {
      inProgress: filteredSessions.filter((s) => s.computedStatus === 'in-progress'),
      upcoming: filteredSessions.filter((s) => s.computedStatus === 'upcoming'),
      past: filteredSessions.filter((s) => s.computedStatus === 'past'),
      completed: filteredSessions.filter((s) => s.computedStatus === 'completed'),
      canceled: filteredSessions.filter((s) => s.computedStatus === 'canceled'),
    };
  }, [grouped, filters, filterSessions]);

  return {
    ...filtered,
    isLoading,
    error,
    refetch,
    totalCount: sessions.length,
  };
};

/**
 * Utility to invalidate all session queries
 */
export const invalidateAllSessionQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({
    queryKey: SESSIONS_QUERY_KEYS.all,
  });
};
