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

export type MoneyKind = "session" | "package" | "camp" | "invoice";
/** "in_app": paid through AthaNext. "direct": paid to the coach (cash, Zelle, Venmo, marked paid). */
export type MoneyChannel = "in_app" | "direct";

/** One payment the coach received (get_coach_payments `money_in`), each payment once. */
export interface MoneyInItem {
  id: string;
  kind: MoneyKind;
  channel: MoneyChannel;
  /** A family the coach brought to AthaNext (no marketplace fee). */
  own: boolean;
  /** When it was paid: an ISO timestamp, or the session day (YYYY-MM-DD) for sessions paid directly. */
  date: string;
  /** What the coach receives (list price share, no fees). */
  amount: number;
  athlete: string;
  family: string;
  service: string;
}

export interface Client {
  athleteId: string;
  athlete: string;
  family: string;
}

/** One line in "Invoices and payments": an invoice, or a payment received (in the app or directly). */
export interface PaymentRow {
  key: string;
  invoice: Invoice | null;
  family: string;
  athlete: string;
  service: string;
  /** Due date for invoices, paid date for payments (YYYY-MM-DD). */
  date: string;
  amount: number;
  status: "paid_in_app" | "paid_direct" | "paid" | "overdue" | "pending" | "void";
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
  paid_direct: "Paid directly",
  paid: "Paid",
  overdue: "Overdue",
  pending: "Pending",
  void: "Void",
};

/**
 * Money in from an older get_coach_payments without `money_in`: sessions paid in the app and
 * paid invoices, as before.
 */
export const legacyMoneyIn = (invoices: Invoice[], inApp: InAppPayment[]): MoneyInItem[] => [
  ...inApp.map((p) => ({
    id: `session:${p.bookingId}`,
    kind: "session" as const,
    channel: "in_app" as const,
    own: p.own,
    date: p.date,
    amount: p.amount,
    athlete: p.athlete,
    family: p.family,
    service: p.service,
  })),
  ...invoices
    .filter((i) => i.status === "paid" && i.paidAt)
    .map((i) => ({
      id: `invoice:${i.id}`,
      kind: "invoice" as const,
      channel: i.paidMethod === "card" ? ("in_app" as const) : ("direct" as const),
      own: true,
      date: i.paidAt!,
      amount: i.amount,
      athlete: i.athlete,
      family: i.family,
      service: i.service,
    })),
];

/** Invoices plus every other payment received (invoice payments show on their invoice), newest first. */
export const paymentRows = (invoices: Invoice[], moneyIn: MoneyInItem[], today: string, toDay: (iso: string) => string): PaymentRow[] =>
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
    ...moneyIn
      .filter((p) => p.kind !== "invoice")
      .map((p) => ({
        key: p.id,
        invoice: null,
        family: p.family,
        athlete: p.athlete,
        service: p.service,
        date: toDay(p.date),
        amount: p.amount,
        status: p.channel === "direct" ? ("paid_direct" as const) : ("paid_in_app" as const),
      })),
  ].sort((a, b) => b.date.localeCompare(a.date));

/** `gear` marks the coach's share of gear sales ("Gear and deals"). */
export type MoneyEntry = { day: string; amount: number; own: boolean; channel?: MoneyChannel; gear?: boolean };

/** Money in by day: every payment received, in the app or directly. */
export const moneyEntries = (moneyIn: MoneyInItem[], toDay: (iso: string) => string): MoneyEntry[] =>
  moneyIn.map((p) => ({ day: toDay(p.date), amount: p.amount, own: p.own, channel: p.channel }));

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
  const sum = (keep: (e: MoneyEntry) => boolean) => inRange.filter(keep).reduce((s, e) => s + e.amount, 0);
  const inApp = (e: MoneyEntry) => !e.gear && e.channel !== "direct";
  // Each entry lands in exactly one part, so the parts add up to the total.
  return {
    days,
    total: sum(() => true),
    own: sum((e) => inApp(e) && e.own),
    marketplace: sum((e) => inApp(e) && !e.own),
    direct: sum((e) => !e.gear && e.channel === "direct"),
    gear: sum((e) => Boolean(e.gear)),
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
