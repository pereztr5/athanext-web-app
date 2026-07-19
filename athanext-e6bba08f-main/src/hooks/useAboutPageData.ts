import { useState, useEffect } from 'react';
import { type AboutData } from "@/api/about";
import { getAboutPageData } from '@/api/about';
import { ABOUT_PAGE_DATA } from "@/utils/db";

interface UseAboutPageDataReturn {
  data: AboutData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  hasData: boolean;
}

/**
 * Fallback data for when database tables don't exist yet
 * This is shown while user hasn't run the SQL migration
 * Source of truth lives in utils/db.js (ABOUT_PAGE_DATA)
 */
const FALLBACK_DATA: AboutData = ABOUT_PAGE_DATA;

export function useAboutPageData(): UseAboutPageDataReturn {
  const [data, setData] = useState<AboutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getAboutPageData();
      
      if (response.error) {
        setError(response.error.message);
      } else if (response.data) {
        setData(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load about data');
      // Even on error, set fallback data
      setData(FALLBACK_DATA);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    hasData: !!data,
  };
}
