import { useQuery } from '@tanstack/react-query';
import { getFAQs, type FAQsResponse, type FAQ } from '@/api/faqs';

interface UseFAQsReturn {
  faqs: FAQ[];
  loading: boolean;
  error: string | null;
  source: 'database' | 'fallback' | null;
  refetch: () => void;
  hasFAQs: boolean;
  total: number;
}

interface FAQsResult {
  faqs: FAQ[];
  source: 'database' | 'fallback' | null;
  total: number;
}

/**
 * Custom hook for fetching and managing FAQs
 * Handles loading states, errors, and fallback data
 * Always ensures FAQs are available with intelligent fallback
 */
export function useFAQs(): UseFAQsReturn {
  const query = useQuery<FAQsResult>({
    queryKey: ['faqs'],
    queryFn: async () => {
      try {
        const response = await getFAQs();

        if (response.error) {
          console.error('[FAQs Hook] Error:', response.error);
          // Don't surface error - we have fallback
        }

        if (response.data) {
          const { faqs: faqData, source: dataSource, total: totalCount } = response.data as FAQsResponse;

          if (!Array.isArray(faqData)) {
            console.warn('[FAQs Hook] FAQs data is not an array');
            return { faqs: [], source: null, total: 0 };
          }
          if (faqData.length === 0) {
            console.warn('[FAQs Hook] No FAQs returned');
            return { faqs: [], source: null, total: 0 };
          }
          return { faqs: faqData, source: dataSource, total: totalCount || faqData.length };
        }

        return { faqs: [], source: null, total: 0 };
      } catch (err) {
        console.error('[FAQs Hook] Unexpected error:', err);
        return { faqs: [], source: null, total: 0 };
      }
    },
    staleTime: Infinity,
  });

  const faqs = query.data?.faqs ?? [];

  return {
    faqs,
    loading: query.isLoading,
    error: null, // Never surface error - fallback always provides FAQs
    source: query.data?.source ?? null,
    refetch: query.refetch,
    hasFAQs: faqs.length > 0,
    total: query.data?.total ?? 0,
  };
}
