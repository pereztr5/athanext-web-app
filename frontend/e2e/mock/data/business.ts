import { mockId, type MockBackend } from "../backend";
import { IDS } from "../personas";
import { ROSTER, dayFromToday } from "./athletes";

// Casey Coach's money: get_coach_earnings and stripe-payouts for the Business summary,
// get_coach_offline_payments (20261023110000_coach_offline_payments.sql), camp registrations,
// get_coach_payments with money_in (sessions, packages, invoices; in the app or paid directly),
// gear earnings, the coach-invoices function, coach-billing, and a parent's invoice
// (get_family_invoice, which only answers the account holder the invoice was sent to).

type Row = Record<string, unknown>;

export const MONEY = {
  openInvoice: "0000b0b0-0000-4000-8000-000000000001",
  overdueInvoice: "0000b0b0-0000-4000-8000-000000000002",
  paidInvoice: "0000b0b0-0000-4000-8000-000000000003",
  waitingBooking: "0000b0b0-0000-4000-8000-0000000000b1",
  waitingOccurrence: "0000b0b0-0000-4000-8000-0000000000c1",
  stripeOnboard: "https://connect.stripe.com/setup/e/acct_e2e/onboard",
  stripeDashboard: "https://connect.stripe.com/express/acct_e2e/dashboard",
  checkout: "https://checkout.stripe.com/c/pay/cs_test_e2e_plan",
  portal: "https://billing.stripe.com/p/session/test_e2e",
  invoiceCheckout: "https://checkout.stripe.com/c/pay/cs_test_e2e_invoice",
} as const;

const iso = (days: number, hour = 15) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};

type PayoutAccount = { connected?: boolean; details_submitted?: boolean; payouts_enabled?: boolean; transfers_active?: boolean; bank_last4?: string | null };

/** stripe-payouts: status, the payout list and the onboarding and dashboard links. */
export const seedStripePayouts = (backend: MockBackend, account: PayoutAccount = { connected: true, details_submitted: true, payouts_enabled: true, transfers_active: true, bank_last4: "6789" }) => {
  backend.functions["stripe-payouts"] = (body: unknown) => {
    const action = (body as Row)?.action;
    if (action === "onboard") return { url: MONEY.stripeOnboard };
    if (action === "dashboard") return { url: MONEY.stripeDashboard };
    if (action === "payouts") {
      return {
        account,
        balance: { available: 0, pending: 140 },
        payouts: [
          { id: "po_later", amount: 60, arrival: iso(9), status: "pending" },
          { id: "po_next", amount: 140, arrival: iso(2), status: "in_transit" },
          { id: "po_old", amount: 200, arrival: iso(-5), status: "paid" },
        ],
      };
    }
    return { account };
  };
};

/** get_athlete_home for Pat Parent: Alex, so the family Home and Account show the athlete. */
export const ALEX_HOME = {
  athlete: { id: IDS.athlete, full_name: "Alex Athlete", date_of_birth: "2010-05-01", sport: "soccer", position: "Forward", team: "Rovers U17", photo: null },
  next: null,
  focus: null,
  coaches: [],
};

/** resolve_coach_by_slug_or_id isn't in the shared defaults; useCoachDetails needs it to load Casey. */
export const seedCoachLookup = (backend: MockBackend) => {
  backend.rpc.resolve_coach_by_slug_or_id = (args: Row) => (args.p_key === IDS.coach || args.p_key === IDS.coachSlug ? IDS.coach : null);
};

/** The Business page: owed in the app, one overdue invoice, offline payments, camp money. */
export const seedBusiness = (backend: MockBackend) => {
  seedCoachLookup(backend);
  backend.rpc.get_coach_earnings = { days: [], owed: 240, overdue_count: 1 };
  seedStripePayouts(backend);
  backend.rpc.get_coach_offline_payments = {
    waiting: [
      {
        booking_id: MONEY.waitingBooking,
        occurrence_id: MONEY.waitingOccurrence,
        athlete_id: ROSTER.ben,
        athlete_name: "Ben Carter",
        payer_name: "Dana Carter",
        occurrence_date: dayFromToday(-2),
        start_time: "17:00:00",
        session_name: "Speed session",
        amount: 60,
        session_done: true,
      },
    ],
    paid_month: 120,
    paid_total: 480,
    recent: [
      { id: mockId(), kind: "session", name: "Technique", athlete_name: "Ava Martinez", paid_on: dayFromToday(-6), amount: 80 },
      { id: mockId(), kind: "camp", name: "Summer camp", athlete_name: "Leo Park", paid_on: dayFromToday(-9), amount: 200 },
    ],
  };
  backend.rpc.confirm_offline_payment = null;
  backend.seed("camp_registrations", [
    { id: mockId(), coach_id: IDS.coach, status: "paid", pay_method: "card", price_cents: 25000, created_at: new Date().toISOString() },
    { id: mockId(), coach_id: IDS.coach, status: "paid", pay_method: "offline", price_cents: 20000, created_at: new Date().toISOString() },
    { id: mockId(), coach_id: IDS.coach, status: "held", pay_method: "offline", price_cents: 15000, created_at: new Date().toISOString() },
  ]);
};

const invoice = (row: Row): Row => ({
  athlete_id: ROSTER.ava,
  family: "Maria Martinez",
  athlete: "Ava Martinez",
  service: "Individual session",
  amount: 120,
  note: null,
  status: "open",
  paid_at: null,
  paid_method: null,
  reminders: 0,
  created_at: iso(-10),
  ...row,
});

/**
 * get_coach_payments for the last 60 days: an open invoice, an overdue one and a paid one, and
 * money in: a session from Casey's own client (in the app), a marketplace package, a session paid
 * directly, the paid invoice, and one older payment for the "vs previous 30 days" line.
 */
export const seedPayments = (backend: MockBackend) => {
  backend.rpc.get_coach_payments = {
    invoices: [
      invoice({ id: MONEY.openInvoice, due: dayFromToday(5) }),
      invoice({ id: MONEY.overdueInvoice, athlete_id: ROSTER.ben, family: "Dana Carter", athlete: "Ben Carter", service: "Group session", amount: 90, due: dayFromToday(-3), reminders: 1 }),
      invoice({ id: MONEY.paidInvoice, service: "Session package", amount: 60, due: dayFromToday(-8), status: "paid", paid_at: iso(-7), paid_method: "card" }),
    ],
    money_in: [
      { id: "session:1", kind: "session", channel: "in_app", own: true, date: iso(-1), amount: 80, athlete: "Ava Martinez", family: "Maria Martinez", service: "Technique" },
      { id: "package:1", kind: "package", channel: "in_app", own: false, date: iso(-3), amount: 100, athlete: "Noah King", family: "Liz King", service: "Starter pack" },
      { id: "session:2", kind: "session", channel: "direct", own: true, date: dayFromToday(-5), amount: 60, athlete: "Ben Carter", family: "Dana Carter", service: "Speed session" },
      { id: `invoice:${MONEY.paidInvoice}`, kind: "invoice", channel: "in_app", own: true, date: iso(-7), amount: 60, athlete: "Ava Martinez", family: "Maria Martinez", service: "Session package" },
      { id: "session:old", kind: "session", channel: "in_app", own: true, date: iso(-40), amount: 85, athlete: "Ava Martinez", family: "Maria Martinez", service: "Technique" },
    ],
    clients: [
      { athlete_id: ROSTER.ben, athlete: "Ben Carter", family: "Dana Carter" },
      { athlete_id: ROSTER.ava, athlete: "Ava Martinez", family: "Maria Martinez" },
    ],
  };
  backend.rpc.get_coach_gear_earnings = [{ date: dayFromToday(-2), amount: 15 }];
  backend.rpc.mark_coach_invoice_paid = null;
  backend.functions["coach-invoices"] = (body: unknown) => {
    const b = body as Row;
    if (b.action === "remind") return { reminders: 2, emailed: true };
    if (b.action === "create") return { id: mockId(), emailed: true };
    if (b.action === "checkout") return { url: MONEY.invoiceCheckout };
    if (b.action === "verify") return { status: "paid" };
    if (b.action === "request_offline") return { ok: true };
    return {};
  };
};

type Billing = { access: boolean; locked: boolean; subscribed: boolean; trial_active: boolean; trial_ends_at: string | null; days_left: number; subscription_status: string | null };

export const BILLING: Record<"locked" | "trial" | "subscribed", Billing> = {
  locked: { access: false, locked: true, subscribed: false, trial_active: false, trial_ends_at: iso(-3), days_left: 0, subscription_status: "canceled" },
  trial: { access: true, locked: false, subscribed: false, trial_active: true, trial_ends_at: iso(12), days_left: 12, subscription_status: null },
  subscribed: { access: true, locked: false, subscribed: true, trial_active: false, trial_ends_at: iso(-30), days_left: 0, subscription_status: "active" },
};

/** coach-billing: the plan status, and Checkout and portal links. */
export const seedCoachBilling = (backend: MockBackend, status: Billing) => {
  backend.functions["coach-billing"] = (body: unknown) => {
    const action = (body as Row)?.action;
    if (action === "checkout") return { url: MONEY.checkout };
    if (action === "portal") return { url: MONEY.portal };
    return { ...status, price_monthly: 29 };
  };
};

/** Fee rates (public.configurations) every shown price uses. */
export const seedFeeConfig = (backend: MockBackend) => {
  backend.seed("configurations", [
    { id: mockId(), key: "platform_fees", value: "10" },
    { id: mockId(), key: "stripe_fees", value: "2.9" },
    { id: mockId(), key: "stripe_fee_fixed", value: "0.30" },
  ]);
};

/** A $120 invoice from Casey to Pat Parent; get_family_invoice answers only the parent. */
export const seedFamilyInvoice = (backend: MockBackend, overrides: Row = {}) => {
  const row: Row = {
    id: IDS.invoice,
    coach: "Casey Coach",
    athlete: "Alex Athlete",
    service: "Individual session",
    amount: 120,
    due: dayFromToday(7),
    note: "Thanks for a great month!",
    status: "open",
    paid_at: null,
    ...overrides,
  };
  backend.rpc.get_family_invoice = (args: Row, { user }) => (args.p_invoice_id === row.id && user?.id === IDS.parentUser ? row : null);
  backend.rpc.get_my_invoices = (_args: Row, { user }) =>
    user?.id === IDS.parentUser ? [{ id: row.id, coach: row.coach, athlete: row.athlete, service: row.service, amount: row.amount, due: row.due, status: row.status, paid_at: row.paid_at }] : [];
  return row;
};

const monthDay = (monthsBack: number, day: number) => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, day)).toISOString().slice(0, 10);
};

const booking = (row: Row): Row => ({
  booking_id: mockId(),
  slot_id: mockId(),
  occurrence_id: mockId(),
  availability_id: mockId(),
  coach_id: IDS.coach,
  coach_name: "Casey Coach",
  athlete_count: 1,
  slot_start_time: "10:00:00",
  slot_end_time: "11:00:00",
  slot_duration: 60,
  slot_session_type: "individual",
  slot_location: "in-person",
  slot_session_name: "1-on-1",
  slot_price: 80,
  pillar_slot: null,
  has_session_feedback: true,
  has_slot_feedback: true,
  ...row,
});

/**
 * get_bookings_by_user_id for Analytics: this month Mia (who also came two months ago) and Leo
 * (new); Sam last came four months ago (lapsed). get_coach_rating_stats: 4.5 from 4 reviews.
 */
export const seedAnalytics = (backend: MockBackend) => {
  backend.rpc.get_bookings_by_user_id = [
    booking({ athletes_names: ["Mia Lopez"], session_date: monthDay(0, 1), slot_price: 80, pillar_slot: "Technique" }),
    booking({ athletes_names: ["Leo Park"], session_date: monthDay(0, 1), slot_start_time: "12:00:00", slot_end_time: "13:00:00", slot_price: 100, pillar_slot: "Speed" }),
    booking({ athletes_names: ["Mia Lopez"], session_date: monthDay(2, 10), slot_price: 80, pillar_slot: "Technique" }),
    booking({ athletes_names: ["Sam Old"], session_date: monthDay(4, 10), slot_price: 60 }),
    // Upcoming: not counted.
    booking({ athletes_names: ["Leo Park"], session_date: dayFromToday(3), slot_price: 100, pillar_slot: "Speed" }),
  ];
  backend.rpc.get_coach_rating_stats = [{ average_rating: 4.5, total_reviews: 4, five_star: 2, four_star: 2, three_star: 0, two_star: 0, one_star: 0 }];
  backend.rpc.get_coach_reviews_public = [];
};
