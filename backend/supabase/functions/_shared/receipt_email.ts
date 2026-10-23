// Booking confirmation and receipt emails for the family. Pure, so it is tested.
//
// send-booking-notifications uses familyPaymentLine for the "You're booked" email, and
// receiptEmail when the family taps "Resend receipt" on the confirmation page. The receipt
// rows are what get_booking_receipt() returns (the same data the page shows).
import { formatSessionWhen } from "./session_time.ts";

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const usd = (n: number) => `$${Number(n).toFixed(2).replace(/\.00$/, "")}`;

/**
 * How the session was paid, in the family's words (HTML). `amount` is the price, or what was
 * charged; `creditNote` adds the cancellation note to a card payment.
 */
export const familyPaymentLine = (paymentStatus: string, amount: number, coachName: string, creditNote = true) => {
  if (paymentStatus === "credit") return "Paid with a session credit.";
  if (paymentStatus === "outside") return amount > 0 ? "Paid outside the app, as agreed with your coach." : "This session is free.";
  if (paymentStatus === "direct" || paymentStatus === "pending_offline") {
    return `Pay ${escapeHtml(coachName)} directly${amount > 0 ? `: ${usd(amount)}` : ""}.`;
  }
  return `Paid: ${usd(amount)}.${creditNote ? " Cancel with enough notice and it comes back as a session credit." : ""}`;
};

/** Most bookings one resend may cover (one checkout). */
export const MAX_RESEND_BOOKINGS = 20;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The receipt to resend: a Stripe Checkout id, or the booking ids on the page. Any address in
 * the body is ignored; the email only goes to the account's own address.
 */
export const parseResendRequest = (
  body: unknown,
): { stripeSessionId: string | null; bookingIds: string[] } | null => {
  const b = (body ?? {}) as { stripe_session_id?: unknown; booking_ids?: unknown };
  const stripeSessionId = typeof b.stripe_session_id === "string" && b.stripe_session_id.trim() ? b.stripe_session_id.trim() : null;
  const raw = Array.isArray(b.booking_ids) ? b.booking_ids : [];
  if (raw.some((id) => typeof id !== "string" || !UUID.test(id))) return null;
  const bookingIds = [...new Set(raw as string[])];
  if (bookingIds.length > MAX_RESEND_BOOKINGS) return null;
  if (!stripeSessionId && !bookingIds.length) return null;
  return { stripeSessionId, bookingIds };
};

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

export interface ReceiptData {
  receipt_number?: string | null;
  bookings?: Row[] | null;
}

const isRequest = (b: Row) => b.status === "requested";
const isCardPaid = (b: Row) => !isRequest(b) && (b.payment_status === "paid" || b.status === "pending_payment");

const sessionTitle = (b: Row) => {
  const coach = String(b.coach?.name ?? "").trim() || "your coach";
  const what =
    b.session_type === "group"
      ? b.session_name || "Group session"
      : b.pillar
        ? `${b.pillar} session`
        : b.session_name || "1-on-1 session";
  return `${what} with ${coach}`;
};

const place = (b: Row) =>
  String(b.location ?? "").toLowerCase() === "online" ? "Video call" : String(b.place ?? "").trim() || "In person";

/**
 * Subject and HTML for a receipt (something paid in the app or with credits) or a confirmation.
 * Times are shown in `timeZone` (the family's; Eastern when missing).
 */
export const receiptEmail = (data: ReceiptData, timeZone?: string | null) => {
  const bookings = data.bookings ?? [];
  const charged = bookings.filter((b) => isCardPaid(b) && b.charged != null).reduce((sum, b) => sum + Number(b.charged), 0);
  const isReceipt =
    bookings.some((b) => isCardPaid(b) && Number(b.charged ?? b.price) > 0) ||
    bookings.some((b) => !isRequest(b) && b.payment_status === "credit");
  const kind = isReceipt ? "receipt" : "confirmation";
  const number = String(data.receipt_number ?? "").trim();
  const subject = `Your AthaNext ${kind}${number ? ` #${number}` : ""}`;

  const rows = bookings
    .map((b) => {
      const coach = String(b.coach?.name ?? "").trim() || "your coach";
      const when = b.occurrence_date ? formatSessionWhen(b.occurrence_date, b.start_time, timeZone) : "";
      const amount = Number(isCardPaid(b) && b.charged != null ? b.charged : b.price ?? 0);
      const payment = isRequest(b)
        ? "Request sent. Nothing is charged until the coach accepts."
        : familyPaymentLine(String(b.payment_status ?? ""), amount, coach, false);
      return `<tr><td style="padding:12px 0;border-top:1px solid #E4E6EA;">
          <strong>${escapeHtml(sessionTitle(b))}</strong><br />
          <span style="color:#686B72;">${escapeHtml([when, place(b)].filter(Boolean).join(" · "))}</span><br />
          ${payment}
        </td></tr>`;
    })
    .join("");

  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
      <h2 style="color:#0054B4;">Your ${kind}</h2>
      ${number ? `<p style="color:#686B72;">${isReceipt ? "Receipt" : "Confirmation"} #${escapeHtml(number)}</p>` : ""}
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
      ${charged > 0 ? `<p><strong>Total paid in the app: ${usd(Math.round(charged * 100) / 100)}</strong></p>` : ""}
      <p style="color:#686B72;font-size:13px;">You asked for this copy on AthaNext. Questions go to support@athanext.com.</p>
    </div>`;

  return { subject, html, isReceipt };
};
