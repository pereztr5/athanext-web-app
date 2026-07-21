import { useQuery } from '@tanstack/react-query';
import { getPrivacyPolicyContent, type PrivacyPolicyContent } from '@/api/privacy-policy';

interface UsePrivacyPolicyReturn {
  policy: PrivacyPolicyContent | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  hasContent: boolean;
}

interface PrivacyPolicyResult {
  policy: PrivacyPolicyContent | null;
  errorMsg: string | null;
}

/**
 * Custom hook for fetching and managing privacy policy content
 * Handles loading states, errors, and fallback data
 */
export function usePrivacyPolicy(): UsePrivacyPolicyReturn {
  const query = useQuery<PrivacyPolicyResult>({
    queryKey: ['privacy-policy'],
    queryFn: async () => {
      try {
        const response = await getPrivacyPolicyContent();

        if (response.error) {
          console.error('[Privacy Policy Hook] Error:', response.error);
          // Still use demo data if available; don't surface error - we have fallback
          return { policy: response.data?.policy ?? null, errorMsg: null };
        }
        if (response.data?.policy) {
          return { policy: response.data.policy, errorMsg: null };
        }
        return { policy: null, errorMsg: 'Unable to load privacy policy' };
      } catch (err) {
        console.error('[Privacy Policy Hook] Unexpected error:', err);
        return { policy: null, errorMsg: null };
      }
    },
    staleTime: Infinity,
  });

  const policy = query.data?.policy ?? null;

  return {
    policy,
    loading: query.isLoading,
    error: query.data?.errorMsg ?? null,
    refetch: query.refetch,
    hasContent: policy !== null && policy.content.trim().length > 0,
  };
}
