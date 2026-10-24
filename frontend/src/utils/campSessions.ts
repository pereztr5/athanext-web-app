/**
 * Camp days as sessions (20261026100000_camp_registration_bookings.sql): every held or paid camp
 * registration with a linked athlete holds one booking per camp day of its group, with
 * payment_status "camp". Those bookings are never paid, cancelled or refunded one by one; the
 * money lives on the camp registration. My Business sums it here, apart from session money.
 */
import { getZonedISODate, SESSION_TIME_ZONE } from "@/utils/dateHelpers";

/** payment_status on a camp-day booking. */
export const CAMP_PAYMENT = "camp";

export const isCampBooking = (paymentStatus: string | null | undefined) => paymentStatus === CAMP_PAYMENT;

/** "Camp · Thanksgiving Camp · Day 2" ("Camp · Thanksgiving Camp" without a day). */
export const campDayTitle = (campName: string | null | undefined, dayIndex: number | null | undefined) => {
  const name = campName?.trim() || "Camp";
  const day = Number(dayIndex);
  return `Camp · ${name}${Number.isFinite(day) && day > 0 ? ` · Day ${day}` : ""}`;
};

export interface CampRegistrationMoneyRow {
  status: string;
  pay_method: string;
  price_cents: number;
  created_at: string;
}

export interface CampMoneySummary {
  /** Held or paid sign-ups made this month (Eastern), any payment method. */
  registrationsThisMonth: number;
  /** Paid by card in the app. */
  paidInApp: number;
  /** Paid to the coach directly or outside the app, marked paid. */
  paidDirect: number;
  /** Held spots not marked paid yet. */
  toCollect: number;
  toCollectCount: number;
}

const ACTIVE = new Set(["held", "paid"]);

/**
 * Camp money for My Business, in dollars. Cancelled, expired and unpaid card checkouts don't
 * count. `now` sets "this month" on the Eastern clock, like the rest of My Business.
 */
export const campMoneySummary = (rows: CampRegistrationMoneyRow[], now = new Date()): CampMoneySummary => {
  const month = getZonedISODate(now, SESSION_TIME_ZONE).slice(0, 7);
  const summary: CampMoneySummary = { registrationsThisMonth: 0, paidInApp: 0, paidDirect: 0, toCollect: 0, toCollectCount: 0 };
  for (const row of rows) {
    if (!ACTIVE.has(row.status)) continue;
    const dollars = Math.max(0, Number(row.price_cents) || 0) / 100;
    const created = new Date(row.created_at);
    if (!Number.isNaN(created.getTime()) && getZonedISODate(created, SESSION_TIME_ZONE).slice(0, 7) === month) {
      summary.registrationsThisMonth += 1;
    }
    if (row.status === "held") {
      summary.toCollect += dollars;
      summary.toCollectCount += 1;
    } else if (row.pay_method === "card") {
      summary.paidInApp += dollars;
    } else {
      summary.paidDirect += dollars;
    }
  }
  return summary;
};

/**
 * The family's camp-day line on their session page, instead of the group roster count:
 * "You're signed up for Thanksgiving Camp, Day 2 of 5" over "Under 12s · 4:00 to 5:30 pm ET".
 */
export const campSignedUpLine = (
  camp: { name: string | null | undefined; dayIndex: number | null | undefined; daysTotal: number | null | undefined; groupName?: string | null },
  timeSpan?: string | null,
): { title: string; detail: string | null } => {
  const name = camp.name?.trim() || "this camp";
  const day = Number(camp.dayIndex);
  const total = Number(camp.daysTotal);
  const dayPart =
    Number.isFinite(day) && day > 0 ? (Number.isFinite(total) && total >= day ? `, Day ${day} of ${total}` : `, Day ${day}`) : "";
  const detail = [camp.groupName?.trim(), timeSpan?.trim()].filter(Boolean).join(" · ");
  return { title: `You're signed up for ${name}${dayPart}`, detail: detail || null };
};
