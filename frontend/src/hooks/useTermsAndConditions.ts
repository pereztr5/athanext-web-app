import { useEffect, useState } from 'react';
import { getTermsAndConditionsContent } from '@/api/terms';
import type { TermsAndConditions } from '@/types/terms';

interface UseTermsAndConditionsReturn {
  termsAndConditions: TermsAndConditions | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook for fetching and managing Terms & Conditions data
 * Handles loading, error, and empty states automatically
 *
 * @returns Object with terms, loading state, error, and refetch function
 */
export function useTermsAndConditions(): UseTermsAndConditionsReturn {
  const [termsAndConditions, setTermsAndConditions] = useState<TermsAndConditions | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTerms = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await getTermsAndConditionsContent();

      if (response.error) {
        setError(response.error.message);
        console.error('[Terms Hook] Error:', response.error);
      } else if (response.data) {
        setTermsAndConditions(response.data);
      } else {
        setError('No terms & conditions available');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch terms';
      setError(message);
      console.error('[Terms Hook] Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTerms();
  }, []);

  const refetch = async () => {
    await fetchTerms();
  };

  return {
    termsAndConditions,
    loading,
    error,
    refetch,
  };
}
