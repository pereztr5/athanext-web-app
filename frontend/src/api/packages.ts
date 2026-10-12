/**
 * Packages API Endpoints
 * Handles coach packages and session purchases
 */

import { apiClient, type ApiResponse } from '@/api/client';
import type { Database } from '@/integrations/supabase/types';

export type CoachPackageRow = Database['public']['Tables']['coach_packages']['Row'];
export type CoachPackageInsert = Database['public']['Tables']['coach_packages']['Insert'];
export type CoachPackageUpdate = Database['public']['Tables']['coach_packages']['Update'];

export interface Package {
  id: string;
  coach_id: string;
  package_name: string;
  description?: string | null;
  session_count: number;
  duration_minutes: number;
  total_price: number;
  price_per_session?: number | null;
  validity_days: number;
  features: string[];
  is_active: boolean;
  display_order?: number | null;
}

export interface PackagePurchase {
  id: string;
  package_id: string | null;
  sessions_remaining: number;
  sessions_total: number;
  expiry_date: string;
  status: 'active' | 'expired' | 'completed' | 'trialing';
  stripe_subscription_id?: string | null;
  org_package_id?: string | null;
}

export interface PurchasePackageInput {
  package_id: string;
  coach_id: string;
}

export interface PackagePaymentRedirect {
  url?: string;
}

export interface PackagePaymentState {
  state?: 'pending' | 'reconciled' | 'failed' | string;
  message?: string;
}

export interface PartnershipPaymentState {
  state?: 'pending' | 'reconciled' | 'failed' | string;
  message?: string;
}

export const packagesAPI = {
  /**
   * Get packages for a coach
   * @param coachId - Coach ID to fetch packages for
   * @param options.includeInactive - Owner view only; RLS limits inactive rows to the owning coach
   * @returns ApiResponse with coach's packages (active only unless includeInactive)
   */
  async getCoachPackages(
    coachId: string,
    options: { includeInactive?: boolean } = {}
  ): Promise<ApiResponse<Package[]>> {
    return apiClient.query(
      async (client) => {
        let query = client
          .from('coach_packages')
          .select('*')
          .eq('coach_id', coachId);
        if (!options.includeInactive) query = query.eq('is_active', true);
        return query.order('created_at');
      },
      `Fetch packages for coach: ${coachId}`
    );
  },

  /**
   * Purchase a package
   * @param data - Purchase details including package_id and coach_id
   * @returns ApiResponse with package purchase details
   */
  async purchasePackage(data: PurchasePackageInput): Promise<ApiResponse<PackagePurchase>> {
    return apiClient.mutate(
      async (client) => client
        .from('package_purchases')
        .insert({
          package_id: data.package_id,
          coach_id: data.coach_id,
          sessions_total: 0,
          sessions_remaining: 0,
          expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active'
        })
        .select()
        .single(),
      `Purchase package: ${data.package_id}`
    );
  },

  /**
   * Get user's purchased packages
   * @returns ApiResponse with user's package purchases
   */
  async getMyPackages(): Promise<ApiResponse<PackagePurchase[]>> {
    const user = await apiClient.getSupabaseClient().auth.getUser();
    
    if (!user.data.user) {
      return {
        data: null,
        error: {
          code: 'AUTH_ERROR',
          message: 'User not authenticated',
          status: 401,
        },
      };
    }

    return apiClient.query(
      async (client) => client
        .from('package_purchases')
        .select('*')
        .eq('user_id', user.data.user!.id)
        .order('expiry_date', { ascending: false }),
      'Fetch user package purchases'
    );
  },

  /**
   * Get remaining sessions for a package
   * @param packagePurchaseId - Package purchase ID
   * @returns ApiResponse with remaining session count
   */
  async getRemainingSessions(packagePurchaseId: string): Promise<ApiResponse<number>> {
    const response = await apiClient.query<{ sessions_remaining: number }>(
      async (client) => client
        .from('package_purchases')
        .select('sessions_remaining')
        .eq('id', packagePurchaseId)
        .single(),
      `Get remaining sessions for package: ${packagePurchaseId}`
    );

    if (response.error || !response.data) {
      return {
        data: null,
        error: response.error,
      };
    }

    return {
      data: response.data.sessions_remaining,
      error: null,
    };
  },

  /**
   * Get package by ID
   * @param packageId - Package ID to fetch
   * @returns ApiResponse with package details
   */
  async getPackageById(packageId: string): Promise<ApiResponse<Package | null>> {
    return apiClient.query(
      async (client) => client
        .from('coach_packages')
        .select('*')
        .eq('id', packageId)
        .single(),
      `Fetch package: ${packageId}`
    );
  },

  /**
   * Create a coach package (owning coach or admin; requires RLS write policy)
   */
  async createCoachPackage(
    payload: CoachPackageInsert
  ): Promise<ApiResponse<CoachPackageRow>> {
    return apiClient.mutate<CoachPackageRow>(
      async (client) =>
        client
          .from('coach_packages')
          .insert(payload)
          .select()
          .single(),
      `Create coach package for coach: ${payload.coach_id}`
    );
  },

  /**
   * Update a coach package (owning coach or admin; requires RLS write policy)
   */
  async updateCoachPackage(
    packageId: string,
    updates: CoachPackageUpdate
  ): Promise<ApiResponse<CoachPackageRow>> {
    return apiClient.mutate<CoachPackageRow>(
      async (client) =>
        client
          .from('coach_packages')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', packageId)
          .select()
          .single(),
      `Update coach package: ${packageId}`
    );
  },

  /**
   * Update package purchase status
   * @param purchaseId - Package purchase ID
   * @param status - New status
   * @returns ApiResponse with updated purchase
   */
  async updatePurchaseStatus(
    purchaseId: string,
    status: 'active' | 'expired' | 'completed'
  ): Promise<ApiResponse<PackagePurchase>> {
    return apiClient.mutate(
      async (client) => client
        .from('package_purchases')
        .update({ status })
        .eq('id', purchaseId)
        .select()
        .single(),
      `Update package purchase status: ${purchaseId}`
    );
  },

  /**
   * Create Stripe checkout session for a package purchase (edge function)
   */
  async createPackagePayment(input: PurchasePackageInput): Promise<ApiResponse<PackagePaymentRedirect>> {
    return apiClient.invoke(
      'create-package-payment',
      input as any,
      `Create package payment for package ${input.package_id}`
    );
  },

  /** Stop renewing a monthly group pass at the end of the current period. */
  async cancelSubscription(purchaseId: string): Promise<ApiResponse<{ canceled?: boolean }>> {
    return apiClient.invoke(
      'create-package-payment',
      { action: 'cancel', purchase_id: purchaseId } as any,
      `Cancel package subscription: ${purchaseId}`,
    );
  },

  /**
   * Reconcile/verify a package payment session (edge function)
   */
  async reconcilePackagePayment(sessionId: string): Promise<ApiResponse<PackagePaymentState>> {
    return apiClient.invoke(
      'reconcile-package-payment',
      { session_id: sessionId },
      `Reconcile package payment session ${sessionId}`
    );
  },

  /**
   * Reconcile/verify a partnership payment session (edge function)
   */
  async reconcilePartnershipPayment(sessionId: string): Promise<ApiResponse<PartnershipPaymentState>> {
    return apiClient.invoke(
      'reconcile-partnership-payment',
      { session_id: sessionId },
      `Reconcile partnership payment session ${sessionId}`
    );
  },
};
