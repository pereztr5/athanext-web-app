import { describe, expect, it } from "vitest";
import { planBooking } from "../bookPlan";

const s = (id: string, coachId: string, date: string, price = 50) => ({ id, coachId, price, date, startTime: "16:00:00" });
const coaches = {
  a: { id: "a", needsRequest: false, paysDirect: false, credits: 1 },
  b: { id: "b", needsRequest: true, paysDirect: false, credits: 0 },
  c: { id: "c", needsRequest: false, paysDirect: true, credits: 0 },
};

describe("planBooking", () => {
  const picked = [s("a2", "a", "2026-10-12"), s("a1", "a", "2026-10-10"), s("b1", "b", "2026-10-11", 70), s("c1", "c", "2026-10-11", 40)];

  it("splits by how each coach is paid and uses credits on the earliest times", () => {
    const p = planBooking(picked, coaches, true);
    expect(p.instant.map((x) => x.id)).toEqual(["a2", "a1"]);
    expect([...p.covered]).toEqual(["a1"]);
    expect([p.dueNow, p.ifAccepted, p.payDirect, p.availableCredits]).toEqual([50, 70, 40, 1]);
  });

  it("charges every paid session when credits are off", () => {
    expect(planBooking(picked, coaches, false).dueNow).toBe(100);
  });

  it("adds fees to paid times only, and skips the platform fee for waived coaches", () => {
    const fees = { platformPerc: 10, stripePerc: 3, waived: new Set<string>() };
    const p = planBooking(picked, coaches, true, fees);
    expect([p.subtotal, p.fees, p.dueNow, p.ifAccepted]).toEqual([50, 6.5, 56.5, 79.1]);
    expect(p.feeOf(picked[1])).toBe(0);
    const w = planBooking(picked, coaches, false, { ...fees, waived: new Set(["a"]) });
    expect([w.fees, w.dueNow]).toEqual([3, 103]);
  });
});
