/**
 * Contact Info API Endpoints
 * Centralized API calls for fetching contact information from contact_us table
 */

import { apiClient, type ApiResponse } from '@/api/client';

/**
 * Contact Info Type based on contact_us table schema
 * Table: contact_us
 * Columns: id, email, contact_number, location, created_at, updated_at
 */
export interface ContactInfo {
  id: string;
  email: string | null;
  contact_number: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Contact Info API
 * Handles fetching contact information from Supabase contact_us table
 */
export const contactInfoAPI = {
  /**
   * Get contact information from contact_us table
   * Fetches the latest contact info record (ordered by created_at DESC)
   * @returns Promise with ContactInfo data or null
   */
  async getContactInfo(): Promise<ApiResponse<ContactInfo | null>> {
    return apiClient.query<ContactInfo>(
      async (client) => client
        .from('contact_us' as any)
        .select('id, email, contact_number, location, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      'Fetch contact information from contact_us table'
    );
  },
};