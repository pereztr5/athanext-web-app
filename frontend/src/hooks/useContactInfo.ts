/**
 * Custom hook for fetching contact information
 * Handles loading states, errors, and provides contact details
 */

import { useState, useEffect } from 'react';
import { contactInfoAPI, type ContactInfo } from '@/api';

interface UseContactInfoReturn {
  contactInfo: ContactInfo | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useContactInfo(): UseContactInfoReturn {
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContactInfo = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await contactInfoAPI.getContactInfo();
      console.log('[Contact Info Hook] Response:', response);

      if (response.error) {
        setError('Failed to load contact information');
        setContactInfo(null);
      } else if (response.data) {
        setContactInfo(response.data);
      } else {
        setContactInfo(null);
      }
    } catch (err) {
      setError('An unexpected error occurred');
      setContactInfo(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContactInfo();
  }, []);

  return {
    contactInfo,
    loading,
    error,
    refetch: fetchContactInfo,
  };
}
