import { describe, expect, it } from "vitest";
import { campDayTitle, campMoneySummary, campSignedUpLine, isCampBooking } from "@/utils/campSessions";

describe("camp sessions", () => {
  it("labels a camp day", () => {
    expect(campDayTitle("Thanksgiving Camp", 2)).toBe("Camp · Thanksgiving Camp · Day 2");
    expect(campDayTitle("  ", 1)).toBe("Camp · Camp · Day 1");
    expect(campDayTitle("Winter Camp", null)).toBe("Camp · Winter Camp");
    expect(campDayTitle("Winter Camp", 0)).toBe("Camp · Winter Camp");
  });

  it("knows camp bookings", () => {
    expect(isCampBooking("camp")).toBe(true);
    expect(isCampBooking("paid")).toBe(false);
    expect(isCampBooking(undefined)).toBe(false);
  });

  it("sums camp money without cancelled or unpaid checkouts", () => {
    const now = new Date("2026-10-24T15:00:00Z");
    const summary = campMoneySummary(
      [
        { status: "paid", pay_method: "card", price_cents: 49900, created_at: "2026-10-02T12:00:00Z" },
        { status: "paid", pay_method: "direct", price_cents: 45000, created_at: "2026-09-20T12:00:00Z" },
        { status: "paid", pay_method: "outside", price_cents: 10050, created_at: "2026-10-10T12:00:00Z" },
        { status: "held", pay_method: "direct", price_cents: 45000, created_at: "2026-10-20T12:00:00Z" },
        { status: "cancelled", pay_method: "card", price_cents: 49900, created_at: "2026-10-03T12:00:00Z" },
        { status: "expired", pay_method: "direct", price_cents: 45000, created_at: "2026-10-04T12:00:00Z" },
        { status: "pending_payment", pay_method: "card", price_cents: 49900, created_at: "2026-10-05T12:00:00Z" },
      ],
      now
    );
    expect(summary).toEqual({
      registrationsThisMonth: 3,
      paidInApp: 499,
      paidDirect: 550.5,
      toCollect: 450,
      toCollectCount: 1,
    });
  });

  it("counts the month on the Eastern clock", () => {
    // 01:00 UTC on Nov 1 is still Oct 31 in New York.
    const summary = campMoneySummary(
      [{ status: "paid", pay_method: "card", price_cents: 100, created_at: "2026-11-01T01:00:00Z" }],
      new Date("2026-10-31T20:00:00Z")
    );
    expect(summary.registrationsThisMonth).toBe(1);
    expect(campMoneySummary([], new Date()).paidInApp).toBe(0);
  });
});

describe("campSignedUpLine", () => {
  it("names the camp, the day and the group with its time", () => {
    expect(
      campSignedUpLine({ name: "Thanksgiving Camp", dayIndex: 2, daysTotal: 5, groupName: "Under 12s" }, "4:00 to 5:30 pm ET"),
    ).toEqual({ title: "You're signed up for Thanksgiving Camp, Day 2 of 5", detail: "Under 12s · 4:00 to 5:30 pm ET" });
  });

  it("copes with missing parts", () => {
    expect(campSignedUpLine({ name: "Camp X", dayIndex: 3, daysTotal: null })).toEqual({
      title: "You're signed up for Camp X, Day 3",
      detail: null,
    });
    expect(campSignedUpLine({ name: " ", dayIndex: null, daysTotal: null }, "9:00 am to 12:00 pm ET")).toEqual({
      title: "You're signed up for this camp",
      detail: "9:00 am to 12:00 pm ET",
    });
  });
});
