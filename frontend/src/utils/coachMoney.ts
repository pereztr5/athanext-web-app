/**
 * Coach Business / Home / Payments money surfaces share these React Query keys.
 * Call after any action that changes what the coach has collected or is owed.
 */
import type { QueryClient } from "@tanstack/react-query";

export const COACH_MONEY_KEYS = [
  "coach-camp-money",
  "coach-offline-payments",
  "pending-offline-payments",
  "coach-payments",
  "coach-earnings",
  "coach-payouts",
] as const;

/** Short cache so webhook-settled payments show up without a hard refresh. */
export const COACH_MONEY_STALE_MS = 30_000;

export const invalidateCoachMoney = (qc: QueryClient) =>
  Promise.all(COACH_MONEY_KEYS.map((key) => qc.invalidateQueries({ queryKey: [key] })));
