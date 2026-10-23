import { describe, expect, it } from "vitest";
import { markPaidError, payerLine, toOfflineSummary } from "@/utils/offlinePayments";

describe("offline payments", () => {
  it("maps the RPC result", () => {
    const summary = toOfflineSummary({
      waiting: [
        {
          booking_id: "b1",
          occurrence_id: "o1",
          athlete_name: "Leo Park",
          payer_name: "Maria Park",
          occurrence_date: "2026-10-20",
          start_time: "16:00:00",
          session_name: "Finishing",
          amount: "45.00",
          session_done: true,
        },
      ],
      paid_month: "120.5",
      paid_total: 300,
      recent: [
        { id: "r1", kind: "camp", name: "Winter camp", athlete_name: "Ava Lee", paid_on: "2026-10-18", amount: 150 },
        { id: "r2", kind: "session", name: null, athlete_name: null, paid_on: "2026-10-01", amount: "30" },
      ],
    });
    expect(summary.waiting[0]).toMatchObject({ bookingId: "b1", payerName: "Maria Park", amount: 45, sessionDone: true });
    expect(summary.paidMonth).toBe(120.5);
    expect(summary.paidTotal).toBe(300);
    expect(summary.recent).toEqual([
      { id: "r1", kind: "camp", name: "Winter camp", athleteName: "Ava Lee", paidOn: "2026-10-18", amount: 150 },
      { id: "r2", kind: "session", name: "Session", athleteName: "Athlete", paidOn: "2026-10-01", amount: 30 },
    ]);
  });

  it("is empty when there is nothing", () => {
    expect(toOfflineSummary(null)).toEqual({ waiting: [], paidMonth: 0, paidTotal: 0, recent: [] });
  });

  it("names the payer and the athlete", () => {
    expect(payerLine({ payerName: "Maria Park", athleteName: "Leo Park" })).toBe("Maria Park for Leo");
    expect(payerLine({ payerName: "Leo Park", athleteName: "Leo Park" })).toBe("Leo Park");
  });

  it("explains the free plan lock", () => {
    expect(markPaidError(new Error("Your free plan has ended. Subscribe at $29/month to keep using coach tools."))).toEqual({
      title: "Your free plan has ended",
      description: "Subscribe in Plan settings to mark payments as paid.",
      planEnded: true,
    });
    expect(markPaidError(new Error("Offline payment not found"))).toEqual({
      title: "Couldn't mark as paid",
      description: "Offline payment not found",
      planEnded: false,
    });
    expect(markPaidError(undefined).description).toBe("Try again.");
  });
});
