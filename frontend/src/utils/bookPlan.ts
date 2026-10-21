/**
 * Review and pay (ATH-94): splits picked times by how each coach is paid, and works out which
 * times credits cover (the earliest ones with each coach) and the fees on what is paid in the app.
 * Fee math is utils/fees.ts, the same code create-booking-payment charges with.
 */
import { checkoutFees, feeLine, toCents, type FeeConfig, type FeeLine } from "@/utils/fees";

export type PlanCoach = { id: string; needsRequest: boolean; paysDirect: boolean; credits: number };
export type PlanSession = { id: string; coachId: string; price: number; date: string; startTime: string };
/** Fee rates (null while loading or when they can't be read); coaches in `waived` charge this family no platform fee. */
export type PlanFees = { config: FeeConfig | null; error?: boolean; waived: Set<string> };

const dollars = (cents: number) => cents / 100;

/** One time booked on its own: list price, fees and total in cents. Null until the rates are known. */
export const sessionFees = (price: number, coachId: string, fees: PlanFees): FeeLine | null =>
  fees.config ? feeLine(toCents(price), "session", fees.config, fees.waived.has(coachId)) : null;

export const planBooking = <S extends PlanSession>(picked: S[], coaches: Record<string, PlanCoach>, useCredits: boolean, fees: PlanFees) => {
  const direct = picked.filter((s) => coaches[s.coachId]?.paysDirect);
  const requests = picked.filter((s) => !coaches[s.coachId]?.paysDirect && coaches[s.coachId]?.needsRequest);
  const instant = picked.filter((s) => !coaches[s.coachId]?.paysDirect && !coaches[s.coachId]?.needsRequest);
  const covered = new Set<string>();
  if (useCredits) {
    const byCoach = new Map<string, S[]>();
    instant.forEach((s) => byCoach.set(s.coachId, [...(byCoach.get(s.coachId) ?? []), s]));
    byCoach.forEach((list, coachId) => {
      [...list]
        .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
        .slice(0, coaches[coachId]?.credits ?? 0)
        .forEach((s) => covered.add(s.id));
    });
  }
  const paid = instant.filter((s) => !covered.has(s.id));
  const availableCredits = [...new Set(instant.map((s) => s.coachId))].reduce((n, id) => n + (coaches[id]?.credits ?? 0), 0);
  // One Checkout each, exactly as create-booking-payment builds them.
  const checkout = (list: S[]) =>
    fees.config
      ? checkoutFees(
          list.map((s) => ({ listCents: toCents(s.price), kind: "session" as const, platformWaived: fees.waived.has(s.coachId) })),
          fees.config
        )
      : null;
  const now = checkout(paid);
  const later = checkout(requests);
  const listOf = (list: S[]) => dollars(list.reduce((n, s) => n + toCents(s.price), 0));
  return {
    instant,
    requests,
    direct,
    covered,
    availableCredits,
    /** False while the fee rates load (or when they can't): don't show fee amounts or take payment. */
    feesReady: Boolean(fees.config),
    feesError: Boolean(fees.error) && !fees.config,
    subtotal: listOf(paid),
    /** Platform fee only (waived for a coach's own clients). */
    platformFees: now ? dollars(now.platformCents) : 0,
    /** Card processing on what is paid now. */
    processingFees: now ? dollars(now.processingCents) : 0,
    dueNow: now ? dollars(now.totalCents) : listOf(paid),
    ifAccepted: later ? dollars(later.totalCents) : listOf(requests),
    payDirect: listOf(direct),
  };
};
