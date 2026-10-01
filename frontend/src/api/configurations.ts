import type { ApiResponse, ApiError } from './client';
import { supabase } from '@/integrations/supabase/client';

const buildApiError = (
  code: string,
  message: string,
  status = 500,
  originalError?: unknown
): ApiError => ({
  code,
  message,
  status,
  originalError,
});

export async function getConfigurationValue(
  key: string
): Promise<ApiResponse<string | null>> {
  try {
    const { data, error } = await supabase
      .from('configurations')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error) {
      return {
        data: null,
        error: buildApiError(
          'FETCH_CONFIGURATION_ERROR',
          error.message,
          (error as any).status ?? 500,
          error
        ),
      };
    }

    return {
      data: ((data as any)?.value as string | null) ?? null,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch configuration';
    return {
      data: null,
      error: buildApiError('FETCH_CONFIGURATION_ERROR', message, 500, err),
    };
  }
}

export async function getNumericConfiguration(
  key: string
): Promise<ApiResponse<number | null>> {
  const { data, error } = await getConfigurationValue(key);

  if (error) {
    return { data: null, error };
  }

  const parsed = Number.parseFloat(data ?? '');
  if (Number.isFinite(parsed)) {
    return { data: parsed, error: null };
  }

  return { data: null, error: null };
}

export async function getDefaultGroupCapacity(): Promise<ApiResponse<number | null>> {
  return getNumericConfiguration('default_max_bookings_group');
}
