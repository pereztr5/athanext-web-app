/**
 * Packages API Endpoints
 * Handles coach packages and session purchases
 */

import { apiClient, type ApiError, type ApiResponse } from '@/api/client';
import { supabase } from '@/integrations/supabase/client';
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
  /** Present after the camps migration. Absent until then. */
  kind?: string | null;
}

export interface CampCoach {
  id: string;
  name: string;
  photoUrl: string | null;
}

/** A coach_packages row with kind = camp, plus public catalog fields when the RPC is applied. */
export interface Camp {
  id: string;
  coachId: string;
  name: string;
  description: string | null;
  totalPriceCents: number;
  isActive: boolean;
  startsOn: string | null;
  endsOn: string | null;
  dailyStart: string | null;
  dailyEnd: string | null;
  location: string | null;
  capacity: number | null;
  ageMin: number | null;
  ageMax: number | null;
  /** Null when the camp has no capacity, or when spots could not be counted. */
  spotsLeft: number | null;
  coCoaches: CampCoach[];
  coCoachIds: string[];
  included: string[];
  direct: boolean;
  slug: string | null;
  published: boolean;
  sessionCount: number;
  durationMinutes: number;
  validityDays: number;
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

type LooseError = { code?: string; message: string };

type LooseResult = { data: unknown; error: LooseError | null };

// until types are regenerated after the migration is applied
const loose = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<LooseResult>;
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => {
      select: (columns?: string) => { single: () => Promise<LooseResult> };
    };
    update: (row: Record<string, unknown>) => {
      eq: (column: string, value: string) => {
        select: (columns?: string) => { single: () => Promise<LooseResult> };
      };
    };
    select: (columns?: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: boolean) => { order: (column: string) => Promise<LooseResult> };
        order: (column: string) => Promise<LooseResult>;
      };
    };
  };
};

const asString = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);

const asInt = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Math.trunc(Number(value));
  return null;
};

const missingFunction = (error: LooseError) => {
  const message = error.message ?? "";
  return error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(message);
};

const parseCoaches = (value: unknown): CampCoach[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const id = asString(row.id);
    const name = asString(row.name);
    if (!id || !name) return [];
    return [{ id, name, photoUrl: asString(row.photo_url) }];
  });
};

const parseIdList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && id.length > 0) : [];

/** Returns null for non-camps and for rows that are not a camp yet. */
export const parseCamp = (raw: unknown): Camp | null => {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (row.kind !== "camp") return null;
  const id = asString(row.id);
  const coachId = asString(row.coach_id);
  const name = asString(row.package_name);
  const totalPriceCents = asInt(row.total_price);
  if (!id || !coachId || !name || totalPriceCents == null) return null;
  const coCoaches = parseCoaches(row.co_coaches);
  const coCoachIds = parseIdList(row.co_coach_ids);
  const spotsLeft = row.spots_left == null ? null : asInt(row.spots_left);
  return {
    id,
    coachId,
    name,
    description: asString(row.description),
    totalPriceCents,
    isActive: row.is_active !== false,
    startsOn: asString(row.camp_starts_on)?.slice(0, 10) ?? null,
    endsOn: asString(row.camp_ends_on)?.slice(0, 10) ?? null,
    dailyStart: asString(row.camp_daily_start),
    dailyEnd: asString(row.camp_daily_end),
    location: asString(row.camp_location),
    capacity: asInt(row.camp_capacity),
    ageMin: asInt(row.camp_age_min),
    ageMax: asInt(row.camp_age_max),
    spotsLeft,
    coCoaches,
    coCoachIds: coCoachIds.length ? coCoachIds : coCoaches.map((coach) => coach.id),
    included: Array.isArray(row.features) ? row.features.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [],
    direct: row.camp_pay_direct === true,
    slug: asString(row.camp_slug),
    published: typeof row.camp_published_at === "string" && row.camp_published_at.length > 0,
    sessionCount: asInt(row.session_count) ?? 1,
    durationMinutes: asInt(row.duration_minutes) ?? 60,
    validityDays: asInt(row.validity_days) ?? 1,
  };
};

const functionErrorMessage = async (error: unknown): Promise<string> => {
  const fallback = error instanceof Error ? error.message : "Could not start checkout.";
  const context = (error as { context?: Response }).context;
  if (!context || typeof context.clone !== "function") return fallback;
  try {
    const body = (await context.clone().json()) as { error?: unknown };
    if (typeof body?.error === "string" && body.error.trim()) return body.error.trim();
  } catch {
    // The client may already have read the body.
  }
  return fallback;
};

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
    return apiClient.query<Package[]>(
      async (client) => {
        let query = client
          .from('coach_packages')
          .select('*')
          .eq('coach_id', coachId);
        if (!options.includeInactive) query = query.eq('is_active', true);
        return query.order('created_at');
      },
      `Fetch packages for coach: ${coachId}`
    ).then((response) => {
      if (!response.data) return response;
      return {
        ...response,
        data: response.data.filter((row) => (row as { kind?: string | null }).kind !== 'camp'),
      };
    });
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
   * Create Stripe checkout session for a package purchase (edge function).
   * Camps use this same call: one payment, no bookable session credits.
   */
  async createPackagePayment(input: PurchasePackageInput): Promise<ApiResponse<PackagePaymentRedirect>> {
    try {
      const result = await supabase.functions.invoke("create-package-payment", { body: input });
      if (result.error) {
        return {
          data: null,
          error: {
            code: "FUNCTION_ERROR",
            message: await functionErrorMessage(result.error),
            status: 400,
          },
        };
      }
      const data = result.data as { url?: string; error?: string } | null;
      if (!data?.url) {
        return {
          data: null,
          error: {
            code: "FUNCTION_ERROR",
            message: data?.error?.trim() || "Could not start checkout.",
            status: 400,
          },
        };
      }
      return { data: { url: data.url }, error: null };
    } catch (error) {
      return {
        data: null,
        error: { code: "FUNCTION_ERROR", message: await functionErrorMessage(error), status: 500 },
      };
    }
  },

  /**
   * Camps for a coach profile. Uses get_coach_public_packages when it exists, and falls
   * back to coach_packages rows (without spots or co-coach names) before that migration.
   */
  async listCamps(
    coachId: string,
    options: { includeInactive?: boolean } = {}
  ): Promise<ApiResponse<Camp[]>> {
    const { data, error } = await loose.rpc("get_coach_public_packages", { p_coach_id: coachId });
    if (!error) {
      if (!Array.isArray(data)) {
        return { data: null, error: { code: "INVALID", message: "Camps came back in an unexpected shape.", status: 500 } };
      }
      const camps = data.map(parseCamp).filter((camp): camp is Camp => camp !== null);
      return { data: options.includeInactive ? camps : camps.filter((camp) => camp.isActive), error: null };
    }
    if (!missingFunction(error)) {
      return { data: null, error: { code: error.code || "UNKNOWN_ERROR", message: error.message, status: 400 } };
    }

    const fallback = options.includeInactive
      ? await loose.from("coach_packages").select("*").eq("coach_id", coachId).order("created_at")
      : await loose.from("coach_packages").select("*").eq("coach_id", coachId).eq("is_active", true).order("created_at");
    if (fallback.error) {
      return { data: null, error: { code: fallback.error.code || "UNKNOWN_ERROR", message: fallback.error.message, status: 400 } };
    }
    const rows = Array.isArray(fallback.data) ? fallback.data : [];
    return { data: rows.map(parseCamp).filter((camp): camp is Camp => camp !== null), error: null };
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
