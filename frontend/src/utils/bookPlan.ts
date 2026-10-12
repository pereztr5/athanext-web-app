/**
 * Review and pay (ATH-94): splits picked times by how each coach is paid, and works out which
 * times credits cover (the earliest ones with each coach) and the fee on each paid time.
 */
export type PlanCoach = { id: string; needsRequest: boolean; paysDirect: boolean; credits: number };
export type PlanSession = { id: string; coachId: string; price: number; date: string; startTime: string };
/** Fee rates from configuration; coaches in `waived` charge this family no platform fee. */
export type PlanFees = { platformPerc: number; stripePerc: number; stripeFixed?: number; waived: Set<string> };

const cents = (n: number) => Math.round(n * 100) / 100;

/** Platform (marketplace) fee on one list price; 0 when waived. */
export const platformFeeFor = (price: number, coachId: string, fees?: PlanFees) => {
  if (!fees || fees.waived.has(coachId)) return 0;
  return cents((price * fees.platformPerc) / 100);
};

/** Card percent markup on one list price (fixed $0.30 is added once on the checkout total). */
export const processingPercentFor = (price: number, fees?: PlanFees) => {
  if (!fees) return 0;
  return cents((price * fees.stripePerc) / 100);
};

/** Per-line percent markup. The fixed fee is added once on dueNow / ifAccepted. */
export const feeFor = (price: number, coachId: string, fees?: PlanFees) =>
  cents(platformFeeFor(price, coachId, fees) + processingPercentFor(price, fees));

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
  const platformFees = cents(paid.reduce((n, s) => n + platformFeeFor(s.price, s.coachId, fees), 0));
  const feeTotal = cents(paid.reduce((n, s) => n + fee(s), 0));
  const fixed = Math.max(0, fees?.stripeFixed ?? 0);
  const processingFees = cents(feeTotal - platformFees + (paid.length ? fixed : 0));
  const requestPlatform = cents(requests.reduce((n, s) => n + platformFeeFor(s.price, s.coachId, fees), 0));
  const requestFeeTotal = cents(requests.reduce((n, s) => n + fee(s), 0));
  const requestSub = cents(requests.reduce((n, s) => n + s.price + fee(s), 0));
  return {
    instant,
    requests,
    direct,
    covered,
    availableCredits,
    /** Fee on one time if it's paid in the app now (0 for credits, requests and pay-direct). */
    feeOf: (s: S) => (instant.includes(s) && !covered.has(s.id) ? fee(s) : 0),
    subtotal,
    /** Marketplace fee only (10% when not waived). */
    platformFees,
    /** Card processing: percent on each paid line + fixed once. */
    processingFees,
    /** @deprecated Prefer platformFees + processingFees. Sum of percent fees only (no fixed). */
    fees: feeTotal,
    dueNow: cents(subtotal + feeTotal + (paid.length ? fixed : 0)),
    ifAccepted: cents(requestSub + (requests.length ? fixed : 0)),
    requestPlatformFees: requestPlatform,
    requestProcessingFees: cents(requestFeeTotal - requestPlatform + (requests.length ? fixed : 0)),
    payDirect: sum(direct),
  };
};
