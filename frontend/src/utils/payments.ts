/**
 * Coach Payments (ATH-89): invoices, money in and the CSV export.
 */

export interface Invoice {
  id: string;
  athleteId: string | null;
  family: string;
  athlete: string;
  service: string;
  amount: number;
  due: string;
  note: string | null;
  status: "open" | "paid" | "void";
  paidAt: string | null;
  paidMethod: "card" | "outside" | null;
  reminders: number;
  createdAt: string;
}

export interface InAppPayment {
  bookingId: string;
  athlete: string;
  family: string;
  service: string;
  /** When the family paid (ISO timestamp). */
  date: string;
  amount: number;
  /** A family the coach brought to AthaNext (no marketplace fee). */
  own: boolean;
}

export interface Client {
  athleteId: string;
  athlete: string;
  family: string;
}

/** One line in "Invoices and payments": an invoice, or a session paid in the app. */
export interface PaymentRow {
  key: string;
  invoice: Invoice | null;
  family: string;
  athlete: string;
  service: string;
  /** Due date for invoices, paid date for in-app payments (YYYY-MM-DD). */
  date: string;
  amount: number;
  status: "paid_in_app" | "paid" | "overdue" | "pending" | "void";
}

export const MAX_REMINDERS = 3;

export const money = (value: number) =>
  Math.round(value * 100) % 100
    ? `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${Math.round(value).toLocaleString("en-US")}`;

export const isOverdue = (invoice: Pick<Invoice, "status" | "due">, today: string) => invoice.status === "open" && invoice.due < today;

export const outstanding = (invoices: Invoice[]) => invoices.filter((i) => i.status === "open");

export const statusOf = (invoice: Invoice, today: string): PaymentRow["status"] =>
  invoice.status === "paid" ? "paid" : invoice.status === "void" ? "void" : isOverdue(invoice, today) ? "overdue" : "pending";

export const STATUS_LABEL: Record<PaymentRow["status"], string> = {
  paid_in_app: "Paid in app",
  paid: "Paid",
  overdue: "Overdue",
  pending: "Pending",
  void: "Void",
};

/** Invoices and in-app payments, newest first. */
export const paymentRows = (invoices: Invoice[], inApp: InAppPayment[], today: string, toDay: (iso: string) => string): PaymentRow[] =>
  [
    ...invoices.map((i) => ({
      key: `inv-${i.id}`,
      invoice: i,
      family: i.family,
      athlete: i.athlete,
      service: i.service,
      date: i.due,
      amount: i.amount,
      status: statusOf(i, today),
    })),
    ...inApp.map((p) => ({
      key: `bk-${p.bookingId}`,
      invoice: null,
      family: p.family,
      athlete: p.athlete,
      service: p.service,
      date: toDay(p.date),
      amount: p.amount,
      status: "paid_in_app" as const,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

/** `gear` marks the coach's share of gear sales ("Gear and deals"). */
export type MoneyEntry = { day: string; amount: number; own: boolean; gear?: boolean };

/** Money in: in-app payments plus invoices marked or paid, by day. */
export const moneyEntries = (invoices: Invoice[], inApp: InAppPayment[], toDay: (iso: string) => string): MoneyEntry[] => [
  ...inApp.map((p) => ({ day: toDay(p.date), amount: p.amount, own: p.own })),
  ...invoices.filter((i) => i.status === "paid" && i.paidAt).map((i) => ({ day: toDay(i.paidAt!), amount: i.amount, own: true })),
];

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Daily totals for the `n` days ending `end`, plus the previous `n` days' total. */
export const moneySeries = (entries: MoneyEntry[], n: number, end: string) => {
  const start = addDays(end, -(n - 1));
  const prevStart = addDays(start, -n);
  const days = Array.from({ length: n }, (_, i) => addDays(start, i)).map((day) => ({
    day,
    amount: entries.filter((e) => e.day === day).reduce((s, e) => s + e.amount, 0),
  }));
  const inRange = entries.filter((e) => e.day >= start && e.day <= end);
  return {
    days,
    total: inRange.reduce((s, e) => s + e.amount, 0),
    own: inRange.filter((e) => e.own && !e.gear).reduce((s, e) => s + e.amount, 0),
    marketplace: inRange.filter((e) => !e.own && !e.gear).reduce((s, e) => s + e.amount, 0),
    gear: inRange.filter((e) => e.gear).reduce((s, e) => s + e.amount, 0),
    previous: entries.filter((e) => e.day >= prevStart && e.day < start).reduce((s, e) => s + e.amount, 0),
  };
};

const csvCell = (value: string | number) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const paymentsCsv = (rows: PaymentRow[]) =>
  [
    ["Date", "Family", "Athlete", "For", "Amount", "Status"],
    ...rows.map((r) => [r.date, r.family, r.athlete, r.service, r.amount.toFixed(2), STATUS_LABEL[r.status]]),
  ]
    .map((line) => line.map(csvCell).join(","))
    .join("\n");
