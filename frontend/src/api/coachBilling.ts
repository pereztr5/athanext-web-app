/**
 * Coach plan billing (ATH-102): $29/month after a 30-day trial from coaches.created_at.
 */
import { supabase } from "@/integrations/supabase/client";

export type CoachBillingStatus = {
  access: boolean;
  locked: boolean;
  subscribed: boolean;
  trialActive: boolean;
  trialEndsAt: string | null;
  daysLeft: number;
  subscriptionStatus: string | null;
  priceMonthly: number;
};

type Row = Record<string, unknown>;

const toStatus = (raw: Row): CoachBillingStatus => ({
  access: Boolean(raw.access),
  locked: Boolean(raw.locked),
  subscribed: Boolean(raw.subscribed),
  trialActive: Boolean(raw.trial_active),
  trialEndsAt: (raw.trial_ends_at as string | null) ?? null,
  daysLeft: Number(raw.days_left ?? 0),
  subscriptionStatus: (raw.subscription_status as string | null) ?? null,
  priceMonthly: Number(raw.price_monthly ?? 29),
});

const call = async (body: Record<string, unknown>): Promise<Row> => {
  const { data, error } = await supabase.functions.invoke("coach-billing", { body });
  if (error) {
    const message = await (error as { context?: Response }).context?.json?.().then((b: Row) => b?.error).catch(() => null);
    throw new Error((message as string) || error.message);
  }
  if (data && typeof data === "object" && "error" in data && (data as Row).error) {
    throw new Error(String((data as Row).error));
  }
  return (data ?? {}) as Row;
};

export const coachBillingAPI = {
  status: async () => toStatus(await call({ action: "status" })),
  checkoutUrl: async () => (await call({ action: "checkout", origin: window.location.origin })).url as string,
  portalUrl: async () => (await call({ action: "portal", origin: window.location.origin })).url as string,
};
