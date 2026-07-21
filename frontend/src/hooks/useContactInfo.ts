/**
 * Custom hook for fetching contact information
 * Handles loading states, errors, and provides contact details
 */

import { useQuery } from '@tanstack/react-query';
import { contactInfoAPI, type ContactInfo } from '@/api';

interface UseContactInfoReturn {
  contactInfo: ContactInfo | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useContactInfo(): UseContactInfoReturn {
  const query = useQuery<ContactInfo | null>({
    queryKey: ['contact-info'],
    queryFn: async () => {
      try {
        const response = await contactInfoAPI.getContactInfo();
        if (response.error) {
          throw new Error('Failed to load contact information');
        }
        return response.data ?? null;
      } catch (err) {
        if (err instanceof Error && err.message === 'Failed to load contact information') {
          throw err;
        }
        throw new Error('An unexpected error occurred');
      }
    },
    staleTime: Infinity,
  });

  return {
    contactInfo: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? query.error.message : null,
    refetch: query.refetch,
  };
}
