import { useQuery } from '@tanstack/react-query';
import { getTermsAndConditionsContent } from '@/api/terms';
import type { TermsAndConditions } from '@/types/terms';

interface UseTermsAndConditionsReturn {
  termsAndConditions: TermsAndConditions | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Custom hook for fetching and managing Terms & Conditions data
 * Handles loading, error, and empty states automatically
 *
 * @returns Object with terms, loading state, error, and refetch function
 */
export function useTermsAndConditions(): UseTermsAndConditionsReturn {
  const query = useQuery<TermsAndConditions>({
    queryKey: ['terms-and-conditions'],
    queryFn: async () => {
      const response = await getTermsAndConditionsContent();

      if (response.error) {
        console.error('[Terms Hook] Error:', response.error);
        throw new Error(response.error.message);
      }
      if (response.data) {
        return response.data;
      }
      throw new Error('No terms & conditions available');
    },
    staleTime: Infinity,
  });

  return {
    termsAndConditions: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? query.error.message : null,
    refetch: query.refetch,
  };
}
