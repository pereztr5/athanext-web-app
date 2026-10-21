import { describe, expect, it } from "vitest";
import { planBooking, sessionFees, type PlanFees } from "../bookPlan";
import { checkoutFees } from "../fees";

const s = (id: string, coachId: string, date: string, price = 50) => ({ id, coachId, price, date, startTime: "16:00:00" });
const coaches = {
  a: { id: "a", needsRequest: false, paysDirect: false, credits: 1 },
  b: { id: "b", needsRequest: true, paysDirect: false, credits: 0 },
  c: { id: "c", needsRequest: false, paysDirect: true, credits: 0 },
};
const noFees: PlanFees = { config: { platformPercent: 0, processingPercent: 0, processingFixedCents: 0 }, waived: new Set() };
const fees: PlanFees = { config: { platformPercent: 10, processingPercent: 2.9, processingFixedCents: 30 }, waived: new Set() };

describe("planBooking", () => {
  const picked = [s("a2", "a", "2026-10-12"), s("a1", "a", "2026-10-10"), s("b1", "b", "2026-10-11", 70), s("c1", "c", "2026-10-11", 40)];

  it("splits by how each coach is paid and uses credits on the earliest times", () => {
    const p = planBooking(picked, coaches, true, noFees);
    expect(p.instant.map((x) => x.id)).toEqual(["a2", "a1"]);
    expect([...p.covered]).toEqual(["a1"]);
    expect([p.dueNow, p.ifAccepted, p.payDirect, p.availableCredits]).toEqual([50, 70, 40, 1]);
  });

  it("charges every paid session when credits are off", () => {
    expect(planBooking(picked, coaches, false, noFees).dueNow).toBe(100);
  });

  it("uses the shared fee math: platform fee, then card processing grossed up once per Checkout", () => {
    const p = planBooking(picked, coaches, true, fees);
    // One paid $50: $5 platform fee, ($55 + $0.30) / 0.971 = $56.95
    expect([p.subtotal, p.platformFees, p.processingFees, p.dueNow]).toEqual([50, 5, 1.95, 56.95]);
    // Request $70: ($70 + $7 + $0.30) / 0.971 = $79.61
    expect(p.ifAccepted).toBe(79.61);
    expect(planBooking([s("a1", "a", "2026-10-10")], coaches, true, fees).dueNow).toBe(0);
  });

  it("skips the platform fee for waived coaches", () => {
    const w = planBooking(picked, coaches, false, { ...fees, waived: new Set(["a"]) });
    expect([w.platformFees, w.dueNow]).toEqual([0, Math.round((10000 + 30) / 0.971) / 100]);
  });

  it("matches what create-booking-payment charges for the same Checkout", () => {
    const p = planBooking(picked, coaches, false, fees);
    const charged = checkoutFees(
      p.instant.map((x) => ({ listCents: x.price * 100, kind: "session" as const })),
      fees.config!
    );
    expect(p.dueNow).toBe(charged.totalCents / 100);
  });

  it("is not ready (no fee amounts) until the rates are loaded", () => {
    const p = planBooking(picked, coaches, false, { config: null, waived: new Set() });
    expect(p.feesReady).toBe(false);
    expect(sessionFees(50, "a", { config: null, waived: new Set() })).toBeNull();
  });
});
