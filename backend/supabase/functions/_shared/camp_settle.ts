// Settling a paid camp Checkout and its follow-ups. Used by the Stripe webhook
// (create-booking-payment, deployed as create-booking-payment-v0) and by camp-signup's status
// check when the family is back from Stripe before the webhook arrived.
//
// camp_checkout_paid() marks exactly the registrations in the Checkout metadata paid in one
// transaction (safe to repeat). Follow-ups (coach payout planning, the parent's receipt, the
// coach's email) run after it; each step is stamped on camp_signups once it succeeds and the
// whole thing is claimed with a short lease, so a failed step is retried (Stripe retries the
// webhook while we answer 500) without sending a step twice.

import { bookingEmailSender, emailAddress, SUPPORT_EMAIL } from "./email_sender.ts";
import { campCoachEmail, campParentEmail, campReversedEmail } from "./camp_emails.ts";
import { finishAccountUrl, parseCampMetadata } from "./camp_signup.ts";

// deno-lint-ignore no-explicit-any
type Loose = any;
/** Any service-role Supabase client. */
export type CampAdmin = { rpc: (fn: string, args?: Record<string, unknown>) => Loose; from: (table: string) => Loose };

/** The fields of a Stripe Checkout Session this module reads. */
export interface CampSession {
  id: string;
  status?: string | null;
  payment_status?: string | null;
  amount_total?: number | null;
  payment_intent?: string | { id?: string; status?: string } | null;
  metadata?: Record<string, unknown> | null;
}

const FOLLOWUP_LEASE_MS = 5 * 60 * 1000;

/**
 * A readable Error from a PostgREST error object ({ message, code, details, hint }), which is not
 * an Error and logs without a label. A stale API schema shows here, for example
 * "column camp_signups.followup_claimed_at does not exist (42703)".
 */
export const postgrestError = (context: string, error: unknown): Error => {
  if (error instanceof Error) return new Error(`${context}: ${error.message}`);
  const e = (error ?? {}) as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
  const parts = [
    typeof e.message === "string" && e.message ? e.message : "unknown error",
    typeof e.code === "string" && e.code ? `(${e.code})` : "",
    typeof e.details === "string" && e.details ? `details: ${e.details}` : "",
    typeof e.hint === "string" && e.hint ? `hint: ${e.hint}` : "",
  ].filter(Boolean);
  return new Error(`${context}: ${parts.join(" ")}`);
};

export const appOrigin = () => Deno.env.get("APP_ORIGIN") || Deno.env.get("SITE_URL") || "https://athanext.com";

/** Where the coach sees a camp's registrations. */
export const coachRegistrationsUrl = (origin: string, campId: string) =>
  `${origin}/profile?camp=${encodeURIComponent(campId)}&view=registrations`;

const intentId = (session: CampSession): string | null => {
  const intent = session.payment_intent;
  if (!intent) return null;
  if (typeof intent === "string") return intent;
  return intent.id ?? null;
};

export const isCampSessionPaid = (session: CampSession) =>
  session.payment_status === "paid" ||
  (typeof session.payment_intent === "object" && session.payment_intent?.status === "succeeded");

const serviceCall = async (fn: string, body: unknown) => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) return { ok: false, status: 0, text: "not configured" };
  try {
    const resp = await fetch(`${url}/functions/v1/${fn}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    return { ok: resp.ok, status: resp.status, text: await resp.text() };
  } catch (e) {
    return { ok: false, status: 0, text: e instanceof Error ? e.message : String(e) };
  }
};

/** Sends through send-email from the configured mailbox. False when it did not go out. */
export const sendCampEmail = async (admin: CampAdmin, to: string | null | undefined, subject: string, html: string) => {
  if (!to) return false;
  const { data: cfg } = await admin.from("configurations").select("value").eq("key", "smtp_email").maybeSingle();
  const sender = bookingEmailSender(cfg?.value);
  if (!sender) {
    console.error("smtp_email is not configured: camp email not sent");
    return false;
  }
  // BCC support so ops see camp receipts / holds / coach notices without appearing on To.
  const r = await serviceCall("send-email", {
    to,
    from: sender.from,
    replyTo: sender.replyTo,
    ...(emailAddress(to) === SUPPORT_EMAIL ? {} : { bcc: SUPPORT_EMAIL }),
    subject,
    html,
  });
  if (!r.ok) console.error("Camp email failed:", r.status, r.text);
  return r.ok;
};

// deno-lint-ignore no-explicit-any
const asAthletes = (value: unknown): any[] => (Array.isArray(value) ? value : []);

/**
 * Receipt (paid) or "spot held" email to the parent, and the coach's email, for one sign-up.
 * Each is stamped on camp_signups when it goes out and skipped when already stamped.
 * Returns true when nothing is left to send.
 */
export const sendCampSignupEmails = async (
  admin: CampAdmin,
  signupId: string,
  kind: "paid" | "held",
  origin: string,
): Promise<boolean> => {
  const { data: signup, error } = await admin
    .from("camp_signups")
    .select("id, camp_id, coach_id, parent_email, amount_total_cents, receipt_sent_at, coach_notified_at")
    .eq("id", signupId)
    .maybeSingle();
  if (error || !signup) {
    console.error("Camp sign-up not found for emails:", signupId, error);
    return false;
  }
  const { data: status, error: statusError } = await admin.rpc("camp_signup_status", { p_signup_id: signupId });
  if (statusError || !status) {
    console.error("Camp sign-up status failed:", signupId, statusError);
    return false;
  }
  const wanted = kind === "paid" ? "paid" : "held";
  const athletes = asAthletes(status.athletes).filter((a) => a.status === wanted);
  if (!athletes.length) return true; // nothing confirmed (for example paid without a spot: refunded by hand)
  const camp = { ...status.camp, coach_name: status.camp?.coach_name ?? "Your coach" };
  const { data: firstRow } = await admin
    .from("camp_registrations")
    .select("parent_name")
    .eq("signup_id", signupId)
    .limit(1)
    .maybeSingle();
  const parentName = (firstRow?.parent_name as string | null) ?? null;
  let ok = true;

  if (!signup.receipt_sent_at) {
    const { subject, html } = campParentEmail({
      kind,
      parentName,
      camp,
      athletes,
      amountCents: signup.amount_total_cents,
      finishUrl: status.account_exists ? null : finishAccountUrl(origin, signup.parent_email, signupId),
    });
    if (await sendCampEmail(admin, signup.parent_email, subject, html)) {
      await admin.from("camp_signups").update({ receipt_sent_at: new Date().toISOString() }).eq("id", signupId);
    } else {
      ok = false;
    }
  }

  if (!signup.coach_notified_at) {
    const { data: coach } = await admin.from("coaches").select("email").eq("id", signup.coach_id).maybeSingle();
    const { subject, html } = campCoachEmail({
      kind,
      camp,
      parentName,
      parentEmail: signup.parent_email,
      athletes,
      registrationsUrl: coachRegistrationsUrl(origin, signup.camp_id),
    });
    if (!coach?.email) {
      console.warn("Coach has no email: camp sign-up email skipped", signup.coach_id);
      await admin.from("camp_signups").update({ coach_notified_at: new Date().toISOString() }).eq("id", signupId);
    } else if (await sendCampEmail(admin, coach.email, subject, html)) {
      await admin.from("camp_signups").update({ coach_notified_at: new Date().toISOString() }).eq("id", signupId);
    } else {
      ok = false;
    }
  }
  return ok;
};

/**
 * Follow-ups for a paid sign-up, once: coach payout planning, receipt, coach email.
 * False when something is still left (the caller answers 500 so Stripe retries).
 */
export const runCampFollowups = async (admin: CampAdmin, signupId: string, origin = appOrigin()): Promise<boolean> => {
  // PostgREST answers an update filtered with or() on the claim column with "column ... does
  // not exist" (42703), so unclaimed rows and expired leases are claimed in two plain steps.
  const leaseCutoff = new Date(Date.now() - FOLLOWUP_LEASE_MS).toISOString();
  // deno-lint-ignore no-explicit-any
  const claim = (lease: (q: any) => any) =>
    lease(
      admin
        .from("camp_signups")
        .update({ followup_claimed_at: new Date().toISOString() })
        .eq("id", signupId)
        .not("paid_at", "is", null)
        .is("followup_at", null),
    )
      .select("id, purchase_id")
      .maybeSingle();
  let { data: claimed, error } = await claim((q) => q.is("followup_claimed_at", null));
  if (!error && !claimed) ({ data: claimed, error } = await claim((q) => q.lt("followup_claimed_at", leaseCutoff)));
  if (error) {
    const err = postgrestError(`Camp follow-up claim failed for sign-up ${signupId}`, error);
    console.error(err.message);
    throw err;
  }
  if (!claimed) {
    const { data: row } = await admin.from("camp_signups").select("followup_at").eq("id", signupId).maybeSingle();
    return Boolean(row?.followup_at);
  }

  let ok = true;
  if (claimed.purchase_id) {
    // Same as a package: the coach is paid the list price; platform and card fees stay.
    const r = await serviceCall("stripe-payouts", { action: "transfer_packages", purchase_ids: [claimed.purchase_id] });
    if (!r.ok) {
      console.error("Camp payout planning failed:", signupId, r.status, r.text);
      ok = false;
    }
  }
  if (ok) ok = await sendCampSignupEmails(admin, signupId, "paid", origin);

  await admin
    .from("camp_signups")
    .update(ok ? { followup_at: new Date().toISOString(), followup_claimed_at: null } : { followup_claimed_at: null })
    .eq("id", signupId);
  if (!ok) console.error("Camp follow-ups failed; will retry:", signupId);
  return ok;
};

/**
 * A completed camp Checkout: mark it paid (atomic), then the follow-ups.
 * handled = false when the session is not a camp Checkout.
 */
export const settleCampSession = async (admin: CampAdmin, session: CampSession, origin = appOrigin()) => {
  const meta = parseCampMetadata(session.metadata);
  if (!meta) return { handled: false, paid: false, followupsDone: true };
  if (!isCampSessionPaid(session)) return { handled: true, paid: false, followupsDone: true };

  const { data, error } = await admin.rpc("camp_checkout_paid", {
    p_session_id: session.id,
    p_payment_intent: intentId(session) ?? "",
    p_signup_id: meta.signupId,
    p_registration_ids: meta.registrationIds,
    p_amount_total_cents: session.amount_total ?? null,
  });
  if (error) throw error;
  if (!data?.found) {
    console.error("PAID CAMP WITHOUT SPOT: no sign-up for this Checkout, refund by hand", session.id, meta.signupId);
    return { handled: true, paid: true, followupsDone: true };
  }
  const paidCount = Number(data.paid_count ?? 0);
  const without = Array.isArray(data.without_spot) ? data.without_spot : [];
  if (without.length || paidCount === 0) {
    console.error("PAID CAMP WITHOUT SPOT: refund these athletes by hand", session.id, meta.signupId, without, {
      paid_count: paidCount,
    });
  }
  // No spot secured → skip emails/payout follow-ups; ops refund from the log above.
  if (paidCount === 0) {
    return { handled: true, paid: true, followupsDone: true, result: data };
  }
  const followupsDone = await runCampFollowups(admin, meta.signupId, origin);
  return { handled: true, paid: true, followupsDone, result: data };
};

/** An expired camp Checkout: its spots go back. */
export const releaseCampSession = async (admin: CampAdmin, sessionId: string) => {
  const { data, error } = await admin.rpc("camp_release_checkout", { p_session_id: sessionId });
  if (error) throw error;
  return Number(data ?? 0);
};

/** A refund is full when everything charged was refunded. */
export const isFullRefund = (charge: { amount?: number | null; amount_refunded?: number | null; refunded?: boolean | null }) =>
  charge.refunded === true || ((charge.amount ?? 0) > 0 && (charge.amount_refunded ?? 0) >= (charge.amount ?? 0));

/**
 * Card refund (full) or dispute on a camp charge: cancel the sign-up's paid registrations,
 * void/reverse the coach payout, email the coach once. handled = false when the charge is not a
 * camp sign-up (the caller goes on with bookings). done = false when the coach email still has
 * to go out (answer 500 so Stripe retries; the rest is already saved and not repeated).
 */
export const reverseCampCharge = async (
  admin: CampAdmin,
  input: { paymentIntentId: string | null; chargeId: string | null; status: "refunded" | "disputed"; full: boolean },
  origin = appOrigin(),
): Promise<{ handled: boolean; done: boolean }> => {
  const { data, error } = await admin.rpc("camp_charge_reversed", {
    p_payment_intent: input.paymentIntentId ?? "",
    p_charge_id: input.chargeId ?? "",
    p_status: input.status,
    p_full: input.full,
  });
  if (error) throw error;
  if (!data?.found) return { handled: false, done: true };
  if (data.partial) {
    console.warn("Partial refund on a camp charge: registrations stay paid", data.signup_id, input.chargeId);
    return { handled: true, done: true };
  }
  if (Number(data.reversing_transfers) > 0) {
    // Same as bookings: stripe-payouts reverses every share marked reversing.
    const r = await serviceCall("stripe-payouts", { action: "reverse_bookings" });
    if (!r.ok) console.error("Camp payout reversal call failed (the sweep retries):", r.status, r.text);
  }
  if (data.coach_notified) return { handled: true, done: true };

  const { data: signup } = await admin
    .from("camp_signups")
    .select("id, camp_id, coach_id, parent_email, reversed_status")
    .eq("id", data.signup_id)
    .maybeSingle();
  const { data: status } = await admin.rpc("camp_signup_status", { p_signup_id: data.signup_id });
  const { data: coach } = await admin.from("coaches").select("email").eq("id", data.coach_id).maybeSingle();
  const { data: firstRow } = await admin.from("camp_registrations").select("parent_name").eq("signup_id", data.signup_id).limit(1).maybeSingle();
  let sent = true;
  if (coach?.email && status) {
    const { subject, html } = campReversedEmail({
      status: (signup?.reversed_status as "refunded" | "disputed") ?? input.status,
      camp: { ...status.camp, coach_name: status.camp?.coach_name ?? "" },
      parentName: (firstRow?.parent_name as string | null) ?? null,
      parentEmail: signup?.parent_email ?? null,
      athletes: asAthletes(status.athletes).filter((a) => a.status === "cancelled"),
      registrationsUrl: coachRegistrationsUrl(origin, data.camp_id),
    });
    sent = await sendCampEmail(admin, coach.email, subject, html);
  }
  if (sent) {
    await admin.from("camp_signups").update({ reversal_notified_at: new Date().toISOString() }).eq("id", data.signup_id);
  }
  return { handled: true, done: sent };
};
