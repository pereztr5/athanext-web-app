/**
 * ATH-103: whether the signed-in coach still has product access (trial or $29/mo).
 * Falls back to coaches.trial_ends_at / subscription_status on the profile row when the
 * edge function is not deployed yet, so the UI clock still works locally.
 */
import { useQuery } from "@tanstack/react-query";
import { coachBillingAPI, type CoachBillingStatus } from "@/api/coachBilling";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useCoachDetails } from "@/hooks/useCoachDetails";

const PAID = new Set(["active", "trialing"]);

const fromCoachRow = (coach: {
  trial_ends_at?: string | null;
  subscription_status?: string | null;
} | null | undefined): CoachBillingStatus | null => {
  if (!coach) return null;
  const status = coach.subscription_status ?? null;
  const trialEndsAt = coach.trial_ends_at ?? null;
  // Before the billing migration is applied, columns are missing — do not lock everyone.
  if (trialEndsAt == null && status == null) {
    return {
      access: true,
      locked: false,
      subscribed: false,
      trialActive: false,
      trialEndsAt: null,
      daysLeft: 0,
      subscriptionStatus: null,
      priceMonthly: 29,
    };
  }
  const subscribed = Boolean(status && PAID.has(status));
  const trialMs = trialEndsAt ? new Date(trialEndsAt).getTime() - Date.now() : 0;
  const trialActive = trialMs > 0 && !subscribed;
  const access = subscribed || trialMs > 0;
  return {
    access,
    locked: !access,
    subscribed,
    trialActive,
    trialEndsAt,
    daysLeft: trialMs > 0 ? Math.ceil(trialMs / (24 * 60 * 60 * 1000)) : 0,
    subscriptionStatus: status,
    priceMonthly: 29,
  };
};

export const useCoachBillingAccess = () => {
  const { isCoach, ready: roleReady } = useRole();
  const { userProfile } = useAuth();
  const coachId = userProfile?.coach_id ?? undefined;
  const { coach } = useCoachDetails(coachId);

  const query = useQuery({
    queryKey: ["coach-billing-status", coachId],
    queryFn: () => coachBillingAPI.status(),
    enabled: Boolean(isCoach && coachId),
    retry: false,
    staleTime: 60_000,
  });

  const fallback = fromCoachRow(
    coach as { trial_ends_at?: string | null; subscription_status?: string | null } | undefined
  );
  const status = query.data ?? fallback;
  const loading = !roleReady || (Boolean(isCoach && coachId) && query.isLoading && !status);

  return {
    ready: roleReady && !loading,
    isCoach,
    status,
    access: status?.access ?? true,
    locked: Boolean(isCoach && status && status.locked),
    subscribed: Boolean(status?.subscribed),
    trialActive: Boolean(status?.trialActive),
    daysLeft: status?.daysLeft ?? 0,
    trialEndsAt: status?.trialEndsAt ?? null,
    subscriptionStatus: status?.subscriptionStatus ?? null,
    priceMonthly: status?.priceMonthly ?? 29,
    refresh: () => query.refetch(),
    isError: query.isError,
  };
};
