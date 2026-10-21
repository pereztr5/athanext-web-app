import { describe, expect, it } from "vitest";
import {
  bookedOnlyCoaches, claimErrorMessage, referralStatusLabel,
} from "../referralHelpers";

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
