/**
 * Coach payouts with Stripe Connect Express (stripe-payouts function). AthaNext never sees or
 * stores bank details; Stripe collects them on its own pages.
 */
import { supabase } from "@/integrations/supabase/client";

export type PayoutDay = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";

export interface PayoutAccount {
  connected: boolean;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  transfersActive: boolean;
  payoutDay: PayoutDay;
  bankLast4: string | null;
}

export interface PayoutSummary {
  account: PayoutAccount;
  balance: { available: number; pending: number } | null;
  payouts: { id: string; amount: number; arrival: string; status: string }[];
}

type Row = Record<string, any>;

const toAccount = (raw: Row | undefined): PayoutAccount => ({
  connected: Boolean(raw?.connected),
  detailsSubmitted: Boolean(raw?.details_submitted),
  payoutsEnabled: Boolean(raw?.payouts_enabled),
  transfersActive: Boolean(raw?.transfers_active),
  payoutDay: (raw?.payout_day as PayoutDay) ?? "monday",
  bankLast4: raw?.bank_last4 ?? null,
});

const call = async (body: Record<string, unknown>): Promise<Row> => {
  const { data, error } = await supabase.functions.invoke("stripe-payouts", { body });
  if (error) {
    const message = await (error as { context?: Response }).context?.json?.().then((b: Row) => b?.error).catch(() => null);
    throw new Error(message || error.message);
  }
  return (data ?? {}) as Row;
};

export const payoutsAPI = {
  status: async () => toAccount((await call({ action: "status" })).account),
  onboardUrl: async () => (await call({ action: "onboard", origin: window.location.origin })).url as string,
  dashboardUrl: async () => (await call({ action: "dashboard" })).url as string,
  setDay: async (day: PayoutDay) => toAccount((await call({ action: "payout_day", day })).account),
  summary: async (): Promise<PayoutSummary> => {
    const raw = await call({ action: "payouts" });
    return {
      account: toAccount(raw.account),
      balance: raw.balance ?? null,
      payouts: (raw.payouts as PayoutSummary["payouts"]) ?? [],
    };
  },
};
