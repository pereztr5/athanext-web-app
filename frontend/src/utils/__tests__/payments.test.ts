import { describe, expect, it } from "vitest";
import { moneyEntries, moneySeries, paymentRows, paymentsCsv, statusOf, type InAppPayment, type Invoice } from "../payments";

const invoice = (over: Partial<Invoice>): Invoice => ({
  id: "i1",
  athleteId: "a1",
  family: "Lee family",
  athlete: "Ava Lee",
  service: "Individual session",
  amount: 90,
  due: "2026-10-10",
  note: null,
  status: "open",
  paidAt: null,
  paidMethod: null,
  reminders: 0,
  createdAt: "2026-10-01T10:00:00Z",
  ...over,
});

const paid: InAppPayment = {
  bookingId: "b1",
  athlete: "Noah B.",
  family: "Bell, Sam",
  service: "1-on-1",
  date: "2026-10-05T15:00:00Z",
  amount: 70,
  own: false,
};

const day = (iso: string) => iso.slice(0, 10);

describe("payments", () => {
  it("labels invoices", () => {
    expect(statusOf(invoice({}), "2026-10-07")).toBe("pending");
    expect(statusOf(invoice({ due: "2026-10-01" }), "2026-10-07")).toBe("overdue");
    expect(statusOf(invoice({ status: "paid" }), "2026-10-07")).toBe("paid");
  });

  it("mixes invoices and in-app payments, newest first", () => {
    const rows = paymentRows([invoice({})], [paid], "2026-10-07", day);
    expect(rows.map((r) => [r.date, r.status])).toEqual([
      ["2026-10-10", "pending"],
      ["2026-10-05", "paid_in_app"],
    ]);
  });

  it("totals money in by source and compares with the previous period", () => {
    const entries = moneyEntries([invoice({ status: "paid", paidAt: "2026-10-06T09:00:00Z" })], [paid, { ...paid, date: "2026-09-29T10:00:00Z" }], day);
    const s = moneySeries(entries, 7, "2026-10-07");
    expect(s.days).toHaveLength(7);
    expect([s.total, s.own, s.marketplace, s.previous]).toEqual([160, 90, 70, 70]);
  });

  it("exports a CSV with quoted cells", () => {
    const csv = paymentsCsv(paymentRows([], [paid], "2026-10-07", day));
    expect(csv.split("\n")[1]).toBe('2026-10-05,"Bell, Sam",Noah B.,1-on-1,70.00,Paid in app');
  });
});
