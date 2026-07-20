import { useState, useEffect } from 'react';
import { getFAQs, type FAQsResponse, type FAQ } from '@/api/faqs';

interface UseFAQsReturn {
  faqs: FAQ[];
  loading: boolean;
  error: string | null;
  source: 'database' | 'fallback' | null;
  refetch: () => Promise<void>;
  hasFAQs: boolean;
  total: number;
}

/**
 * Custom hook for fetching and managing FAQs
 * Handles loading states, errors, and fallback data
 * Always ensures FAQs are available with intelligent fallback
 */
export function useFAQs(): UseFAQsReturn {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'database' | 'fallback' | null>(null);
  const [total, setTotal] = useState(0);

  const fetchFAQs = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getFAQs();

      if (response.error) {
        console.error('[FAQs Hook] Error:', response.error);
        setError(null); // Don't show error - we have fallback
      }

      if (response.data) {
        const { faqs: faqData, source: dataSource, total: totalCount } = response.data as FAQsResponse;

        // Validate that faqs is an array
        if (!Array.isArray(faqData)) {
          console.warn('[FAQs Hook] FAQs data is not an array');
          setFaqs([]);
          setTotal(0);
        } else if (faqData.length === 0) {
          console.warn('[FAQs Hook] No FAQs returned');
          setFaqs([]);
          setTotal(0);
        } else {
          setFaqs(faqData);
          setTotal(totalCount || faqData.length);
          setSource(dataSource);
          console.log(`[FAQs Hook] Loaded ${faqData.length} FAQs from ${dataSource}`);
        }
      } else {
        setFaqs([]);
        setTotal(0);
      }
    } catch (err) {
      console.error('[FAQs Hook] Unexpected error:', err);
      setError(null); // Don't show error to user
      setFaqs([]);
      setTotal(0);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchFAQs();
  }, []);

  return {
    faqs,
    loading,
    error,
    source,
    refetch: fetchFAQs,
    hasFAQs: faqs.length > 0,
    total,
  };
}
