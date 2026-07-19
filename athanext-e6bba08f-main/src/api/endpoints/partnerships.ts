/**
 * Partnerships API Endpoints
 * Handles partner integrations and inquiries
 */

import { apiClient, type ApiResponse } from '@/api/client';

export enum PartnershipStatus {
  AVAILABLE_NOW = 'Available Now',
  COMING_SOON = 'Coming Soon',
} 

export interface Partnership {
  sport_type: any;
  id: string;
  name: string;
  description: string;
  logo: string;
  status: PartnershipStatus;
  price: number;
  cta_label: string;
  created_at: string;
  detailed_description?: string;
  features?: string[];
  benefits?: string[];
  preview_images?: string[];
  demo_video_url?: string;
  stripe_price_id?: string;
  is_active: boolean;
}

export interface PartnershipInquiry {
  id: string;
  name: string;
  organization: string;
  email: string;
  partnership_interest: string;
  status: 'submitted' | 'reviewing' | 'approved' | 'rejected';
  created_at: string;
}

export interface SubmitInquiryInput {
  name: string;
  organization: string;
  email: string;
  partnership_interest: string;
}

export const partnershipsAPI = {
  /**
   * Get all available partnerships
   * @returns ApiResponse with all partnerships
   */
  async getPartnerships(): Promise<ApiResponse<Partnership[]>> {
    return apiClient.query(
      async (client) => client
        .from('partnerships')
        .select('*')
        .eq('is_active', true)
        .order('name'),
      'Fetch partnerships'
    );
  },

  /**
   * Get single partnership details
   * @param id - Partnership ID
   * @returns ApiResponse with partnership details
   */
  async getPartnershipById(id: string): Promise<ApiResponse<Partnership | null>> {
    return apiClient.query(
      async (client) => client
        .from('partnerships')
        .select('*')
        .eq('id', id)
        .single(),
      `Fetch partnership: ${id}`
    );
  },

  /**
   * Submit partnership inquiry
   * @param data - Inquiry details
   * @returns ApiResponse with submitted inquiry
   */
  async submitInquiry(data: SubmitInquiryInput): Promise<ApiResponse<PartnershipInquiry>> {
    return apiClient.mutate(
      async (client) => client
        .from('partnership_inquiries')
        .insert({
          name: data.name,
          organization: data.organization,
          email: data.email,
          partnership_interest: data.partnership_interest,
          status: 'submitted'
        })
        .select()
        .single(),
      'Submit partnership inquiry'
    );
  },

  /**
   * Get my partnership inquiries
   * @returns ApiResponse with user's inquiries
   */
  async getMyInquiries(): Promise<ApiResponse<PartnershipInquiry[]>> {
    return apiClient.query(
      async (client) => client
        .from('partnership_inquiries')
        .select('*')
        .order('created_at', { ascending: false }),
      'Fetch user partnership inquiries'
    );
  },

  /**
   * Get inquiry by ID
   * @param inquiryId - Inquiry ID to fetch
   * @returns ApiResponse with inquiry details
   */
  async getInquiryStatus(inquiryId: string): Promise<ApiResponse<PartnershipInquiry | null>> {
    return apiClient.query(
      async (client) => client
        .from('partnership_inquiries')
        .select('*')
        .eq('id', inquiryId)
        .single(),
      `Fetch inquiry status: ${inquiryId}`
    );
  },

  /**
   * Update inquiry status (admin only)
   * @param inquiryId - Inquiry ID to update
   * @param status - New status
   * @returns ApiResponse with updated inquiry
   */
  async updateInquiryStatus(
    inquiryId: string,
    status: 'submitted' | 'reviewing' | 'approved' | 'rejected'
  ): Promise<ApiResponse<PartnershipInquiry>> {
    return apiClient.mutate(
      async (client) => client
        .from('partnership_inquiries')
        .update({ status })
        .eq('id', inquiryId)
        .select()
        .single(),
      `Update inquiry status: ${inquiryId}`
    );
  },

  /**
   * Get partnerships by status
   * @param status - Partnership status to filter by
   * @returns ApiResponse with filtered partnerships
   */
  async getPartnershipsByStatus(status: 'Available Now' | 'Coming Soon'): Promise<ApiResponse<Partnership[]>> {
    return apiClient.query(
      async (client) => client
        .from('partnerships')
        .select('*')
        .eq('status', status)
        .order('name'),
      `Fetch partnerships with status: ${status}`
    );
  },
};
