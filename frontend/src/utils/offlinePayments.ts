/**
 * My Business "Offline payments": money paid to the coach directly (cash, Zelle, Venmo, or
 * outside the app), kept apart from in-app earnings. Data from get_coach_offline_payments()
 * (20261023110000_coach_offline_payments.sql).
 */
export interface OfflineWaiting {
  bookingId: string;
  occurrenceId: string;
  athleteName: string;
  payerName: string;
  occurrenceDate: string;
  startTime: string;
  sessionName: string;
  amount: number;
  sessionDone: boolean;
}

export interface OfflinePaid {
  id: string;
  kind: "session" | "camp";
  name: string;
  athleteName: string;
  paidOn: string;
  amount: number;
}

export interface OfflinePaymentsSummary {
  waiting: OfflineWaiting[];
  paidMonth: number;
  paidTotal: number;
  recent: OfflinePaid[];
}

type Row = Record<string, unknown>;

const num = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const rows = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : []);

export const toOfflineSummary = (raw: unknown): OfflinePaymentsSummary => {
  const data = (raw ?? {}) as Row;
  return {
    waiting: rows(data.waiting).map((row) => ({
      bookingId: String(row.booking_id),
      occurrenceId: String(row.occurrence_id ?? ""),
      athleteName: String(row.athlete_name || "Athlete"),
      payerName: String(row.payer_name || row.athlete_name || "Family"),
      occurrenceDate: String(row.occurrence_date ?? ""),
      startTime: String(row.start_time ?? ""),
      sessionName: String(row.session_name || "Session"),
      amount: num(row.amount),
      sessionDone: Boolean(row.session_done),
    })),
    paidMonth: num(data.paid_month),
    paidTotal: num(data.paid_total),
    recent: rows(data.recent).map((row) => ({
      id: String(row.id),
      kind: row.kind === "camp" ? "camp" : "session",
      name: String(row.name || (row.kind === "camp" ? "Camp" : "Session")),
      athleteName: String(row.athlete_name || "Athlete"),
      paidOn: String(row.paid_on ?? ""),
      amount: num(row.amount),
    })),
  };
};

/** "Maria for Leo" when a parent pays for their athlete, else just the name. */
export const payerLine = (row: Pick<OfflineWaiting, "payerName" | "athleteName">) =>
  row.payerName !== row.athleteName ? `${row.payerName} for ${row.athleteName.split(" ")[0]}` : row.athleteName;

/** Toast copy when Mark as paid fails; the free plan lock gets its own words. */
export const markPaidError = (err: unknown): { title: string; description: string; planEnded: boolean } => {
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (/free plan has ended/i.test(message)) {
    return { title: "Your free plan has ended", description: "Subscribe in Plan settings to mark payments as paid.", planEnded: true };
  }
  return { title: "Couldn't mark as paid", description: message || "Try again.", planEnded: false };
};
