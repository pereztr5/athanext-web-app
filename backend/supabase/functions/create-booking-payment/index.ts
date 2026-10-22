import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient, type SupabaseClient as SupabaseClientOf } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { checkoutExpiry, idempotencyKey, idsFromMetadata } from "../_shared/checkout.ts";
import { loadFeeConfig } from "../_shared/fee_config.ts";
import { checkoutFees, type FeeConfig, feeConfigFromMetadata, feeConfigMetadata, toCents } from "../_shared/fees.ts";
import { isFullRefund, releaseCampSession, reverseCampCharge, settleCampSession } from "../_shared/camp_settle.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Optional: fills Stripe's real fee on payment rows. Not in this repo; when it isn't deployed
// the call is skipped with one log line and nothing else depends on it.
const RECONCILE_FUNCTION_NAME = "reconcile-stripe-fees";

const NOTIFICATION_FUNCTION_NAME = "send-booking-notifications";

/** Stripe's smallest card charge in USD. */
const MIN_CHARGE_CENTS = 50;

/** Another caller (webhook vs confirmation page) gets this long to finish a booking's emails. */
const FOLLOWUP_LEASE_MS = 5 * 60 * 1000;

/** Stripe metadata values stop at 500 characters; longer lists are left out (rows carry the id). */
const metadataList = (ids: string[]) => {
  const value = ids.join(",");
  return value.length <= 500 ? value : "";
};

const isSessionPaid = (session: Stripe.Checkout.Session) => {
  const payStatus = session.payment_status;
  const intentStatus = (session.payment_intent as any)?.status;
  return (
    payStatus === "paid" ||
    payStatus === "no_payment_required" ||
    intentStatus === "succeeded"
  );
};

// deno-lint-ignore no-explicit-any
type SupabaseClient = SupabaseClientOf<any, "public", "public", any, any>;

/** A booking a Checkout paid for (card, or a credit in the same basket). */
type PaidRow = { id: string; paidWith: string; newly: boolean; followupDone: boolean };

const extractPaymentIntentId = (session: Stripe.Checkout.Session): string | null => {
  const intent = session.payment_intent;
  if (!intent) return null;
  if (typeof intent === "string") return intent;
  if (typeof intent === "object" && "id" in intent) {
    return (intent as Stripe.PaymentIntent).id ?? null;
  }
  return null;
};

const fetchDefaultGroupCapacity = async (client: SupabaseClient): Promise<number> => {
  try {
    const { data, error } = await client
      .from("configurations" as any)
      .select("value")
      .eq("key", "default_max_bookings_group")
      .maybeSingle();
    if (error) return 50;
    const parsed = Number.parseInt(data?.value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
  } catch (err) {
    console.error("Failed to load default group capacity", err);
    return 50;
  }
};

const waivedCoachesOf = (session: Stripe.Checkout.Session) =>
  new Set(String((session.metadata as any)?.waived_coaches ?? "").split(",").filter(Boolean));

/** The rates the Checkout was created with (its metadata), else today's rates. */
const resolveFeeConfig = async (session: Stripe.Checkout.Session, client: SupabaseClient): Promise<FeeConfig> =>
  feeConfigFromMetadata(session.metadata) ?? (await loadFeeConfig(client));

/** Payment rows (fees per booking) for the bookings a Checkout covers. */
const buildPaymentRows = async (
  session: Stripe.Checkout.Session,
  client: SupabaseClient,
  bookingIds: string[],
) => {
  if (!bookingIds.length) return [];
  const feeConfig = await resolveFeeConfig(session, client);

  const { data: bookings, error: bookingFetchErr } = await client
    .from("coach_slot_bookings" as any)
    .select("id, occurrence_id, coach_id, status, payment_status, created_at")
    .in("id", bookingIds)
    .in("status", ["pending_payment", "booked"])
    .in("payment_status", ["unpaid", "requires_action", "authorized", "paid"])
    .order("created_at", { ascending: true });
  if (bookingFetchErr) throw bookingFetchErr;
  if (!bookings || bookings.length === 0) return [];

  const { data: occurrences, error: occErr } = await client
    .from("coach_availability_slot_occurrences" as any)
    .select("id, price")
    .in("id", bookings.map((b: any) => b.occurrence_id));
  if (occErr) throw occErr;

  const occurrenceById = new Map((occurrences || []).map((occ: any) => [occ.id, occ]));
  const waived = waivedCoachesOf(session);

  const charged = (bookings as any[]).filter((booking) => occurrenceById.has(booking.occurrence_id));
  // Same fee math as the Checkout: coaches' own clients pay no platform fee (one checkout can
  // cover several coaches) and processing is spread over the rows so they add up to the charge.
  const fees = checkoutFees(
    charged.map((booking) => ({
      listCents: toCents(Number((occurrenceById.get(booking.occurrence_id) as any).price || 0)),
      kind: "session" as const,
      platformWaived: waived.has(booking.coach_id),
    })),
    feeConfig,
  );
  return charged.map((booking, i) => {
    const line = fees.lines[i];
    return {
      booking_id: booking.id,
      slot_id: booking.occurrence_id,
      coach_offer_amount: line.listCents / 100,
      platform_fee_amount: line.platformCents / 100,
      stripe_price_amount: line.processingCents / 100,
      total_amount: line.totalCents / 100,
      currency: "USD",
      type: "booking_credit",
    };
  });
};

/**
 * Marks a paid Checkout's bookings paid and writes their payment rows in one transaction
 * (mark_checkout_paid). Bookings are found by the Checkout id on the rows and by the
 * booking_ids in its metadata, so an older Checkout tab that was paid still finds its bookings.
 */
const markSessionPaid = async (
  session: Stripe.Checkout.Session,
  client: SupabaseClient,
  extraIds: string[] = [],
): Promise<PaidRow[]> => {
  const metaIds = idsFromMetadata(session.metadata?.booking_ids);
  const { data: bySession, error: bySessionErr } = await client
    .from("coach_slot_bookings" as any)
    .select("id")
    .eq("stripe_session_id", session.id);
  if (bySessionErr) throw bySessionErr;
  const named = [...new Set([...metaIds, ...extraIds])];
  const all = [...new Set([...named, ...((bySession ?? []) as any[]).map((r) => r.id as string)])];
  const paymentRows = await buildPaymentRows(session, client, all);

  const { data, error } = await client.rpc("mark_checkout_paid" as any, {
    p_session_id: session.id,
    p_payment_intent: extractPaymentIntentId(session),
    p_booking_ids: named,
    p_payments: paymentRows,
  });
  if (error) throw error;
  const rows: PaidRow[] = ((data ?? []) as any[]).map((r) => ({
    id: r.paid_booking_id,
    paidWith: r.paid_with,
    newly: Boolean(r.newly_paid),
    followupDone: Boolean(r.followup_done),
  }));
  const missed = named.filter((id) => !rows.some((r) => r.id === id));
  if (missed.length) {
    // The family paid but these bookings were released, cancelled or paid by another Checkout.
    console.error("PAID CHECKOUT WITHOUT BOOKING: refund or rebook by hand", session.id, missed);
  }
  return rows;
};

const serviceCall = async (fn: string, body: unknown) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRole) {
    console.error(`Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for ${fn}`);
    return { ok: false, status: 0, text: "not configured" };
  }
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRole}` },
      body: JSON.stringify(body),
    });
    return { ok: resp.ok, status: resp.status, text: await resp.text() };
  } catch (e) {
    return { ok: false, status: 0, text: e instanceof Error ? e.message : String(e) };
  }
};

let reconcileMissing = false;
/** Optional Stripe fee reconcile. Never blocks a booking; skipped once it is known to be missing. */
const callReconcileEndpointForBookings = async (bookingIds: string[]) => {
  if (reconcileMissing) return;
  for (const booking_id of new Set(bookingIds)) {
    const r = await serviceCall(RECONCILE_FUNCTION_NAME, { booking_id });
    if (r.status === 404) {
      reconcileMissing = true;
      console.warn(`${RECONCILE_FUNCTION_NAME} is not deployed; skipping Stripe fee reconcile`);
      return;
    }
    if (!r.ok) console.error("Reconcile failed for booking:", booking_id, r.status, r.text);
  }
};

// Coach payouts: plan the coach's (and any org's) share as soon as a booking is paid.
const callPayoutTransfersForBookings = async (bookingIds: string[]): Promise<boolean> => {
  const ids = Array.from(new Set(bookingIds));
  if (!ids.length) return true;
  const r = await serviceCall("stripe-payouts", { action: "transfer_bookings", booking_ids: ids });
  if (!r.ok) console.error("Payout transfers failed:", r.status, r.text);
  return r.ok;
};

/** Sends every waiting share (optionally one coach's), e.g. once a Connect account can receive them. */
const callPayoutSweep = async (coachId?: string) => {
  const r = await serviceCall("stripe-payouts", { action: "sweep", ...(coachId ? { coach_id: coachId } : {}) });
  if (!r.ok) console.error("Payout sweep failed:", r.status, r.text);
};

/** Adds bookings to the coach's Google Calendar when connected. Never fails the caller. */
const callCalendarForBookings = async (client: SupabaseClient, bookingIds: string[]) => {
  const ids = [...new Set(bookingIds)];
  if (!ids.length) return;
  try {
    const { data: bookings } = await client.from("coach_slot_bookings" as any).select("id, coach_id").in("id", ids);
    const coachIds = [...new Set(((bookings ?? []) as any[]).map((b) => b.coach_id))];
    if (!coachIds.length) return;
    const { data: conns } = await client
      .from("coach_calendar_connections" as any)
      .select("coach_id")
      .in("coach_id", coachIds)
      .eq("can_write", true);
    const connected = new Set(((conns ?? []) as any[]).map((c) => c.coach_id));
    for (const b of (bookings ?? []) as any[]) {
      if (!connected.has(b.coach_id)) continue;
      const r = await serviceCall("google-calendar", { action: "add_event", booking_id: b.id });
      if (!r.ok) console.error("Calendar event failed for booking:", b.id, r.status, r.text);
    }
  } catch (e) {
    console.error("Calendar events skipped:", e);
  }
};

/**
 * Emails, payout planning and calendar events for paid bookings, once each. A booking's
 * paid_followup_at is set only after its steps succeed; a short lease keeps the webhook and the
 * confirmation page from sending twice. Returns false when something is still left to do, so
 * the webhook answers 500 and Stripe retries.
 */
const runPaidFollowups = async (client: SupabaseClient, rows: PaidRow[]): Promise<boolean> => {
  const todo = rows.filter((r) => !r.followupDone).map((r) => r.id);
  if (!todo.length) return true;
  const leaseCutoff = new Date(Date.now() - FOLLOWUP_LEASE_MS).toISOString();
  const { data: claimed, error } = await client
    .from("coach_slot_bookings" as any)
    .update({ paid_followup_claimed_at: new Date().toISOString() })
    .in("id", todo)
    .is("paid_followup_at", null)
    .or(`paid_followup_claimed_at.is.null,paid_followup_claimed_at.lt."${leaseCutoff}"`)
    .select("id, payment_status");
  if (error) throw error;
  const mine = (claimed ?? []) as { id: string; payment_status: string }[];
  if (!mine.length) return false;

  const paidIds = mine.filter((r) => r.payment_status === "paid").map((r) => r.id);
  await callReconcileEndpointForBookings(paidIds);
  // Payout planning first: if it fails, nothing is emailed yet and the whole step is retried.
  const payoutsOk = await callPayoutTransfersForBookings(paidIds);
  const notified = payoutsOk ? await callNotificationEndpointForBookings(mine.map((r) => r.id)) : new Set<string>();
  const done = mine.filter((r) => notified.has(r.id)).map((r) => r.id);
  const failed = mine.filter((r) => !notified.has(r.id)).map((r) => r.id);

  if (done.length) {
    const { error: doneErr } = await client
      .from("coach_slot_bookings" as any)
      .update({ paid_followup_at: new Date().toISOString(), paid_followup_claimed_at: null })
      .in("id", done);
    if (doneErr) console.error("Saving follow-up state failed:", doneErr);
    await callCalendarForBookings(client, done);
  }
  if (failed.length) {
    await client.from("coach_slot_bookings" as any).update({ paid_followup_claimed_at: null }).in("id", failed);
    console.error("Paid booking follow-ups failed; will retry:", failed);
  }
  return failed.length === 0 && mine.length === todo.length;
};

/** Paid Checkout: mark it (atomic), then the follow-ups. */
const settlePaidSession = async (session: Stripe.Checkout.Session, client: SupabaseClient) => {
  // Card holds for requests (ATH-85) are captured only when the coach accepts.
  if (session.metadata?.request === "1" || !isSessionPaid(session)) {
    return { paid: false, newlyPaid: false, followupsDone: true };
  }
  const rows = await markSessionPaid(session, client);
  const followupsDone = await runPaidFollowups(client, rows);
  return { paid: true, newlyPaid: rows.some((r) => r.newly), followupsDone };
};

/** After a cancel / refund / dispute voids held shares, reverse any that were already sent. */
const callReverseTransfersForBookings = async (bookingIds: string[]) => {
  const ids = Array.from(new Set(bookingIds));
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!ids.length || !supabaseUrl || !serviceRole) return;
  try {
    await fetch(`${supabaseUrl}/functions/v1/stripe-payouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRole}` },
      body: JSON.stringify({ action: "reverse_bookings", booking_ids: ids }),
    });
  } catch (e) {
    console.error("Payout reverse call error:", e);
  }
};

const bookingIdsForCharge = async (client: SupabaseClient, chargeId: string, paymentIntentId: string | null) => {
  const ids = new Set<string>();
  const { data: byCharge } = await client.from("payments" as any).select("booking_id").eq("stripe_charge_id", chargeId);
  for (const row of (byCharge ?? []) as { booking_id?: string }[]) {
    if (row.booking_id) ids.add(row.booking_id);
  }
  if (paymentIntentId) {
    const { data: byIntent } = await client
      .from("coach_slot_bookings" as any)
      .select("id")
      .eq("stripe_payment_intent", paymentIntentId);
    for (const row of (byIntent ?? []) as { id?: string }[]) {
      if (row.id) ids.add(row.id);
    }
    const { data: payIntent } = await client
      .from("payments" as any)
      .select("booking_id")
      .eq("stripe_payment_intent", paymentIntentId);
    for (const row of (payIntent ?? []) as { booking_id?: string }[]) {
      if (row.booking_id) ids.add(row.booking_id);
    }
  }
  const { data: transferRows } = await client.from("payout_transfers" as any).select("booking_id").eq("stripe_charge_id", chargeId);
  for (const row of (transferRows ?? []) as { booking_id?: string }[]) {
    if (row.booking_id) ids.add(row.booking_id);
  }
  return [...ids];
};

const markBookingsChargeReversed = async (client: SupabaseClient, bookingIds: string[], status: "refunded" | "disputed") => {
  for (const id of bookingIds) {
    const { error } = await client.rpc("mark_booking_charge_reversed" as any, {
      p_booking_id: id,
      p_status: status,
    });
    if (error) console.error("mark_booking_charge_reversed failed", id, error);
  }
  await callReverseTransfersForBookings(bookingIds);
};

/* ---------- Requests from new families (ATH-85): hold the card, charge only on accept ---------- */

/** Once the family finishes Stripe's page, the request is created with the card held. */
const createRequestFromSession = async (session: Stripe.Checkout.Session, client: SupabaseClient, stripe: Stripe) => {
  if (session.metadata?.request !== "1" || session.status !== "complete") return { created: false, full: false };
  const intentId = extractPaymentIntentId(session);
  const { data: existing } = await client.from("coach_slot_bookings" as any).select("id").eq("stripe_session_id", session.id).limit(1);
  if (existing?.length) return { created: false, full: false };

  const occurrenceIds = String(session.metadata.occurrence_ids ?? "").split(",").filter(Boolean);
  const { data: occurrences } = await client
    .from("coach_availability_slot_occurrences" as any)
    .select("id, coach_id, weekly_slot_id, availability_id, max_bookings_per_slot")
    .in("id", occurrenceIds);
  for (const occ of (occurrences ?? []) as any[]) {
    const { count } = await client
      .from("coach_slot_bookings" as any)
      .select("id", { count: "exact", head: true })
      .eq("occurrence_id", occ.id)
      .in("status", ACTIVE_BOOKING_STATUSES);
    if ((count ?? 0) >= (occ.max_bookings_per_slot || 1)) {
      if (intentId) await stripe.paymentIntents.cancel(intentId).catch((e: unknown) => console.error("Release failed", e));
      return { created: false, full: true };
    }
  }
  const { error } = await client.from("coach_slot_bookings" as any).insert(
    ((occurrences ?? []) as any[]).map((occ) => ({
      occurrence_id: occ.id,
      weekly_slot_id: occ.weekly_slot_id,
      availability_id: occ.availability_id,
      coach_id: occ.coach_id,
      athlete_id: session.metadata!.athlete_id,
      status: "requested",
      payment_status: "authorized",
      notes: session.metadata!.notes || null,
      created_by: session.metadata!.user_id || null,
      stripe_session_id: session.id,
      stripe_payment_intent: intentId,
    })),
  );
  if (error) throw error;
  return { created: true, full: false };
};

/**
 * When every request paid with one card hold has an answer, charge the accepted ones and
 * release the rest. Returns the bookings that were charged. A hold captured earlier whose
 * bookings were not marked yet (a crash in between) is finished without charging again.
 */
const settleRequestHold = async (sessionId: string, client: SupabaseClient, stripe: Stripe): Promise<PaidRow[]> => {
  const { data: rows } = await client
    .from("coach_slot_bookings" as any)
    .select("id, status, payment_status, occurrence_id, coach_id, stripe_payment_intent")
    .eq("stripe_session_id", sessionId);
  const list = (rows ?? []) as any[];
  if (!list.length || list.some((r) => r.status === "requested")) return [];
  const accepted = list.filter((r) => r.payment_status === "authorized" && (r.status === "booked" || r.status === "pending_payment"));
  const intentId = list.find((r) => r.stripe_payment_intent)?.stripe_payment_intent as string | undefined;
  if (!intentId) return [];
  const intent = await stripe.paymentIntents.retrieve(intentId);
  if (intent.status !== "requires_capture" && intent.status !== "succeeded") return [];

  if (!accepted.length) {
    if (intent.status === "requires_capture") {
      await stripe.paymentIntents.cancel(intentId, {}, { idempotencyKey: `request-release:${intentId}` });
      await client.from("coach_slot_bookings" as any).update({ payment_status: "released" }).eq("stripe_session_id", sessionId).eq("payment_status", "authorized");
    }
    return [];
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (intent.status === "requires_capture") {
    const feeConfig = await resolveFeeConfig(session, client);
    const waived = waivedCoachesOf(session);
    const { data: occs } = await client
      .from("coach_availability_slot_occurrences" as any)
      .select("id, price")
      .in("id", accepted.map((r) => r.occurrence_id));
    const priceOf = new Map(((occs ?? []) as any[]).map((o) => [o.id, Number(o.price || 0)]));
    // What the accepted requests would have cost as their own Checkout (same as the payment rows).
    const amount = checkoutFees(
      accepted.map((r) => ({
        listCents: toCents(priceOf.get(r.occurrence_id) ?? 0),
        kind: "session" as const,
        platformWaived: waived.has(r.coach_id),
      })),
      feeConfig,
    ).totalCents;
    await stripe.paymentIntents.capture(
      intentId,
      { amount_to_capture: Math.min(amount, intent.amount_capturable) },
      { idempotencyKey: `request-capture:${intentId}` },
    );
  }

  const paid = await markSessionPaid(session, client, accepted.map((r) => r.id));
  await client.from("coach_slot_bookings" as any).update({ payment_status: "released" }).eq("stripe_session_id", sessionId).eq("payment_status", "authorized");
  return paid;
};

/** Coach answers a request: accept (and charge once the hold settles) or decline. */
const handleRequestResponse = async (req: Request, body: any, client: SupabaseClient, stripe: () => Stripe) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) return jsonResponse({ error: "Authentication required" }, 401);

  if (body.action === "request_sweep") {
    // Holds whose requests all expired or were answered elsewhere.
    const { data: profile } = await client.from("user_profiles" as any).select("coach_id").eq("id", userData.user.id).maybeSingle();
    const coachId = (profile as any)?.coach_id;
    if (!coachId) return jsonResponse({ settled: 0 });
    const { data: held } = await client
      .from("coach_slot_bookings" as any)
      .select("stripe_session_id")
      .eq("coach_id", coachId)
      .eq("payment_status", "authorized")
      .neq("status", "requested")
      .limit(20);
    const sessions = [...new Set(((held ?? []) as any[]).map((r) => r.stripe_session_id).filter(Boolean))];
    let settled = 0;
    for (const id of sessions) {
      const charged = await settleRequestHold(id, client, stripe()).catch((e: unknown) => {
        console.error("Settle failed", id, e);
        return [] as PaidRow[];
      });
      if (charged.length) {
        settled++;
        await runPaidFollowups(client, charged).catch((e: unknown) => console.error("Follow-ups failed", id, e));
      }
    }
    return jsonResponse({ settled });
  }

  const bookingId = String(body.booking_id ?? "");
  const accept = Boolean(body.accept);
  const { data: result, error } = await userClient.rpc("respond_to_booking_request", { p_booking_id: bookingId, p_accept: accept });
  if (error) return jsonResponse({ error: error.message }, 400);

  const { data: booking } = await client
    .from("coach_slot_bookings" as any)
    .select("id, payment_status, stripe_session_id")
    .eq("id", bookingId)
    .maybeSingle();
  const held = (booking as any)?.payment_status === "authorized" && (booking as any)?.stripe_session_id;
  if (!held) {
    // Booking-only coaches: accepting confirms it (pay the coach directly). A request that still
    // needs paying (pending_payment) is emailed once the family pays.
    if (accept && result === "booked") await inBackground(notifyConfirmed(client, [bookingId]));
    return jsonResponse({ status: result });
  }

  if (accept) {
    await client.from("coach_slot_bookings" as any).update({ status: "booked", updated_at: new Date().toISOString() }).eq("id", bookingId);
  }
  try {
    const charged = await settleRequestHold((booking as any).stripe_session_id, client, stripe());
    if (charged.length) await runPaidFollowups(client, charged).catch((e: unknown) => console.error("Follow-ups failed", e));
    return jsonResponse({ status: accept ? "booked" : "canceled", charged: charged.some((r) => r.id === bookingId) });
  } catch (e) {
    console.error("Charging the request failed", e);
    // The booking is accepted; the charge can be retried by the sweep.
    return jsonResponse({ status: accept ? "booked" : "canceled", charged: false, error: "The card couldn't be charged yet. We'll try again." });
  }
};

/** Booking emails. Returns the bookings whose emails went out. */
const callNotificationEndpointForBookings = async (bookingIds: string[]): Promise<Set<string>> => {
  const ok = new Set<string>();
  for (const booking_id of new Set(bookingIds)) {
    const r = await serviceCall(NOTIFICATION_FUNCTION_NAME, { booking_id });
    if (r.ok) ok.add(booking_id);
    else console.error("Notification failed for booking:", booking_id, r.status, r.text);
  }
  return ok;
};

/** Runs `task` after the response when the runtime allows it (EdgeRuntime.waitUntil), else now. */
const inBackground = async (task: Promise<unknown>) => {
  // deno-lint-ignore no-explicit-any
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) {
    runtime.waitUntil(task);
    return;
  }
  await task;
};

/** Ways a booking is confirmed without a card payment in the app. */
const NON_CARD_PAYMENTS = ["credit", "outside", "direct", "pending_offline"];

/**
 * Booking email (with the video-call link for virtual sessions) and calendar event for bookings
 * confirmed without a card: credits and packages, free sessions, paying the coach directly,
 * accepted requests and coach bookings. Card payments go through runPaidFollowups instead.
 * Each booking is claimed with the same paid_followup_* columns, so it is emailed once whichever
 * path calls first. Rows still waiting on a Checkout (hold_expires_at) are left for that payment.
 * Never fails the caller; a send that fails is logged.
 */
const notifyConfirmed = async (client: SupabaseClient, bookingIds: string[]) => {
  const ids = [...new Set(bookingIds)].filter(Boolean);
  if (!ids.length) return;
  try {
    const leaseCutoff = new Date(Date.now() - FOLLOWUP_LEASE_MS).toISOString();
    const { data: claimed, error } = await client
      .from("coach_slot_bookings" as any)
      .update({ paid_followup_claimed_at: new Date().toISOString() })
      .in("id", ids)
      .eq("status", "booked")
      .in("payment_status", NON_CARD_PAYMENTS)
      .is("hold_expires_at", null)
      .is("paid_followup_at", null)
      .or(`paid_followup_claimed_at.is.null,paid_followup_claimed_at.lt."${leaseCutoff}"`)
      .select("id");
    if (error) throw error;
    const mine = ((claimed ?? []) as { id: string }[]).map((r) => r.id);
    if (!mine.length) return;
    const notified = await callNotificationEndpointForBookings(mine);
    const missed = mine.filter((id) => !notified.has(id));
    if (missed.length) console.error("Booking emails failed (not retried):", missed);
    const { error: doneErr } = await client
      .from("coach_slot_bookings" as any)
      .update({ paid_followup_at: new Date().toISOString(), paid_followup_claimed_at: null })
      .in("id", mine);
    if (doneErr) console.error("Saving follow-up state failed:", doneErr);
    await callCalendarForBookings(client, mine);
  } catch (e) {
    console.error("Confirmation follow-ups skipped:", e);
  }
};

/** Undo shows on the coach's toast for about 5 seconds after a roster booking. */
const UNDO_WINDOW_MS = 20_000;

/**
 * A coach booked athletes from the roster (coach_book_athlete, credit or paid outside the app):
 * send the confirmation for those bookings once the undo window has passed. Only the coach of
 * each booking can ask.
 */
const handleNotifyBooked = async (req: Request, body: any, client: SupabaseClient) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return jsonResponse({ error: "Authentication required" }, 401);
  const { data: userData, error: authError } = await client.auth.getUser(token);
  if (authError || !userData?.user) return jsonResponse({ error: "Invalid authentication token" }, 401);
  const { data: profile } = await client.from("user_profiles" as any).select("coach_id").eq("id", userData.user.id).maybeSingle();
  const coachId = (profile as any)?.coach_id as string | null;
  if (!coachId) return jsonResponse({ error: "Only a coach can do this." }, 403);
  const requested = Array.isArray(body.booking_ids)
    ? (body.booking_ids as unknown[]).filter((id): id is string => typeof id === "string").slice(0, 20)
    : [];
  if (!requested.length) return jsonResponse({ notified: 0 });
  const { data: rows } = await client
    .from("coach_slot_bookings" as any)
    .select("id")
    .in("id", requested)
    .eq("coach_id", coachId);
  const own = ((rows ?? []) as { id: string }[]).map((r) => r.id);
  // The coach can undo for a few seconds (the booking is deleted); wait that out first, and
  // notifyConfirmed skips anything no longer booked.
  await inBackground(
    new Promise((resolve) => setTimeout(resolve, UNDO_WINDOW_MS)).then(() => notifyConfirmed(client, own)),
  );
  return jsonResponse({ queued: own.length });
};

/**
 * Expires earlier Checkouts that are still open, so an old tab can no longer be paid. One that
 * was paid meanwhile is settled instead; returns true when that happened.
 */
const closeCheckouts = async (stripe: Stripe, client: SupabaseClient, sessionIds: string[]): Promise<boolean> => {
  let paidAny = false;
  for (const id of new Set(sessionIds)) {
    let session = await stripe.checkout.sessions.retrieve(id, { expand: ["payment_intent"] });
    if (session.status === "open") {
      try {
        session = await stripe.checkout.sessions.expire(id);
      } catch (e) {
        // Completed between the two calls: read it again and settle below.
        console.warn("Expiring an earlier Checkout failed; re-reading it", id, e);
        session = await stripe.checkout.sessions.retrieve(id, { expand: ["payment_intent"] });
      }
    }
    if (session.status === "complete" && isSessionPaid(session)) {
      const { paid } = await settlePaidSession(session, client);
      paidAny = paidAny || paid;
    }
  }
  return paidAny;
};

/** Removes what a failed booking attempt created and gives credits back (no trace left). */
const undoAttempt = async (
  client: SupabaseClient,
  { pendingIds = [], creditIds = [], freeIds = [] }: { pendingIds?: string[]; creditIds?: string[]; freeIds?: string[] },
) => {
  if (creditIds.length) {
    const { error } = await client.rpc("undo_checkout_credits" as any, { p_booking_ids: creditIds, p_reason: null, p_delete: true });
    if (error) console.error("CREDITS NOT RETURNED after a failed booking; fix by hand", creditIds, error);
  }
  const rows = [...pendingIds, ...freeIds];
  if (rows.length) {
    const { error } = await client.from("coach_slot_bookings" as any).delete().in("id", rows);
    if (error) console.error("Removing bookings after a failed attempt failed", rows, error);
  }
};

/** Account fields kept in sync from Stripe Connect (same shape stripe-payouts writes). */
const payoutAccountFields = (account: Stripe.Account) => {
  const bank = account.external_accounts?.data?.[0] as { last4?: string } | undefined;
  return {
    details_submitted: Boolean(account.details_submitted),
    charges_enabled: Boolean(account.charges_enabled),
    payouts_enabled: Boolean(account.payouts_enabled),
    transfers_active: account.capabilities?.transfers === "active",
    ...(bank?.last4 ? { bank_last4: bank.last4 } : {}),
    updated_at: new Date().toISOString(),
  };
};

const SESSION_TIME_ZONE = "America/New_York";
// Statuses that hold a spot. "requested" = waiting for the coach to confirm (ATH-49).
const ACTIVE_BOOKING_STATUSES = ["requested", "pending_payment", "booked", "completed"];

const BOOKING_GRACE_MS = 10 * 60 * 1000;

const readZonedParts = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";
  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    hour: Number(value("hour")) % 24,
    minute: Number(value("minute")),
    second: Number(value("second")),
  };
};

const zonedWallTimeToUtc = (isoDate: string, time: string): Date | null => {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return null;
  const [hourRaw = "0", minuteRaw = "0", secondRaw = "0"] = time.split(":");
  const hour = Number.parseInt(hourRaw, 10) || 0;
  const minute = Number.parseInt(minuteRaw, 10) || 0;
  const second = Number.parseInt(secondRaw, 10) || 0;
  const desiredUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let instant = desiredUtc;
  for (let pass = 0; pass < 2; pass += 1) {
    const zoned = readZonedParts(new Date(instant), SESSION_TIME_ZONE);
    const zonedAsUtc = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second,
    );
    instant = desiredUtc - (zonedAsUtc - instant);
  }
  return new Date(instant);
};

const isBookingWindowClosed = (
  isoDate?: string | null,
  startTime?: string | null,
  now = new Date(),
) => {
  if (!isoDate || !startTime) return false;
  const start = zonedWallTimeToUtc(isoDate, startTime);
  if (!start) return false;
  return now.getTime() > start.getTime() + BOOKING_GRACE_MS;
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const resolveCoachOccurrence = async (
  client: SupabaseClient,
  coachId: string,
  slotId: string,
  sessionDate: string | null,
) => {
  if (!slotId) return null;
  const columns =
    "id, availability_id, weekly_slot_id, coach_id, occurrence_date, session_name, price, start_time";
  const { data: byId } = await client
    .from("coach_availability_slot_occurrences" as any)
    .select(columns)
    .eq("id", slotId)
    .maybeSingle();
  if (byId?.coach_id === coachId) return byId;
  if (!sessionDate) return null;
  const { data: bySlot } = await client
    .from("coach_availability_slot_occurrences" as any)
    .select(columns)
    .eq("weekly_slot_id", slotId)
    .eq("occurrence_date", sessionDate)
    .eq("coach_id", coachId)
    .maybeSingle();
  return bySlot ?? null;
};

const handleWalkIn = async (req: Request, body: any, client: SupabaseClient) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Authentication required" }, 401);
  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: authError } = await client.auth.getUser(token);
  if (authError || !userData.user) return jsonResponse({ error: "Invalid authentication token" }, 401);

  const { data: profile, error: profileError } = await client
    .from("user_profiles" as any)
    .select("coach_id")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  const coachId = profile?.coach_id as string | null;
  if (!coachId) return jsonResponse({ error: "Only a coach can add an athlete to a session." }, 403);

  if (body.action === "walk_in_search") {
    const query = String(body.query ?? "").trim();
    if (query.length < 2) return jsonResponse({ athletes: [] });
    const safe = query.replace(/[%_,]/g, "").slice(0, 80);
    const pattern = `%${safe}%`;

    const { data: byName, error: nameError } = await client
      .from("athlete_profiles" as any)
      .select("id, full_name, user_id")
      .ilike("full_name", pattern)
      .limit(8);
    if (nameError) throw nameError;

    const { data: byEmail, error: emailError } = await client
      .from("user_profiles" as any)
      .select("athlete_id, email, name")
      .ilike("email", pattern)
      .not("athlete_id", "is", null)
      .limit(8);
    if (emailError) throw emailError;

    const userIds = (byName || []).map((row: any) => row.user_id).filter(Boolean);
    const emailsByUser = new Map<string, string>();
    if (userIds.length) {
      const { data: emails } = await client
        .from("user_profiles" as any)
        .select("id, email")
        .in("id", userIds);
      (emails || []).forEach((row: any) => emailsByUser.set(row.id, row.email));
    }

    const athletes = new Map<string, { id: string; name: string; email: string | null }>();
    for (const row of byName || []) {
      athletes.set(row.id, {
        id: row.id,
        name: row.full_name,
        email: emailsByUser.get(row.user_id) ?? null,
      });
    }

    const emailAthleteIds = (byEmail || []).map((row: any) => row.athlete_id).filter(Boolean);
    const { data: emailProfiles } = emailAthleteIds.length
      ? await client.from("athlete_profiles" as any).select("id, full_name").in("id", emailAthleteIds)
      : { data: [] };
    const names = new Map((emailProfiles || []).map((row: any) => [row.id, row.full_name]));
    for (const row of byEmail || []) {
      if (!row.athlete_id) continue;
      const current = athletes.get(row.athlete_id);
      athletes.set(row.athlete_id, {
        id: row.athlete_id,
        name: current?.name || names.get(row.athlete_id) || row.name || "Athlete",
        email: row.email ?? current?.email ?? null,
      });
    }

    return jsonResponse({ athletes: [...athletes.values()].slice(0, 8) });
  }

  const slotId = typeof body.slot_id === "string" ? body.slot_id : "";
  const sessionDate = typeof body.session_date === "string" ? body.session_date : null;
  const occurrence = await resolveCoachOccurrence(client, coachId, slotId, sessionDate);
  if (!occurrence) return jsonResponse({ error: "Session not found." }, 404);

  if (body.action === "walk_in_list") {
    const { data: bookings, error } = await client
      .from("coach_slot_bookings" as any)
      .select("id, athlete_id, status, payment_status")
      .eq("occurrence_id", occurrence.id)
      .in("status", ACTIVE_BOOKING_STATUSES);
    if (error) throw error;
    const athleteIds = (bookings || []).map((row: any) => row.athlete_id).filter(Boolean);
    const { data: profiles } = athleteIds.length
      ? await client.from("athlete_profiles" as any).select("id, full_name").in("id", athleteIds)
      : { data: [] };
    const names = new Map((profiles || []).map((row: any) => [row.id, row.full_name]));
    return jsonResponse({
      athletes: (bookings || []).map((row: any) => ({
        id: row.athlete_id,
        name: names.get(row.athlete_id) || "Athlete",
        bookingId: row.id,
        requiresPayment: row.status === "pending_payment" || row.status === "requested",
      })),
    });
  }

  if (body.action !== "walk_in_add") return jsonResponse({ error: "Unknown action." }, 400);

  const athleteId = typeof body.athlete_id === "string" ? body.athlete_id.trim() : "";
  if (!athleteId) return jsonResponse({ error: "Choose an athlete with an AthaNext account." }, 400);

  const { data: athlete, error: athleteError } = await client
    .from("athlete_profiles" as any)
    .select("id, full_name")
    .eq("id", athleteId)
    .maybeSingle();
  if (athleteError) throw athleteError;
  if (!athlete) {
    return jsonResponse({ error: "This person needs an AthaNext account before they can be added." }, 404);
  }

  const { data: existing, error: existingError } = await client
    .from("coach_slot_bookings" as any)
    .select("id, status")
    .eq("occurrence_id", occurrence.id)
    .eq("athlete_id", athleteId)
    .in("status", ACTIVE_BOOKING_STATUSES)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.status === "requested") {
    // Adding a walk-in for an athlete with an open request counts as the coach accepting it (ATH-49).
    const paid = Number(occurrence.price || 0) <= 0;
    const { error: acceptError } = await client
      .from("coach_slot_bookings" as any)
      .update({
        status: paid ? "booked" : "pending_payment",
        payment_status: paid ? "paid" : "unpaid",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (acceptError) throw acceptError;
    return jsonResponse({
      bookingId: existing.id,
      athlete: { id: athlete.id, name: athlete.full_name },
      requiresPayment: !paid,
      alreadyAdded: true,
    });
  }
  if (existing) {
    return jsonResponse({
      bookingId: existing.id,
      athlete: { id: athlete.id, name: athlete.full_name },
      requiresPayment: existing.status === "pending_payment",
      alreadyAdded: true,
    });
  }

  const requiresPayment = Number(occurrence.price || 0) > 0;
  const { data: inserted, error: insertError } = await client
    .from("coach_slot_bookings" as any)
    .insert({
      occurrence_id: occurrence.id,
      weekly_slot_id: occurrence.weekly_slot_id,
      availability_id: occurrence.availability_id,
      coach_id: occurrence.coach_id,
      athlete_id: athleteId,
      status: requiresPayment ? "pending_payment" : "booked",
      payment_status: requiresPayment ? "unpaid" : "paid",
      notes: "Added by coach after arrival",
      created_by: userData.user.id,
    })
    .select("id")
    .single();
  if (insertError) throw insertError;

  return jsonResponse({
    bookingId: inserted.id,
    athlete: { id: athlete.id, name: athlete.full_name },
    requiresPayment,
    alreadyAdded: false,
  });
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );

  try {
    const rawBody = await req.text();
    const stripeSignature = req.headers.get("stripe-signature");
    const parsedBody = rawBody && !stripeSignature ? JSON.parse(rawBody) : {};

    if (typeof parsedBody.action === "string" && parsedBody.action.startsWith("walk_in_")) {
      return await handleWalkIn(req, parsedBody, supabaseClient);
    }

    // Created on first use, so booking only checkouts (ATH-86) work without a Stripe key.
    // A missing key fails loudly instead of sending unauthenticated calls to Stripe.
    let stripeClient: Stripe | null = null;
    const stripeApi = () => {
      if (stripeClient) return stripeClient;
      const key = Deno.env.get("STRIPE_SECRET_KEY");
      if (!key) {
        console.error("STRIPE_SECRET_KEY is not set: card payments can't run");
        throw new Error("Payments aren't set up yet. Please try again later.");
      }
      stripeClient = new Stripe(key, { apiVersion: "2025-08-27.basil" });
      return stripeClient;
    };
    const ok = (body: unknown = { received: true }) => jsonResponse(body, 200);

    if (parsedBody.action === "notify_booked") {
      return await handleNotifyBooked(req, parsedBody, supabaseClient);
    }

    if (parsedBody.action === "respond_request" || parsedBody.action === "request_sweep") {
      return await handleRequestResponse(req, parsedBody, supabaseClient, stripeApi);
    }

    /** Back from Stripe (or a manual check): settle the Checkout the same way the webhook does. */
    const verifySession = async (sessionId: string) => {
      const session = await stripeApi().checkout.sessions.retrieve(sessionId, {
        expand: ["payment_intent"],
      });

      // Camp sign-up Checkouts (camp-signup) settle their registrations, not bookings.
      if (session.metadata?.kind === "camp") {
        if (session.status === "expired") await releaseCampSession(supabaseClient, session.id);
        const camp = await settleCampSession(supabaseClient, session as any);
        return ok({ session_id: sessionId, payment_status: session.payment_status, status: session.status, paid: camp.paid, camp: true });
      }

      // A request's card hold (ATH-85): create the request now; nothing is charged yet.
      if (session.metadata?.request === "1") {
        const { full } = await createRequestFromSession(session, supabaseClient, stripeApi());
        return ok({ session_id: sessionId, requested: true, held: session.status === "complete" && !full, full });
      }

      if (session.status === "expired") {
        await supabaseClient.rpc("release_unpaid_checkout_holds" as any, { p_session_id: session.id, p_force: false });
      }
      const { paid, newlyPaid } = await settlePaidSession(session, supabaseClient);
      return ok({
        session_id: sessionId,
        payment_status: session.payment_status,
        status: session.status,
        paid,
        reconcile_called: paid && newlyPaid,
      });
    };

    if (req.method === "GET") {
      const sessionId = new URL(req.url).searchParams.get("session_id");
      if (!sessionId) return jsonResponse({ error: "session_id required" }, 400);
      return await verifySession(sessionId);
    }

    if (stripeSignature) {
      // Booking/package/invoice events come from the account endpoint; account.updated comes from
      // the Connect endpoint, which Stripe signs with its own secret.
      const secrets = [
        Deno.env.get("STRIPE_CHECKOUT_WEBHOOK_SECRET"),
        Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET"),
      ].filter((s): s is string => Boolean(s));
      if (!secrets.length) {
        console.error("STRIPE_CHECKOUT_WEBHOOK_SECRET is not set: Stripe webhooks can't be verified");
        return jsonResponse({ error: "Webhook secret not configured" }, 500);
      }

      let event: Stripe.Event | null = null;
      let lastErr: unknown = null;
      for (const secret of secrets) {
        try {
          event = await stripeApi().webhooks.constructEventAsync(rawBody, stripeSignature, secret);
          break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (!event) {
        console.error("Webhook signature verification failed:", lastErr);
        return jsonResponse({ error: "Invalid signature" }, 400);
      }

      // Card refunded or disputed: booking is no longer paid; void held shares / reverse sent ones.
      // A lost dispute is only acted on for camps (bookings were already marked on dispute created).
      const lostDispute =
        event.type === "charge.dispute.closed" && (event.data.object as Stripe.Dispute).status === "lost";
      if (event.type === "charge.refunded" || event.type === "charge.dispute.created" || lostDispute) {
        const charge = event.data.object as Stripe.Charge | Stripe.Dispute;
        const chargeId =
          event.type === "charge.refunded"
            ? (charge as Stripe.Charge).id
            : typeof (charge as Stripe.Dispute).charge === "string"
              ? (charge as Stripe.Dispute).charge
              : (charge as Stripe.Dispute).charge?.id;
        const intentId =
          event.type === "charge.refunded"
            ? typeof (charge as Stripe.Charge).payment_intent === "string"
              ? ((charge as Stripe.Charge).payment_intent as string)
              : (charge as Stripe.Charge).payment_intent?.id ?? null
            : typeof (charge as Stripe.Dispute).payment_intent === "string"
              ? ((charge as Stripe.Dispute).payment_intent as string)
              : (charge as Stripe.Dispute).payment_intent?.id ?? null;
        // Camp sign-up charges: cancel the registrations (full refund or dispute), void or reverse
        // the coach payout, email the coach. Partial refunds leave the spots paid (logged).
        try {
          const camp = await reverseCampCharge(supabaseClient, {
            paymentIntentId: intentId,
            chargeId: (chargeId as string | undefined) ?? null,
            status: event.type === "charge.refunded" ? "refunded" : "disputed",
            full: event.type === "charge.refunded" ? isFullRefund(charge as Stripe.Charge) : true,
          });
          if (camp.handled) {
            return camp.done ? ok() : jsonResponse({ error: "Camp reversal saved; coach email pending" }, 500);
          }
        } catch (e: any) {
          console.error("Camp charge reversal failed:", chargeId, e);
          return jsonResponse({ error: e?.message ?? "Camp reversal failed" }, 500);
        }
        if (lostDispute) return ok();
        if (chargeId) {
          const ids = await bookingIdsForCharge(supabaseClient, chargeId as string, intentId);
          await markBookingsChargeReversed(
            supabaseClient,
            ids,
            event.type === "charge.refunded" ? "refunded" : "disputed",
          );
        }
        return ok();
      }

      // Connect: keep the coach's payout flags fresh; send waiting shares once transfers work.
      if (event.type === "account.updated") {
        const account = event.data.object as Stripe.Account;
        const { data: row, error } = await supabaseClient
          .from("coach_payout_accounts" as any)
          .update(payoutAccountFields(account))
          .eq("stripe_account_id", account.id)
          .select("coach_id, transfers_active")
          .maybeSingle();
        if (error) {
          console.error("Saving Connect account state failed:", account.id, error);
          return jsonResponse({ error: error.message }, 500);
        }
        if ((row as any)?.transfers_active) await callPayoutSweep((row as any).coach_id);
        return ok();
      }

      // Group pass renewals (academy packages): each monthly payment adds a month of credits.
      // The first month (or a $0 trial checkout) is handled with checkout.session.completed below.
      // $0 trial invoices (subscription_create) do not grant credits. 404 = not a package
      // subscription (for example the coach plan); anything else failing is retried by Stripe.
      if (event.type === "invoice.paid") {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.billing_reason === "subscription_cycle" && (invoice.amount_paid ?? 0) > 0) {
          const r = await serviceCall("reconcile-package-payment", { invoice_id: invoice.id });
          if (!r.ok && r.status !== 404) {
            console.error("Renewal reconcile failed:", invoice.id, r.status, r.text);
            return jsonResponse({ error: "Renewal reconcile failed" }, 500);
          }
        }
        return ok();
      }

      // Monthly group pass ended (cancel at period end or Stripe cancelled it).
      if (event.type === "customer.subscription.deleted") {
        const sub = event.data.object as Stripe.Subscription;
        const { error } = await supabaseClient
          .from("package_purchases" as any)
          .update({ status: "expired", updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", sub.id)
          .in("status", ["active", "trialing"]);
        if (error) return jsonResponse({ error: error.message }, 500);
        return ok();
      }

      // Unpaid booking Checkout lapsed: give its spots (and credits used with it) back.
      if (event.type === "checkout.session.expired") {
        const session = event.data.object as Stripe.Checkout.Session;
        const meta = session.metadata ?? {};
        // Camp sign-up: the athletes' spots go back.
        if (meta.kind === "camp") {
          try {
            const released = await releaseCampSession(supabaseClient, session.id);
            return ok({ received: true, released });
          } catch (e: any) {
            console.error("Releasing expired camp Checkout failed:", session.id, e);
            return jsonResponse({ error: e?.message ?? "Release failed" }, 500);
          }
        }
        if (meta.request === "1" || meta.type || meta.kind) return ok();
        const { data: released, error } = await supabaseClient.rpc("release_unpaid_checkout_holds" as any, {
          p_session_id: session.id,
          p_force: false,
        });
        if (error) {
          console.error("Releasing expired Checkout failed:", session.id, error);
          return jsonResponse({ error: error.message }, 500);
        }
        return ok({ received: true, released });
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.metadata?.request === "1") {
          await createRequestFromSession(session, supabaseClient, stripeApi());
          return ok();
        }

        // Package purchases (ATH-94): reconcile-package-payment adds the credits and pays the coach.
        // It is safe to repeat, so a failure answers 500 and Stripe retries.
        if (session.metadata?.type === "package_purchase") {
          const r = await serviceCall("reconcile-package-payment", { session_id: session.id });
          if (!r.ok) {
            console.error("Package reconcile failed:", session.id, r.status, r.text);
            return jsonResponse({ error: "Package reconcile failed" }, 500);
          }
          return ok();
        }

        // Camp sign-ups (camp-signup): mark exactly the registrations in the metadata paid, then
        // payout planning, receipt and coach email. Safe to repeat; 500 while anything is left.
        if (session.metadata?.kind === "camp") {
          try {
            const { followupsDone } = await settleCampSession(supabaseClient, session as any);
            if (!followupsDone) return jsonResponse({ error: "Camp paid; follow-ups pending" }, 500);
          } catch (e: any) {
            console.error("Settling camp Checkout failed:", session.id, e);
            return jsonResponse({ error: e?.message ?? "Camp settle failed" }, 500);
          }
          return ok();
        }

        // Coach invoices (ATH-89) use the same Stripe account; coach-invoices settles them (safe to repeat).
        if (session.metadata?.kind === "invoice" && session.metadata?.invoice_id) {
          const r = await serviceCall("coach-invoices", { action: "settle", invoice_id: session.metadata.invoice_id });
          if (!r.ok) {
            console.error("Invoice settle failed:", session.metadata.invoice_id, r.status, r.text);
            return jsonResponse({ error: "Invoice settle failed" }, 500);
          }
          return ok();
        }

        // Only one-off booking Checkouts are left (the coach plan is handled by coach-billing).
        if (session.mode === "payment" && isSessionPaid(session)) {
          try {
            const { followupsDone } = await settlePaidSession(session, supabaseClient);
            // Bookings are paid; emails/payouts still to finish: let Stripe retry the event.
            if (!followupsDone) return jsonResponse({ error: "Paid; follow-ups pending" }, 500);
          } catch (updErr: any) {
            console.error("Failed to mark bookings paid:", updErr);
            return jsonResponse({ error: updErr?.message || "Failed to update booking status" }, 500);
          }
        }
      }

      return ok();
    }

    if (parsedBody.session_id && typeof parsedBody.session_id === "string") {
      return await verifySession(parsedBody.session_id);
    }

    const {
      occurrence_id,
      occurrence_ids,
      athlete_id,
      notes,
    } = parsedBody;

    const occurrenceIds: string[] = Array.isArray(occurrence_ids)
      ? occurrence_ids
      : occurrence_id
        ? [occurrence_id]
        : [];

    if (!occurrenceIds.length) {
      throw new Error("occurrence_id or occurrence_ids is required");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authentication required for booking");
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !userData.user) {
      console.error("Authentication failed:", authError);
      throw new Error("Invalid authentication token");
    }
    const user = userData.user;

    if (typeof athlete_id !== "string" || !athlete_id.trim()) {
      throw new Error("athlete_id is required");
    }
    const athleteId = athlete_id.trim();

    const { data: occurrences, error: occErr } = await supabaseClient
      .from("coach_availability_slot_occurrences" as any)
      .select(
        "id, availability_id, weekly_slot_id, coach_id, occurrence_date, session_name, price, duration_minutes, start_time, end_time, session_type, location, max_bookings_per_slot, is_enabled, is_draft, visibility, offered_to",
      )
      .in("id", occurrenceIds);
    if (occErr) throw occErr;
    if (!occurrences || occurrences.length !== occurrenceIds.length) {
      throw new Error("One or more occurrences not found");
    }


    const defaultGroupCapacity = await fetchDefaultGroupCapacity(supabaseClient);
    const { data: existingBookings, error: bookingsErr } = await supabaseClient
      .from("coach_slot_bookings" as any)
      .select("id, occurrence_id, athlete_id, status, payment_status, stripe_session_id, hold_expires_at")
      .in("occurrence_id", occurrenceIds)
      .in("status", ACTIVE_BOOKING_STATUSES);
    if (bookingsErr) throw bookingsErr;

    const bookingsByOccurrence = new Map<string, any[]>();
    (existingBookings || []).forEach((row) => {
      const list = bookingsByOccurrence.get(row.occurrence_id) || [];
      list.push(row);
      bookingsByOccurrence.set(row.occurrence_id, list);
    });

    for (const occ of occurrences) {
      if (!occ.is_enabled || occ.is_draft) {
        throw new Error("This session isn't available to book.");
      }
      const capacity = occ.session_type === "group"
        ? (occ.max_bookings_per_slot && occ.max_bookings_per_slot > 0 ? occ.max_bookings_per_slot : defaultGroupCapacity)
        : (occ.max_bookings_per_slot && occ.max_bookings_per_slot > 0 ? occ.max_bookings_per_slot : 1);
      const bookingsForOcc = bookingsByOccurrence.get(occ.id) || [];
      const currentCount = bookingsForOcc.length;
      const myBookingForOcc = bookingsForOcc.find((b) => b.athlete_id === athleteId);
      if (currentCount >= capacity && !myBookingForOcc) {
        throw new Error(`Occurrence on ${occ.occurrence_date} is fully booked`);
      }
    }

    const myBookings = (existingBookings || []).filter((b) => b.athlete_id === athleteId);
    // Spots this family's own unpaid Checkout holds (pending, or a credit in the same basket).
    const isHold = (b: any) =>
      Boolean(b.hold_expires_at) && (b.status === "pending_payment" || (b.status === "booked" && b.payment_status === "credit"));
    const hasPaidBooking = myBookings.some((b) => (b.status === "booked" || b.status === "completed") && !isHold(b));
    if (hasPaidBooking) {
      throw new Error("You already have a booking for this session.");
    }
    if (myBookings.some((b) => b.status === "requested")) {
      throw new Error("You already requested this session. The coach will confirm it soon.");
    }

    const myPendingBookings = myBookings.filter((b) => b.status === "pending_payment");
    const pendingOccSet = new Set(myPendingBookings.map((b) => b.occurrence_id));
    const coversAllPending = myPendingBookings.length > 0
      && occurrenceIds.every((id) => pendingOccSet.has(id))
      && pendingOccSet.size === occurrenceIds.length;
    let reusingPendingBookings = false;

    /**
     * Starting again replaces this family's earlier unpaid Checkout for these sessions: it is
     * expired on Stripe (so an old tab can't be paid) and its held spots and credits are given
     * back. Unpaid bookings that are not Checkout holds (an accepted request, a walk-in) still
     * have to be paid from My sessions.
     */
    const releaseOwnHolds = async () => {
      if (myPendingBookings.some((b) => !b.hold_expires_at)) {
        throw new Error("You already have a pending booking for this session. Please complete payment for it before creating a new one.");
      }
      const holds = myBookings.filter(isHold);
      if (!holds.length) return;
      const sessionIds = [...new Set(holds.map((b) => b.stripe_session_id).filter(Boolean))] as string[];
      if (sessionIds.length && await closeCheckouts(stripeApi(), supabaseClient, sessionIds)) {
        throw new Error("Your earlier payment for this session went through. Check My sessions.");
      }
      for (const id of sessionIds) {
        const { error } = await supabaseClient.rpc("release_unpaid_checkout_holds" as any, { p_session_id: id, p_force: true });
        if (error) throw error;
      }
      // Holds whose Checkout never started (a crash before Stripe answered).
      const orphans = holds.filter((b) => !b.stripe_session_id);
      if (orphans.length) {
        await undoAttempt(supabaseClient, {
          pendingIds: orphans.filter((b) => b.status === "pending_payment").map((b) => b.id),
          creditIds: orphans.filter((b) => b.status === "booked").map((b) => b.id),
        });
      }
    };

    if (!coversAllPending) {
      const closed = occurrences.find((occ) =>
        isBookingWindowClosed(occ.occurrence_date, occ.start_time)
      );
      if (closed) {
        throw new Error(
          "This session can no longer be booked. Booking stays open until 10 minutes after the start time (Eastern).",
        );
      }
    }

    // Before credits are counted, so credits held by the replaced Checkout count again.
    if (!coversAllPending) await releaseOwnHolds();

    const feeConfig = await loadFeeConfig(supabaseClient);

    // Platform fee waiver: confirmed offline coach-client relationship for this exact
    // (coach, athlete) pair, and only when it is the caller's own athlete profile; otherwise
    // anyone could borrow a confirmed pair's waiver by sending that athlete's id. A query
    // error falls through to the full fee (fails safe toward charging).
    const { data: ownProfile } = await supabaseClient
      .from("user_profiles" as any)
      .select("athlete_id")
      .eq("id", user.id)
      .maybeSingle();
    const { data: ownAthleteRows } = await supabaseClient
      .from("athlete_profiles" as any)
      .select("id")
      .eq("id", athleteId)
      .eq("user_id", user.id)
      .limit(1);
    const callerOwnsAthlete =
      (ownProfile as { athlete_id?: string | null } | null)?.athlete_id === athleteId ||
      Boolean(ownAthleteRows?.length);
    const useCredits = parsedBody.use_credits !== false;
    const wantOffline = parsedBody.pay_offline === true;

    const offlineReady = (raw: unknown) => {
      if (!raw || typeof raw !== "object") return false;
      const o = raw as Record<string, unknown>;
      if (!o.on) return false;
      const methods = (o.methods ?? {}) as Record<string, { on?: boolean; handle?: string }>;
      const cash = methods.cash?.on;
      const zelle = methods.zelle?.on && String(methods.zelle.handle ?? "").trim();
      const venmo = methods.venmo?.on && String(methods.venmo.handle ?? "").trim();
      return Boolean(cash || zelle || venmo);
    };

    // One plan per coach (ATH-94: one payment can cover several coaches). Each coach's own
    // rules decide whether their sessions are paid now, requested (card held, ATH-85) or paid
    // to the coach directly (legacy booking only, or WC4 offline for invited clients).
    type Plan = {
      coachId: string;
      occs: typeof occurrences;
      mode: "instant" | "request" | "direct";
      /** pending_offline until the coach confirms; legacy booking-only stays direct. */
      offlinePending: boolean;
      directRequest: boolean;
      /** Existing client of this coach: no platform fee. */
      platformWaived: boolean;
      credits: number;
      /** Credits by kind: the coach's own (any session), academy 1-on-1 and academy group passes. */
      creditCounts: { own: number; individual: number; group: number };
    };
    const plans: Plan[] = [];
    for (const cid of [...new Set(occurrences.map((o) => o.coach_id as string))]) {
      const occs = occurrences.filter((o) => o.coach_id === cid);
      // limit(1) rather than maybeSingle(): a duplicate row must not error into the full fee.
      const { data: waiverRows } = callerOwnsAthlete
        ? await supabaseClient
            .from("coach_client_referrals" as any)
            .select("id")
            .eq("coach_id", cid)
            .eq("athlete_id", athleteId)
            .eq("status", "confirmed")
            .limit(1)
        : { data: [] };
      const platformWaived = Boolean(waiverRows?.length);

      // A family already trains with the coach when they have a booked or completed session,
      // or a confirmed referral (ATH-71). Only those families can book "clients" sessions,
      // and they always book instantly.
      const { count: pastSessions } = await supabaseClient
        .from("coach_slot_bookings" as any)
        .select("id", { count: "exact", head: true })
        .eq("coach_id", cid)
        .eq("athlete_id", athleteId)
        .in("status", ["booked", "completed"]);
      const { data: confirmedReferral } = await supabaseClient
        .from("coach_client_referrals" as any)
        .select("id")
        .eq("coach_id", cid)
        .eq("athlete_id", athleteId)
        .eq("status", "confirmed")
        .limit(1);
      const isClient = Boolean(pastSessions) || Boolean(confirmedReferral?.length);
      if (!isClient && occs.some((occ) => occ.visibility === "clients")) {
        throw new Error("This session is only open to the coach's current athletes.");
      }
      // A session the coach offered to this athlete by name (a suggested time, ATH-85) is the
      // coach's own choice, so it books straight away.
      const offeredToMe = occs.every(
        (occ) => occ.visibility === "offered" && ((occ as { offered_to?: string[] }).offered_to ?? []).includes(athleteId),
      );
      const { data: coachSettings } = await supabaseClient
        .from("coaches" as any)
        .select("new_family_booking, pay_mode, offline_pay")
        .eq("id", cid)
        .maybeSingle();
      const settings = coachSettings as {
        new_family_booking?: string;
        pay_mode?: string;
        offline_pay?: unknown;
      } | null;
      // New families request instead of booking when the coach asks for that (ATH-49, ATH-71).
      const needsRequest = !coversAllPending && !isClient && !offeredToMe && settings?.new_family_booking === "request";
      const legacyDirect = settings?.pay_mode === "self";
      const offlineOk = wantOffline && isClient && offlineReady(settings?.offline_pay);
      if (wantOffline && !offlineOk && !legacyDirect) {
        throw new Error("Offline payment isn't available for this booking.");
      }
      const mode: Plan["mode"] = legacyDirect || offlineOk ? "direct" : needsRequest ? "request" : "instant";

      // Package and cancellation credits with this coach are used first (ATH-94), then academy
      // credits that include the coach: 1-on-1 packages for 1-on-1s, group passes for groups.
      let credits = 0;
      const creditCounts = { own: 0, individual: 0, group: 0 };
      if (mode === "instant" && useCredits && callerOwnsAthlete && !coversAllPending) {
        const { data: counts } = await supabaseClient.rpc("coach_credit_counts" as any, { p_coach_id: cid, p_athlete_id: athleteId });
        const c = (counts ?? {}) as Record<string, unknown>;
        creditCounts.own = Number(c.own) || 0;
        creditCounts.individual = Number(c.individual) || 0;
        creditCounts.group = Number(c.group) || 0;
        credits = creditCounts.own + creditCounts.individual + creditCounts.group;
      }
      plans.push({
        coachId: cid,
        occs,
        mode,
        offlinePending: offlineOk && !legacyDirect,
        directRequest: legacyDirect && needsRequest,
        platformWaived,
        credits,
        creditCounts,
      });
    }

    if (new Set(plans.map((p) => p.mode)).size > 1) {
      throw new Error("Book requests, sessions paid in the app and sessions paid to the coach separately.");
    }
    const mode = plans[0].mode;
    const firstCoachId = plans[0].coachId;
    const planFor = (cid: string) => plans.find((p) => p.coachId === cid)!;
    // Coaches whose fee is waived for this family (their own clients); payment rows use it.
    const waivedCoaches = plans.filter((p) => p.platformWaived).map((p) => p.coachId).join(",");
    const lineItem = (occ: (typeof occurrences)[number], unit: number, note = "") => ({
      price_data: {
        currency: "usd",
        unit_amount: unit,
        product_data: {
          name: occ.session_name || "Coaching Session",
          description: `${occ.session_type || "session"} on ${occ.occurrence_date}${note}`,
        },
      },
      quantity: 1,
    });
    const origin = req.headers.get("origin");
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    const rowFor = (occ: (typeof occurrences)[number], status: string, paymentStatus: string) => ({
      occurrence_id: occ.id,
      weekly_slot_id: occ.weekly_slot_id,
      availability_id: occ.availability_id,
      coach_id: occ.coach_id,
      athlete_id: athleteId,
      status,
      payment_status: paymentStatus,
      notes: notes || null,
      created_by: user.id,
    });

    // Pay the coach directly: legacy booking-only (ATH-86) or WC4 offline for invited clients.
    // Nothing goes to Stripe. Offline stays pending_offline until the coach confirms receipt.
    if (mode === "direct") {
      const payStatusFor = (cid: string) => (planFor(cid).offlinePending ? "pending_offline" : "direct");
      if (coversAllPending) {
        const { error: confirmErr } = await supabaseClient
          .from("coach_slot_bookings" as any)
          .update({
            status: "booked",
            payment_status: payStatusFor(firstCoachId),
            updated_at: new Date().toISOString(),
          })
          .in("id", myPendingBookings.map((b) => b.id));
        if (confirmErr) throw confirmErr;
        await inBackground(notifyConfirmed(supabaseClient, myPendingBookings.map((b) => b.id)));
        return json({ direct: true, offline: plans[0].offlinePending, booking_ids: myPendingBookings.map((b) => b.id) });
      }
      const { data: rows, error } = await supabaseClient
        .from("coach_slot_bookings" as any)
        .insert(occurrences.map((occ) =>
          planFor(occ.coach_id).directRequest
            ? rowFor(occ, "requested", "unpaid")
            : rowFor(occ, "booked", payStatusFor(occ.coach_id))
        ))
        .select("id, status");
      if (error) throw error;
      const requested = ((rows || []) as any[]).some((r) => r.status === "requested");
      await inBackground(notifyConfirmed(supabaseClient, ((rows || []) as any[]).filter((r) => r.status === "booked").map((r) => r.id)));
      return json({
        direct: !requested,
        offline: !requested && plans.some((p) => p.offlinePending),
        requested,
        booking_ids: ((rows || []) as any[]).map((r) => r.id),
      });
    }

    const isFree = (occ: (typeof occurrences)[number]) => Number(occ.price || 0) <= 0;
    const occurrenceById = new Map(occurrences.map((o) => [o.id, o]));
    // Free sessions never go to Stripe (a $0 session would otherwise be a $0.30 charge, below
    // Stripe's minimum). They are booked straight away; "outside" = nothing to collect in the app.
    const FREE_PAYMENT_STATUS = "outside";
    const expiry = checkoutExpiry(Date.now());
    const checkoutTotal = (occs: typeof occurrences, note = "") => {
      // The shared fee math; the lines add up to its total, which is what the family was shown.
      const fees = checkoutFees(
        occs.map((occ) => ({
          listCents: toCents(Number(occ.price || 0)),
          kind: "session" as const,
          platformWaived: planFor(occ.coach_id).platformWaived,
        })),
        feeConfig,
      );
      if (fees.totalCents < MIN_CHARGE_CENTS) {
        throw new Error("This total is below the $0.50 card minimum, so it can't be paid by card. Ask the coach to check the price.");
      }
      return occs.map((occ, i) => lineItem(occ, fees.lines[i].totalCents, note));
    };

    // In-app requests (ATH-85): the family's card is held on Stripe's page and charged only
    // if the coach accepts. The requests are created once the card is held.
    if (mode === "request") {
      const paidOccs = occurrences.filter((o) => !isFree(o));
      if (!paidOccs.length) {
        // Free requests: nothing to hold. The coach accepts or declines as usual.
        const { data: rows, error } = await supabaseClient
          .from("coach_slot_bookings" as any)
          .insert(occurrences.map((occ) => rowFor(occ, "requested", "unpaid")))
          .select("id");
        if (error) throw error;
        return json({ requested: true, booking_ids: ((rows || []) as any[]).map((r) => r.id) });
      }
      const holdSession = await stripeApi().checkout.sessions.create(
        {
          customer_email: user.email || undefined,
          payment_method_types: ["card"],
          mode: "payment",
          line_items: checkoutTotal(paidOccs, ". Charged only if the coach accepts."),
          payment_intent_data: {
            capture_method: "manual",
            ...(user.email ? { receipt_email: user.email } : {}),
            metadata: { request: "1" },
          },
          expires_at: expiry.unix,
          success_url: `${origin}/booking-confirmation?request=1&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/book`,
          metadata: {
            request: "1",
            occurrence_ids: occurrenceIds.join(","),
            coach_id: firstCoachId,
            athlete_id: athleteId,
            user_id: user.id,
            notes: String(notes || "").slice(0, 450),
            ...feeConfigMetadata(feeConfig),
            waived_coaches: waivedCoaches,
          },
        },
        { idempotencyKey: await idempotencyKey("booking-request", [user.id, athleteId, ...occurrenceIds], expiry.unix) },
      );
      return json({ url: holdSession.url, session_id: holdSession.id, request: true });
    }

    // Paid now. Credits first, free sessions straight away, then one Stripe checkout for the
    // rest, across coaches. Anything this attempt creates is undone if a later step fails.
    let bookingIds: string[] = [];
    const creditIds: string[] = [];
    const freeIds: string[] = [];
    const creditOccIds = new Set<string>();
    let toPay = occurrences;
    let previousSessionIds: string[] = [];
    let session: Stripe.Checkout.Session | null = null;
    try {
      if (coversAllPending) {
        reusingPendingBookings = true;
        // The bookings were opened with an earlier Checkout: close it first so paying the old
        // tab can't charge again. If it was paid meanwhile, the bookings are now paid.
        previousSessionIds = [...new Set(myPendingBookings.map((b) => b.stripe_session_id).filter(Boolean))] as string[];
        if (await closeCheckouts(stripeApi(), supabaseClient, previousSessionIds)) {
          return json({ booked: true, already_paid: true, booking_ids: myPendingBookings.map((b) => b.id) });
        }
        const freeRows = myPendingBookings.filter((b) => {
          const occ = occurrenceById.get(b.occurrence_id);
          return occ && isFree(occ);
        });
        if (freeRows.length) {
          const { error } = await supabaseClient
            .from("coach_slot_bookings" as any)
            .update({ status: "booked", payment_status: FREE_PAYMENT_STATUS, hold_expires_at: null, updated_at: new Date().toISOString() })
            .in("id", freeRows.map((b) => b.id))
            .eq("status", "pending_payment");
          if (error) throw error;
          freeIds.push(...freeRows.map((b) => b.id));
        }
        toPay = occurrences.filter((o) => !isFree(o));
        bookingIds = myPendingBookings.filter((b) => !freeIds.includes(b.id)).map((b) => b.id);
      } else {
        const byDate = [...occurrences]
          .filter((o) => !isFree(o))
          .sort((a, b) => `${a.occurrence_date}${a.start_time}`.localeCompare(`${b.occurrence_date}${b.start_time}`));
        const creditOccs: typeof occurrences = [];
        for (const plan of plans) {
          const left = { ...plan.creditCounts };
          for (const occ of byDate.filter((o) => o.coach_id === plan.coachId)) {
            const kind = (occ as { session_type?: string }).session_type === "group" ? "group" : "individual";
            if (left.own > 0) left.own--;
            else if (left[kind] > 0) left[kind]--;
            else continue;
            creditOccs.push(occ);
          }
        }
        for (const occ of creditOccs) {
          const { data: row, error } = await supabaseClient
            .from("coach_slot_bookings" as any)
            .insert(rowFor(occ, "booked", "credit"))
            .select("id")
            .single();
          if (error) throw error;
          const { data: redeemed, error: redeemErr } = await supabaseClient.rpc("redeem_coach_credit" as any, { p_booking_id: (row as any).id });
          if (redeemed) {
            creditIds.push((row as any).id);
            creditOccIds.add(occ.id);
          } else {
            // Someone used the last credit meanwhile (or redeeming failed): pay for this one instead.
            if (redeemErr) console.error("Redeeming a credit failed", (row as any).id, redeemErr);
            await supabaseClient.from("coach_slot_bookings" as any).delete().eq("id", (row as any).id);
          }
        }
        const freeOccs = occurrences.filter((o) => isFree(o));
        if (freeOccs.length) {
          const { data: freeRows, error: freeErr } = await supabaseClient
            .from("coach_slot_bookings" as any)
            .insert(freeOccs.map((occ) => rowFor(occ, "booked", FREE_PAYMENT_STATUS)))
            .select("id");
          if (freeErr) throw freeErr;
          freeIds.push(...((freeRows || []) as any[]).map((r) => r.id));
        }
        toPay = occurrences.filter((o) => !creditOccIds.has(o.id) && !isFree(o));
        if (toPay.length) {
          const { data: bookingRows, error: bookingErr } = await supabaseClient
            .from("coach_slot_bookings" as any)
            .insert(toPay.map((occ) => ({ ...rowFor(occ, "pending_payment", "unpaid"), hold_expires_at: expiry.iso })))
            .select("id, occurrence_id");
          if (bookingErr) throw bookingErr;
          bookingIds = (bookingRows || []).map((b: any) => b.id);
        }
      }

      if (!toPay.length) {
        // Nothing left to charge: credits and free sessions are booked now.
        const booked = [...creditIds, ...freeIds];
        await inBackground(notifyConfirmed(supabaseClient, booked));
        return json({ credits_used: creditIds.length, booked: true, booking_ids: booked });
      }
      const lines = checkoutTotal(toPay);

      let customerId: string | undefined;
      if (user?.email) {
        const customers = await stripeApi().customers.list({ email: user.email, limit: 1 });
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
        }
      }

      // Same bookings + same earlier Checkout + same minute = same Checkout back from Stripe.
      const attempt = `${previousSessionIds.length ? [...previousSessionIds].sort().join("+") : "new"}:${expiry.unix}`;
      session = await stripeApi().checkout.sessions.create(
        {
          customer: customerId,
          customer_email: customerId ? undefined : user.email || undefined,
          // Card covers Apple Pay and Google Pay where the device supports them.
          payment_method_types: ["card"],
          line_items: lines,
          mode: "payment",
          // Unpaid Checkouts lapse (and their spots are released) instead of holding them for 24h.
          expires_at: expiry.unix,
          // Stripe emails the receipt (ATH-91). The card is never saved for later.
          payment_intent_data: user.email ? { receipt_email: user.email } : undefined,
          success_url: `${origin}/booking-confirmation?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: plans.length > 1 ? `${origin}/book` : `${origin}/coach/${firstCoachId}`,
          metadata: {
            occurrence_ids: metadataList(toPay.map((o) => o.id)),
            booking_ids: metadataList(bookingIds),
            coach_id: firstCoachId,
            availability_id: toPay[0].availability_id ?? "",
            weekly_slot_id: toPay[0].weekly_slot_id ?? "",
            athlete_id: athleteId,
            ...feeConfigMetadata(feeConfig),
            waived_coaches: waivedCoaches,
            credit_booking_ids: metadataList(creditIds),
          },
        },
        { idempotencyKey: await idempotencyKey("booking-checkout", bookingIds, attempt) },
      );

      // Rows this Checkout holds: new pending rows, credits in the same basket, and reused rows
      // that were already Checkout holds. Reused rows that aren't holds (an accepted request, a
      // walk-in) only point at the new Checkout and are never released.
      const heldBefore = new Set(myPendingBookings.filter((b) => b.hold_expires_at).map((b) => b.id));
      const holdIds = reusingPendingBookings ? bookingIds.filter((id) => heldBefore.has(id)) : [...bookingIds, ...creditIds];
      const plainIds = reusingPendingBookings ? bookingIds.filter((id) => !heldBefore.has(id)) : [];
      const intentId = extractPaymentIntentId(session);
      if (holdIds.length) {
        const { error } = await supabaseClient
          .from("coach_slot_bookings" as any)
          .update({ stripe_session_id: session.id, stripe_payment_intent: intentId, hold_expires_at: expiry.iso })
          .in("id", holdIds);
        if (error) throw error;
      }
      if (plainIds.length) {
        const { error } = await supabaseClient
          .from("coach_slot_bookings" as any)
          .update({ stripe_session_id: session.id, stripe_payment_intent: intentId })
          .in("id", plainIds);
        if (error) throw error;
      }
      if (previousSessionIds.length) {
        // Credits held with the earlier Checkout now wait for this one.
        const { error } = await supabaseClient
          .from("coach_slot_bookings" as any)
          .update({ stripe_session_id: session.id, hold_expires_at: expiry.iso })
          .in("stripe_session_id", previousSessionIds)
          .eq("payment_status", "credit")
          .eq("status", "booked")
          .not("hold_expires_at", "is", null);
        if (error) throw error;
      }

      // Free sessions in the same basket are booked already; credits wait for the payment.
      if (freeIds.length) await inBackground(notifyConfirmed(supabaseClient, freeIds));
      return json({ url: session.url, session_id: session.id, credits_used: creditIds.length });
    } catch (err) {
      // Never leave a spot held, a credit spent or a payable Checkout behind a failed attempt.
      if (session) {
        await stripeApi().checkout.sessions.expire(session.id).catch((e: unknown) =>
          console.error("Expiring the Checkout of a failed attempt failed", session?.id, e)
        );
      }
      await undoAttempt(supabaseClient, {
        pendingIds: reusingPendingBookings ? [] : bookingIds,
        creditIds,
        freeIds: reusingPendingBookings ? [] : freeIds,
      });
      throw err;
    }
  } catch (error) {
    console.error("Error creating booking payment:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
