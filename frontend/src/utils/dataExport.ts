/** Rows for the Privacy and safety PDF. Callers pass already-readable strings. */

export type PdfSection = {
  title: string;
  columns: string[];
  rows: string[][];
};

const cell = (value: unknown): string => {
  if (value == null || value === "") return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(cell).filter(Boolean).join(", ");
  return "";
};

/** One section. An empty list stays empty so the PDF can say there is nothing saved. */
export const pdfSection = (title: string, rows: Record<string, unknown>[]): PdfSection => {
  const columns = rows[0] ? Object.keys(rows[0]) : [];
  return {
    title,
    columns,
    rows: rows.map((row) => columns.map((column) => cell(row[column]))),
  };
};

export const dollarsFromCents = (cents: unknown) =>
  typeof cents === "number" && Number.isFinite(cents) ? `$${(cents / 100).toFixed(2)}` : "";

/** "Tue, Nov 24, 2026" from a stored "2026-11-24" session date (no time zone shift). */
export const exportDate = (isoDate: unknown): string => {
  if (typeof isoDate !== "string") return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return "";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
};

/** "4:00 PM ET" from a stored "16:00:00". Sessions are saved in Eastern time. */
export const exportTime = (time: unknown): string => {
  if (typeof time !== "string") return "";
  const m = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!m) return "";
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "AM" : "PM"} ET`;
};

/** "Nov 24, 2026" for a timestamp (when something was saved or added). */
export const exportDay = (timestamp: unknown): string => {
  if (typeof timestamp !== "string" || !timestamp) return "";
  const d = new Date(timestamp);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const STATUS_LABELS: Record<string, string> = {
  booked: "Booked",
  completed: "Completed",
  canceled: "Cancelled",
  cancelled: "Cancelled",
  pending_payment: "Awaiting payment",
  requested: "Requested",
  no_show: "No-show",
  expired: "Expired",
};

const PAYMENT_LABELS: Record<string, string> = {
  paid: "Paid by card",
  credit: "Session credit",
  outside: "Free or paid outside the app",
  direct: "Paid to the coach",
  pending_offline: "Paying the coach directly",
  unpaid: "Not paid",
  authorized: "Card held",
  released: "Card hold released",
  refunded: "Refunded",
  disputed: "Disputed",
  camp: "Part of a camp",
};

const humanize = (value: unknown) =>
  typeof value === "string" && value ? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ") : "";

export const bookingStatusLabel = (status: unknown) => (typeof status === "string" && STATUS_LABELS[status]) || humanize(status);
export const paymentStatusLabel = (status: unknown) => (typeof status === "string" && PAYMENT_LABELS[status]) || humanize(status);

type BookingExportRow = {
  status?: unknown;
  payment_status?: unknown;
  occurrence?: { occurrence_date?: unknown; start_time?: unknown; session_name?: unknown; location?: unknown } | null;
  coach?: { name?: unknown } | null;
  athlete?: { full_name?: unknown } | null;
};

/** One Bookings row: session date and time, who it is with, status and payment, earliest first. */
export const bookingExportRows = (rows: BookingExportRow[], withWhom: "coach" | "athlete") =>
  [...rows]
    .sort((a, b) =>
      `${a.occurrence?.occurrence_date ?? ""}${a.occurrence?.start_time ?? ""}`.localeCompare(
        `${b.occurrence?.occurrence_date ?? ""}${b.occurrence?.start_time ?? ""}`
      )
    )
    .map((row) => ({
      Date: exportDate(row.occurrence?.occurrence_date),
      Time: exportTime(row.occurrence?.start_time),
      Session: row.occurrence?.session_name ?? "",
      [withWhom === "coach" ? "Coach" : "Athlete"]:
        (withWhom === "coach" ? row.coach?.name : row.athlete?.full_name) ?? "",
      Status: bookingStatusLabel(row.status),
      Payment: paymentStatusLabel(row.payment_status),
    }));

/** What each data PDF contains, shown on the download card. */
export const ATHLETE_EXPORT_CONTENTS =
  "The PDF has the account (name, email, phone), the athlete (name, birthday), every booking (session date and time in Eastern time, coach, status, payment), session notes (coach's note, your rating and review, coach's reply) and coaches (name, status, when added).";
export const COACH_EXPORT_CONTENTS =
  "The PDF has your profile (name, email, title, locations, Instagram), account (name, email, phone), packages, sessions you scheduled, every booking (session date and time in Eastern time, athlete, status, payment), clients (athlete, contact name, email, status, when added) and reviews.";
