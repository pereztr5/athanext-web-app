/**
 * Review and pay (ATH-94): splits picked times by how each coach is paid, and works out which
 * times credits cover (the earliest ones with each coach) and the fee on each paid time.
 */
export type PlanCoach = { id: string; needsRequest: boolean; paysDirect: boolean; credits: number };
export type PlanSession = { id: string; coachId: string; price: number; date: string; startTime: string };
/** Fee percentages from configuration; coaches in `waived` charge this family no platform fee. */
export type PlanFees = { platformPerc: number; stripePerc: number; waived: Set<string> };

const cents = (n: number) => Math.round(n * 100) / 100;

/** Same per-line total as create-booking-payment: price × (1 + platform% + Stripe%), to the cent. */
export const feeFor = (price: number, coachId: string, fees?: PlanFees) => {
  if (!fees) return 0;
  const platform = fees.waived.has(coachId) ? 0 : fees.platformPerc;
  return cents(cents(price * (1 + platform / 100 + fees.stripePerc / 100)) - price);
};

export const planBooking = <S extends PlanSession>(picked: S[], coaches: Record<string, PlanCoach>, useCredits: boolean, fees?: PlanFees) => {
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
  const sum = (list: S[]) => cents(list.reduce((n, s) => n + s.price, 0));
  const fee = (s: S) => feeFor(s.price, s.coachId, fees);
  const paid = instant.filter((s) => !covered.has(s.id));
  const availableCredits = [...new Set(instant.map((s) => s.coachId))].reduce((n, id) => n + (coaches[id]?.credits ?? 0), 0);
  const subtotal = sum(paid);
  const feeTotal = cents(paid.reduce((n, s) => n + fee(s), 0));
  return {
    instant,
    requests,
    direct,
    covered,
    availableCredits,
    /** Fee on one time if it's paid in the app now (0 for credits, requests and pay-direct). */
    feeOf: (s: S) => (instant.includes(s) && !covered.has(s.id) ? fee(s) : 0),
    subtotal,
    fees: feeTotal,
    dueNow: cents(subtotal + feeTotal),
    ifAccepted: cents(requests.reduce((n, s) => n + s.price + fee(s), 0)),
    payDirect: sum(direct),
  };
};
