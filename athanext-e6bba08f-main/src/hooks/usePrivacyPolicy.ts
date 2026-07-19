import { useState, useEffect } from 'react';
import { getPrivacyPolicyContent, type PrivacyPolicyContent } from '@/api/privacy-policy';

interface UsePrivacyPolicyReturn {
  policy: PrivacyPolicyContent | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  hasContent: boolean;
}

/**
 * Custom hook for fetching and managing privacy policy content
 * Handles loading states, errors, and fallback data
 */
export function usePrivacyPolicy(): UsePrivacyPolicyReturn {
  const [policy, setPolicy] = useState<PrivacyPolicyContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPolicy = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getPrivacyPolicyContent();

      if (response.error) {
        console.error('[Privacy Policy Hook] Error:', response.error);
        // Still use demo data if available
        if (response.data?.policy) {
          setPolicy(response.data.policy);
        }
        setError(null); // Don't show error to user - we have fallback
      } else if (response.data?.policy) {
        setPolicy(response.data.policy);
        setError(null);
      } else {
        setError('Unable to load privacy policy');
      }
    } catch (err) {
      console.error('[Privacy Policy Hook] Unexpected error:', err);
      setError(null); // Still try to show demo data
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchPolicy();
  }, []);

  return {
    policy,
    loading,
    error,
    refetch: fetchPolicy,
    hasContent: policy !== null && policy.content.trim().length > 0,
  };
}
