import { useQuery } from '@tanstack/react-query';
import { type AboutData } from "@/api/about";
import { getAboutPageData } from '@/api/about';
import { ABOUT_PAGE_DATA } from "@/utils/db";

interface UseAboutPageDataReturn {
  data: AboutData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  hasData: boolean;
}

/**
 * Fallback data for when database tables don't exist yet
 * This is shown while user hasn't run the SQL migration
 * Source of truth lives in utils/db.js (ABOUT_PAGE_DATA)
 */
const FALLBACK_DATA: AboutData = ABOUT_PAGE_DATA;

interface AboutPageResult {
  aboutData: AboutData | null;
  errorMsg: string | null;
}

export function useAboutPageData(): UseAboutPageDataReturn {
  const query = useQuery<AboutPageResult>({
    queryKey: ['about-page-data'],
    queryFn: async () => {
      try {
        const response = await getAboutPageData();

        if (response.error) {
          return { aboutData: null, errorMsg: response.error.message };
        }
        if (response.data) {
          return { aboutData: response.data, errorMsg: null };
        }
        return { aboutData: null, errorMsg: null };
      } catch (err) {
        // Even on error, provide fallback data
        return {
          aboutData: FALLBACK_DATA,
          errorMsg: err instanceof Error ? err.message : 'Failed to load about data',
        };
      }
    },
    staleTime: Infinity,
  });

  const aboutData = query.data?.aboutData ?? null;

  return {
    data: aboutData,
    loading: query.isLoading,
    error: query.data?.errorMsg ?? null,
    refetch: query.refetch,
    hasData: !!aboutData,
  };
}
