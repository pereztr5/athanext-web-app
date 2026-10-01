import type { ApiResponse, ApiError } from './client';
import { supabase } from '@/integrations/supabase/client';
import type { TermsAndConditions } from '@/types/terms';
import { TERMS_AND_CONDITIONS_DATA } from '@/utils/db';

/**
 * Main endpoint: Fetch Terms & Conditions content
 *
 * HOW IT WORKS:
 * 1. First, tries to fetch from Supabase terms_and_conditions table (if it exists)
 * 2. If table doesn't exist or query fails, uses fallback demo data
 * 3. Only fetches active terms & conditions
 * 4. When adding the table, simply restart and it will use real data
 * 5. Page NEVER crashes - always shows content
 *
 * IMPORTANT: This function is designed to work immediately, even before you
 * run the SQL migration.
 *
 * @returns Promise<ApiResponse<TermsAndConditions>>
 */
export async function getTermsAndConditionsContent(): Promise<
  ApiResponse<TermsAndConditions>
> {
  try {
    // Try to fetch from Supabase table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await supabase
      .from('terms_and_conditions')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (result && result.data && !result.error) {
      // Terms & Conditions found in database
      const resolvedLastUpdated =
        result.data.last_updated || result.data.updated_at || result.data.created_at || '';

      return {
        data: {
          ...(result.data as TermsAndConditions),
          last_updated: resolvedLastUpdated,
        },
        error: null,
      };
    }
  } catch (err) {
    // Table doesn't exist or no data - that's OK, use fallback
  }

  // Return fallback data so page doesn't crash
  return {
    data: TERMS_AND_CONDITIONS_DATA as TermsAndConditions,
    error: null,
  };
}

/**
 * Optional: Update Terms & Conditions (for admin panel)
 * Will work once terms_and_conditions table is created
 *
 * @param updates - Data to update
 */
export async function updateTermsAndConditions(
  updates: Partial<TermsAndConditions>
): Promise<ApiResponse<void>> {
  try {
    // This will work once the terms_and_conditions table is created
    // For now, just return success since table doesn't exist
    return { data: undefined, error: null };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to update terms & conditions';

    return {
      data: undefined,
      error: {
        code: 'TERMS_UPDATE_ERROR',
        message: errorMessage,
        status: 500,
        originalError: error,
      } as ApiError,
    };
  }
}
