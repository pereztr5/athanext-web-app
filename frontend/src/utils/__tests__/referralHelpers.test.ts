import { describe, expect, it } from "vitest";
import {
  bookedOnlyCoaches, claimErrorMessage, computeSessionPrice, referralStatusLabel,
} from "../referralHelpers";

// What create-booking-payment sends to Stripe for one session, in dollars.
const stripeCharge = (price: number, platformPerc: number, stripePerc: number) =>
  Math.round(price * (1 + platformPerc / 100 + stripePerc / 100) * 100) / 100;

describe("computeSessionPrice", () => {
  it("applies platform and stripe fees", () => {
    const p = computeSessionPrice(100, 10, 2.9);
    expect(p).toEqual({ base: 100, platformFee: 10, stripeFee: 2.9, total: 112.9 });
  });

  it("zeroes only the platform fee when waived", () => {
    const p = computeSessionPrice(100, 10, 2.9, true);
    expect(p).toEqual({ base: 100, platformFee: 0, stripeFee: 2.9, total: 102.9 });
  });

  it("always shows exactly what Stripe charges", () => {
    for (const price of [33.33, 10.05, 45, 59.99, 0.5, 120.35, 7.77]) {
      for (const waived of [false, true]) {
        const p = computeSessionPrice(price, 10, 2.9, waived);
        expect(p.total).toBe(stripeCharge(price, waived ? 0 : 10, 2.9));
        expect(Number((p.base + p.platformFee + p.stripeFee).toFixed(2))).toBe(p.total);
      }
    }
  });

  it("handles zero percentages (config missing defaults to 0)", () => {
    expect(computeSessionPrice(50, 0, 0)).toEqual({
      base: 50, platformFee: 0, stripeFee: 0, total: 50,
    });
  });
});

describe("referralStatusLabel", () => {
  const base = { initiated_by: "coach", athlete_id: null, expires_at: null };

  it("marks an unanswered invite past its expiry as expired", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(referralStatusLabel({ ...base, status: "invited", expires_at: past })).toBe("Expired");
  });

  it("does not expire a confirmed relationship", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(
      referralStatusLabel({ ...base, status: "confirmed", athlete_id: "a", expires_at: past }),
    ).toBe("Confirmed");
  });
});

describe("claimErrorMessage", () => {
  it("maps server error keys to readable copy", () => {
    expect(claimErrorMessage("email_mismatch")).toMatch(/different email/);
    expect(claimErrorMessage("boom")).toMatch(/try again/);
  });
});

describe("bookedOnlyCoaches", () => {
  const session = (coachId: string, extra: Record<string, unknown> = {}) => ({
    coachId, coachName: `Coach ${coachId}`, dbStatus: "booked", computedStatus: "upcoming", ...extra,
  });

  it("lists each booked coach once, in first-seen order", () => {
    expect(bookedOnlyCoaches([session("b"), session("a"), session("b")], [])).toEqual([
      { coachId: "b", coachName: "Coach b" },
      { coachId: "a", coachName: "Coach a" },
    ]);
  });

  it("skips canceled, refunded, unpaid and unaccepted bookings", () => {
    const sessions = [
      session("a", { dbStatus: "canceled" }),
      session("b", { computedStatus: "canceled" }),
      session("c", { dbStatus: "refunded" }),
      session("d", { dbStatus: "pending_payment", computedStatus: "past" }),
      session("e", { dbStatus: "requested" }),
      session("f", { dbStatus: "booked", computedStatus: "past" }),
    ];
    expect(bookedOnlyCoaches(sessions, []).map((c) => c.coachId)).toEqual(["f"]);
  });

  it("lets pending or confirmed referrals win, but not declined ones", () => {
    const referrals = [
      { coach_id: "a", status: "confirmed" as const },
      { coach_id: "b", status: "pending_confirmation" as const },
      { coach_id: "c", status: "declined" as const },
    ];
    const sessions = [session("a"), session("b"), session("c")];
    expect(bookedOnlyCoaches(sessions, referrals).map((c) => c.coachId)).toEqual(["c"]);
  });

  it("fills a missing name from a later booking", () => {
    expect(bookedOnlyCoaches([session("a", { coachName: null }), session("a")], [])).toEqual([
      { coachId: "a", coachName: "Coach a" },
    ]);
  });
});
