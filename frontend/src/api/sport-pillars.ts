import type { ApiResponse, ApiError } from './client';
import { supabase } from '@/integrations/supabase/client';
import type { Enums } from '@/integrations/supabase/types';

/**
 * Sport Pillars table definition
 */
export interface SPORTPILLARS {
  id: string;
  sport: Enums<'sport_type'> | null;
  icon: string | null;
  title: string | null;
  description: string | null;
  created_at: string;
}

export interface SportPillarsResponse {
  sportPillars: SPORTPILLARS[];
  total: number;
}

export interface CoachSportPillarLink {
  coach_id: string;
  sport_pillar_id: string;
  sport: Enums<'sport_type'> | null;
  created_at?: string;
}

const buildApiError = (code: string, message: string, status = 500, originalError?: unknown): ApiError => ({
  code,
  message,
  status,
  originalError,
});

/**
 * Fetch sport pillars by sport type (e.g., soccer, rowing)
 */
export async function getSportPillars(sport: Enums<'sport_type'>): Promise<ApiResponse<SportPillarsResponse>> {
  try {
    const normalizedSport = sport?.toLowerCase?.() as Enums<'sport_type'>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supa = supabase as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseQuery = supa
      .from('sport_pillars')
      .select('*')
      .order('created_at', { ascending: true })

    const result = normalizedSport
      ? await baseQuery.eq('sport', normalizedSport)
      : await baseQuery;

    if (result?.error) {
      throw result.error;
    }

    if (result && !result.error && Array.isArray(result.data)) {
      return {
        data: {
          sportPillars: result.data,
          total: result.data.length,
        },
        error: null,
      };
    }

    const apiError = result?.error
      ? buildApiError(
          result.error.code || 'SPORT_PILLARS_FETCH_ERROR',
          result.error.message || 'Failed to fetch sport pillars',
          result.error.status || 500
        )
      : buildApiError('SPORT_PILLARS_FETCH_ERROR', 'Failed to fetch sport pillars');

    console.warn('[Sport Pillars API] Using empty result due to error or missing data', apiError);

    return {
      data: {
        sportPillars: [],
        total: 0,
      },
      error: apiError,
    };
  } catch (error) {
    console.error('[Sport Pillars API] Unexpected error fetching sport pillars:', error);
    return {
      data: {
        sportPillars: [],
        total: 0,
      },
      error: buildApiError('SPORT_PILLARS_FETCH_ERROR', 'Failed to fetch sport pillars', 500, error),
    };
  }
}

/**
 * Link selected sport pillars to a coach (signup flow)
 * Replaces existing links for the coach+sport to keep data in sync with selections
 */
export async function setSportPillars(
  coachId: string,
  sport: Enums<'sport_type'>,
  sportPillarIds: string[]
): Promise<ApiResponse<CoachSportPillarLink[]>> {
  try {
    // Clear any previous selections for this coach and sport to avoid duplicates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deleteResult = await (supabase as any)
      .from('coach_sport_pillars')
      .delete()
      .eq('coach_id', coachId)
      .eq('sport', sport);

    if (deleteResult?.error) {
      return {
        data: [],
        error: buildApiError(
          deleteResult.error.code || 'SPORT_PILLAR_SET_ERROR',
          deleteResult.error.message || 'Failed to reset existing sport pillar links',
          deleteResult.error.status || 500
        ),
      };
    }

    if (!sportPillarIds.length) {
      return {
        data: [],
        error: null,
      };
    }

    const payload = sportPillarIds.map((pillarId) => ({
      coach_id: coachId,
      sport_pillar_id: pillarId,
      sport,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertResult = await (supabase as any)
      .from('coach_sport_pillars')
      .insert(payload)
      .select('*');

    if (insertResult && !insertResult.error && Array.isArray(insertResult.data)) {
      return {
        data: insertResult.data as CoachSportPillarLink[],
        error: null,
      };
    }

    const apiError = insertResult?.error
      ? buildApiError(
          insertResult.error.code || 'SPORT_PILLAR_SET_ERROR',
          insertResult.error.message || 'Failed to set sport pillars for coach',
          insertResult.error.status || 500
        )
      : buildApiError('SPORT_PILLAR_SET_ERROR', 'Failed to set sport pillars for coach');

    return {
      data: [],
      error: apiError,
    };
  } catch (error) {
    console.error('[Sport Pillars API] Error linking sport pillars to coach:', error);
    return {
      data: [],
      error: buildApiError('SPORT_PILLAR_SET_ERROR', 'Failed to set sport pillars for coach', 500, error),
    };
  }
}
