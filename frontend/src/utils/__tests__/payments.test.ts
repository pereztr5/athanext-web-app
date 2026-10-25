import { describe, expect, it } from "vitest";
import { legacyMoneyIn, moneyEntries, moneySeries, paymentRows, paymentsCsv, statusOf, type InAppPayment, type Invoice, type MoneyInItem } from "../payments";

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

const item = (over: Partial<MoneyInItem>): MoneyInItem => ({
  id: "session:b1",
  kind: "session",
  channel: "in_app",
  own: false,
  date: "2026-10-05T15:00:00Z",
  amount: 70,
  athlete: "Noah B.",
  family: "Bell, Sam",
  service: "1-on-1",
  ...over,
});

const day = (iso: string) => iso.slice(0, 10);

describe("payments", () => {
  it("labels invoices", () => {
    expect(statusOf(invoice({}), "2026-10-07")).toBe("pending");
    expect(statusOf(invoice({ due: "2026-10-01" }), "2026-10-07")).toBe("overdue");
    expect(statusOf(invoice({ status: "paid" }), "2026-10-07")).toBe("paid");
  });

  it("mixes invoices and payments received, newest first; invoice payments stay on their invoice", () => {
    const rows = paymentRows(
      [invoice({})],
      [
        item({}),
        item({ id: "camp:r1", kind: "camp", channel: "direct", date: "2026-10-03T12:00:00Z" }),
        item({ id: "invoice:i1", kind: "invoice", channel: "direct", date: "2026-10-06T12:00:00Z" }),
      ],
      "2026-10-07",
      day
    );
    expect(rows.map((r) => [r.date, r.status])).toEqual([
      ["2026-10-10", "pending"],
      ["2026-10-05", "paid_in_app"],
      ["2026-10-03", "paid_direct"],
    ]);
  });

  it("totals every kind of money in, splits it once, and compares with the previous period", () => {
    const moneyIn = [
      item({}), // marketplace session, in the app
      item({ id: "session:b0", date: "2026-09-29T10:00:00Z" }), // previous period
      item({ id: "package:p1", kind: "package", own: true, amount: 300, date: "2026-10-02T10:00:00Z" }),
      item({ id: "camp:r1", kind: "camp", own: true, amount: 1, date: "2026-10-06T14:15:12Z" }),
      item({ id: "camp:r2", kind: "camp", channel: "direct", own: true, amount: 150, date: "2026-10-04T09:00:00Z" }),
      item({ id: "session:b2", channel: "direct", own: true, amount: 60, date: "2026-10-07" }),
      item({ id: "invoice:i1", kind: "invoice", channel: "direct", own: true, amount: 90, date: "2026-10-06T09:00:00Z" }),
      item({ id: "invoice:i2", kind: "invoice", own: true, amount: 40, date: "2026-10-06T09:00:00Z" }),
    ];
    const entries = [...moneyEntries(moneyIn, day), { day: "2026-10-07", amount: 5, own: false, gear: true }];
    const s = moneySeries(entries, 7, "2026-10-07");
    expect(s.days).toHaveLength(7);
    expect(s.days.find((d) => d.day === "2026-10-06")?.amount).toBe(131);
    expect([s.total, s.own, s.marketplace, s.direct, s.gear, s.previous]).toEqual([716, 341, 70, 300, 5, 70]);
    expect(s.own + s.marketplace + s.direct + s.gear).toBe(s.total);
  });

  it("falls back to sessions paid in the app and paid invoices without money_in", () => {
    const legacy = legacyMoneyIn(
      [invoice({ status: "paid", paidAt: "2026-10-06T09:00:00Z", paidMethod: "outside" }), invoice({ id: "i2" })],
      [paid]
    );
    expect(legacy.map((m) => [m.id, m.kind, m.channel])).toEqual([
      ["session:b1", "session", "in_app"],
      ["invoice:i1", "invoice", "direct"],
    ]);
  });

  it("exports a CSV with quoted cells", () => {
    const csv = paymentsCsv(paymentRows([], [item({}), item({ id: "camp:r2", kind: "camp", channel: "direct", date: "2026-10-04" })], "2026-10-07", day));
    expect(csv.split("\n").slice(1)).toEqual([
      '2026-10-05,"Bell, Sam",Noah B.,1-on-1,70.00,Paid in app',
      '2026-10-04,"Bell, Sam",Noah B.,1-on-1,70.00,Paid directly',
    ]);
  });
});
