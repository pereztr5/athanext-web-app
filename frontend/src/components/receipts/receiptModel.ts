import type { BookingReceiptData, ReceiptBooking } from "@/api/receipts";
import type { PlanFees } from "@/utils/bookPlan";
import { checkoutFees, feeRows, toCents } from "@/utils/fees";
import { zonedWallTimeToUtc } from "@/utils/dateHelpers";
import type { CalendarEvent } from "@/utils/ics";
import { formatLocationSentence } from "@/utils/sessionFormatting";
import { formatDateInZone, formatInstantSpan } from "@/utils/viewerTime";

export interface ReceiptLine {
  id: string;
  /** "Finishing session with Riley Chen" */
  title: string;
  group: boolean;
  request: boolean;
  start: Date | null;
  end: Date | null;
  dateLabel: string;
  timeLabel: string;
  locationLabel: string;
}

export interface DirectPayment {
  coachId: string;
  firstName: string;
  amount: number;
  note: string | null;
}

export interface ReceiptModel {
  number: string;
  issuedLabel: string;
  email: string | null;
  athleteId: string | null;
  lines: ReceiptLine[];
  confirmed: number;
  requests: number;
  /** Base price of the sessions paid in the app. */
  sessions: number;
  credits: number;
  platformFees: number;
  processingFees: number;
  total: number;
  /** False when an unrecorded card payment can't be priced yet (fee rates not loaded): show no amounts. */
  amountsKnown: boolean;
  direct: DirectPayment[];
  /** A Stripe payment that hasn't been confirmed yet. */
  pending: boolean;
  /** Something was paid in the app (card or package credits): a receipt, else a confirmation. */
  isReceipt: boolean;
}

const cents = (n: number) => Math.round(n * 100) / 100;

export const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

const isRequest = (b: ReceiptBooking) => b.status === "requested";
const isCardPaid = (b: ReceiptBooking) => !isRequest(b) && (b.paymentStatus === "paid" || b.status === "pending_payment");

export const sessionTitle = (b: ReceiptBooking) => {
  const what =
    b.sessionType === "group"
      ? b.sessionName || "Group session"
      : b.pillar
        ? `${b.pillar} session`
        : b.sessionName || "1-on-1 session";
  return `${what} with ${b.coach.name}`;
};

export const locationLabel = (b: Pick<ReceiptBooking, "location" | "place">) =>
  b.location?.toLowerCase() === "online" ? "Online" : b.place || formatLocationSentence(b.location) || "In person";

export const buildReceiptModel = (data: BookingReceiptData, timeZone: string, fees?: PlanFees): ReceiptModel => {
  const lines: ReceiptLine[] = data.bookings.map((b) => {
    const start = b.date && b.startTime ? zonedWallTimeToUtc(b.date, b.startTime) : null;
    const end = b.date && b.endTime ? zonedWallTimeToUtc(b.date, b.endTime) : null;
    return {
      id: b.id,
      title: sessionTitle(b),
      group: b.sessionType === "group",
      request: isRequest(b),
      start,
      end,
      dateLabel: start ? formatDateInZone(start, timeZone, { weekday: "long", month: "long", day: "numeric" }) : "—",
      timeLabel: start && end ? formatInstantSpan(start, end, timeZone) || "—" : "—",
      locationLabel: locationLabel(b),
    };
  });

  // Recorded payment rows are what was charged; card payments not recorded yet are priced as
  // one Checkout with the shared fee math (what create-booking-payment charges).
  const cardPaid = data.bookings.filter(isCardPaid);
  const unrecorded = cardPaid.filter((b) => b.charged == null);
  const estimate =
    unrecorded.length && fees?.config
      ? checkoutFees(
          unrecorded.map((b) => ({ listCents: toCents(b.price), kind: "session" as const, platformWaived: fees.waived.has(b.coach.id) })),
          fees.config
        )
      : null;
  let sessions = 0;
  let platformFees = (estimate?.platformCents ?? 0) / 100;
  let processingFees = (estimate?.processingCents ?? 0) / 100;
  let total = (estimate?.totalCents ?? 0) / 100;
  const direct = new Map<string, DirectPayment>();
  data.bookings.forEach((b) => {
    if (isCardPaid(b)) {
      sessions += b.price;
      if (b.charged != null) {
        platformFees += b.platformFee ?? 0;
        processingFees += b.processingFee ?? 0;
        total += b.charged;
      }
    } else if (!isRequest(b) && b.paymentStatus === "direct") {
      const entry = direct.get(b.coach.id) ?? {
        coachId: b.coach.id,
        firstName: b.coach.name.split(" ")[0] || b.coach.name,
        amount: 0,
        note: b.coach.payNote,
      };
      entry.amount = cents(entry.amount + b.price);
      direct.set(b.coach.id, entry);
    }
  });
  const credits = data.bookings.filter((b) => !isRequest(b) && b.paymentStatus === "credit").length;
  const requests = data.bookings.filter(isRequest).length;
  const issued = data.issuedAt ? new Date(data.issuedAt) : null;

  return {
    number: data.receiptNumber,
    issuedLabel: issued && !isNaN(issued.getTime())
      ? formatDateInZone(issued, timeZone, { month: "short", day: "numeric", year: "numeric" })
      : "",
    email: data.email,
    athleteId: data.bookings[0]?.athleteId ?? null,
    lines,
    confirmed: data.bookings.length - requests,
    requests,
    sessions: cents(sessions),
    credits,
    platformFees: cents(platformFees),
    processingFees: cents(processingFees),
    total: cents(total),
    amountsKnown: !unrecorded.length || Boolean(estimate),
    direct: [...direct.values()],
    pending: data.bookings.some((b) => b.status === "pending_payment" || (isCardPaid(b) && b.paymentStatus === "unpaid")),
    isReceipt: total > 0 || unrecorded.some((b) => b.price > 0) || credits > 0,
  };
};

/** Confirmed sessions only: requests aren't on the calendar until the coach accepts. */
export const calendarEvents = (model: ReceiptModel): CalendarEvent[] =>
  model.lines
    .filter((l) => !l.request && l.start && l.end)
    .map((l) => ({ uid: `${l.id}@athanext.com`, title: l.title, start: l.start!, end: l.end!, location: l.locationLabel }));

/** Plain-text copy of the receipt for the email draft. */
export const receiptText = (model: ReceiptModel, supportEmail?: string) => {
  const rows = [
    `AthaNext ${model.isReceipt ? "receipt" : "confirmation"} #${model.number}`,
    model.issuedLabel ? `Issued ${model.issuedLabel}` : "",
    "",
    ...model.lines.flatMap((l) => [
      `${l.title}${l.request ? " (request sent, not charged)" : ""}`,
      `${l.dateLabel}, ${l.timeLabel}, ${l.locationLabel}`,
      "",
    ]),
  ];
  if (model.isReceipt) {
    if (model.sessions) rows.push(`Sessions: ${formatMoney(model.sessions)}`);
    if (model.credits) rows.push(`Package credits used: ${model.credits}`);
    if (model.amountsKnown) {
      feeRows({ platformCents: toCents(model.platformFees), processingCents: toCents(model.processingFees) }).forEach((r) =>
        rows.push(`${r.label}: ${formatMoney(r.cents / 100)}`)
      );
      rows.push(`Total paid: ${formatMoney(model.total)}`, "");
    }
  }
  model.direct.forEach((d) => rows.push(`Pay ${d.firstName} directly: ${formatMoney(d.amount)}. ${d.note || "Not charged in AthaNext."}`, ""));
  if (supportEmail) rows.push(`Questions go to ${supportEmail}`);
  return rows.join("\n").trim();
};
