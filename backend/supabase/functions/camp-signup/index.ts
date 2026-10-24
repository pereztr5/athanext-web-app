// Camp sign-up without an account, plus the coach's camp emails. verify_jwt is off: family
// actions are public (validated, rate limited in camp_signup_start); coach actions check the
// caller's login here and run their RPC as the caller (current_coach_id()).
//
// Family (no login)
//   { action: "quote", camp_id, src?, athletes? }
//       -> { price_cents, platform_waived, direct_allowed, card: FeeBreakdown }. Camps carry no
//          platform fee for anyone: card is the camp price plus card processing; paying the coach
//          directly (offered whenever the camp allows it) is the camp price only.
//   { action: "signup", camp_id, src?, pay_method: "card"|"direct",
//     parent: { name, email, phone? }, note?, waiver: true, photo_consent?,
//     athletes: [{ first_name, last_name, birth_year, group_id, note? }] }
//       card   -> { signup_id, status: "pending_payment", url, session_id, expires_at, fees }
//       direct -> { signup_id, status: "held", hold_expires_at }
//       400 { error, fields } for form errors; 409 full/duplicate; 429 rate limited; 404 closed
//   { action: "status", signup_id, session_id? }
//       -> camp_signup_status (checks Stripe first when a card payment is still pending)
// Coach (Authorization: the coach's session)
//   { action: "coach_add", camp_id, group_id, athlete_id?, first_name?, last_name?, birth_year?,
//     parent_email?, parent_name?, paid, send_details?, send_invite? }
//       -> add_camp_athlete result + { invited, emailed }; the family becomes the coach's client
//          (confirmed referral) and, without an account, gets the usual invite for that row
//   { action: "resend_finish", registration_id } -> { emailed }
//   { action: "send_details", registration_id }  -> { emailed }
//   { action: "resend_invite", referral_id }     -> add-client-referral resend result
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { checkoutExpiry, idempotencyKey, USD_ONLY_CHECKOUT } from "../_shared/checkout.ts";
import { loadFeeConfig } from "../_shared/fee_config.ts";
import { feeConfigMetadata } from "../_shared/fees.ts";
import {
  CAMP_PLATFORM_WAIVED,
  CAMP_RATE_LIMITS,
  campCheckoutFees,
  campDirectAllowed,
  campErrorMessage,
  campErrorStatus,
  campMetadata,
  campPath,
  campSource,
  clientIp,
  finishAccountUrl,
  hashIp,
  isUuid,
  resolveAppOrigin,
  validateCampSignup,
} from "../_shared/camp_signup.ts";
import { campDetailsEmail, campFinishAccountEmail, campTimes } from "../_shared/camp_emails.ts";
import { appOrigin, isCampSessionPaid, sendCampEmail, sendCampSignupEmails, settleCampSession } from "../_shared/camp_settle.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type RpcError = { message?: string; hint?: string | null; code?: string } | null;

const rpcFail = (error: RpcError, fallback: string) => {
  const hint = error?.hint ?? null;
  const status = campErrorStatus(hint);
  // Messages raised by the camp functions are written for families and coaches; anything
  // else (a database error) gets the fallback.
  const known = Boolean(hint) || (error?.code === "22023" || error?.code === "P0001" || error?.code === "P0002" || error?.code === "42501");
  return json({ error: known && error?.message ? campErrorMessage(hint, error.message) : fallback, code: hint ?? undefined }, known ? status : 500);
};

let stripeClient: Stripe | null = null;
const stripeApi = () => {
  if (stripeClient) return stripeClient;
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("Payments aren't set up yet. Please try again later.");
  stripeClient = new Stripe(key, { apiVersion: "2025-08-27.basil" });
  return stripeClient;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const admin = createClient(url, serviceKey);
  const origin = resolveAppOrigin(req.headers.get("origin"), appOrigin());

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "signup";

    // ---------------- Family: price and options for the review step ----------------
    if (action === "quote") {
      if (!isUuid(body.camp_id)) return json({ error: "This camp link is not right" }, 400);
      const source = campSource(body.src ?? body.source);
      const { data, error } = await admin.rpc("camp_quote", { p_camp_id: body.camp_id, p_source: source });
      if (error) return rpcFail(error, "Could not load the price. Try again.");
      if (!data) return json({ error: "This camp is not taking sign-ups" }, 404);
      const fees = await loadFeeConfig(admin);
      const athletes = Math.min(6, Math.max(1, Number(body.athletes) || 1));
      return json({
        ...data,
        platform_waived: CAMP_PLATFORM_WAIVED,
        direct_allowed: campDirectAllowed(data.direct_allowed),
        source,
        athletes,
        card: campCheckoutFees(data.price_cents, athletes, fees),
      });
    }

    // ---------------- Family: sign up ----------------
    if (action === "signup") {
      const parsed = validateCampSignup(body);
      if (!parsed.ok) return json({ error: Object.values(parsed.errors)[0], fields: parsed.errors }, 400);
      const input = parsed.value;

      // Rates first: if they can't be read nothing is held.
      const fees = input.pay_method === "card" ? await loadFeeConfig(admin) : null;
      const ipHash = await hashIp(clientIp(req.headers), serviceKey.slice(-16) || "camp");

      const { data: start, error: startError } = await admin.rpc("camp_signup_start", {
        p: {
          ...input,
          ip_hash: ipHash,
          hold_minutes: 40,
          limits: {
            per_ip_hour: CAMP_RATE_LIMITS.perIpHour,
            per_email_hour: CAMP_RATE_LIMITS.perEmailHour,
            direct_per_email: CAMP_RATE_LIMITS.directPerEmail,
          },
        },
      });
      if (startError || !start) return rpcFail(startError, "Could not save your spot. Try again.");

      // A new attempt replaced an unpaid Checkout from this family: close it at Stripe.
      const superseded = Array.isArray(start.superseded_sessions) ? (start.superseded_sessions as string[]) : [];
      for (const id of superseded) {
        await stripeApi().checkout.sessions.expire(id).catch((e: unknown) => console.warn("Could not expire old camp Checkout", id, e));
      }

      const camp = start.camp as {
        id: string; name: string; price_cents: number; slug: string; coach_id: string; coach_name: string; coach_slug: string;
      };
      const page = `${origin}${campPath(camp.coach_slug ?? "", camp.slug ?? "")}`;

      if (input.pay_method === "direct") {
        // Best effort: the spot is held either way; the coach also sees it in registrations.
        await sendCampSignupEmails(admin, start.signup_id, "held", origin).catch((e) => console.error("Camp held emails failed", e));
        return json({ signup_id: start.signup_id, status: "held", hold_expires_at: start.hold_expires_at, athletes: start.athletes });
      }

      const athletes = (start.athletes ?? []) as Array<{
        id: string; first_name: string; last_name: string; group_name: string | null; start_time: string | null; end_time: string | null;
      }>;
      // No platform fee on camps: the camp price plus card processing.
      const breakdown = campCheckoutFees(camp.price_cents, athletes.length, fees!);
      const expiry = checkoutExpiry(Date.now());
      const metadata = {
        ...campMetadata({
          signupId: start.signup_id,
          campId: camp.id,
          coachId: camp.coach_id,
          registrationIds: athletes.map((a) => a.id),
          source: input.source,
          platformWaived: CAMP_PLATFORM_WAIVED,
          listCents: camp.price_cents,
          athletes: athletes.length,
        }),
        ...feeConfigMetadata(fees!),
        platform_fee_perc: "0",
      };

      let session: Stripe.Checkout.Session;
      try {
        session = await stripeApi().checkout.sessions.create(
          {
            ...USD_ONLY_CHECKOUT,
            mode: "payment",
            payment_method_types: ["card"],
            customer_email: input.parent.email,
            expires_at: expiry.unix,
            line_items: athletes.map((a, i) => ({
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: breakdown.lines[i].totalCents,
                product_data: {
                  name: `${camp.name}: ${a.first_name} ${a.last_name}`.slice(0, 250),
                  description: [
                    `With ${camp.coach_name}`,
                    a.group_name ? `${a.group_name}${a.start_time && a.end_time ? `, ${campTimes(a.start_time, a.end_time)}` : ""}` : "",
                    "Includes card processing",
                  ].filter(Boolean).join(" · ").slice(0, 500),
                },
              },
            })),
            success_url: `${page}?signup=${start.signup_id}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${page}?signup=${start.signup_id}&canceled=1${input.source === "link" ? "&src=link" : ""}`,
            metadata,
            payment_intent_data: { metadata, description: `${camp.name} (${athletes.length} athlete${athletes.length === 1 ? "" : "s"})` },
          },
          { idempotencyKey: await idempotencyKey("camp", [start.signup_id], "checkout") },
        );
      } catch (e) {
        console.error("Camp Checkout failed", start.signup_id, e);
        await admin.rpc("camp_signup_release", { p_signup_id: start.signup_id });
        return json({ error: "Card payment could not start. Nothing was charged. Try again." }, 502);
      }

      const { data: attached, error: attachError } = await admin.rpc("camp_signup_attach_session", {
        p_signup_id: start.signup_id,
        p_session_id: session.id,
        p_expires_at: expiry.iso,
      });
      if (attachError || !attached) {
        console.error("Attaching camp Checkout failed", start.signup_id, attachError);
        await stripeApi().checkout.sessions.expire(session.id).catch(() => undefined);
        await admin.rpc("camp_signup_release", { p_signup_id: start.signup_id });
        return json({ error: "Your spot could not be held. Nothing was charged. Try again." }, 409);
      }

      return json({
        signup_id: start.signup_id,
        status: "pending_payment",
        url: session.url,
        session_id: session.id,
        expires_at: expiry.iso,
        platform_waived: CAMP_PLATFORM_WAIVED,
        fees: breakdown,
      });
    }

    // ---------------- Family: "You're in" page ----------------
    if (action === "status") {
      if (!isUuid(body.signup_id)) return json({ error: "Not found" }, 404);
      const read = () => admin.rpc("camp_signup_status", { p_signup_id: body.signup_id });
      let { data, error } = await read();
      if (error) return rpcFail(error, "Could not load your sign-up.");
      if (!data) return json({ error: "Not found" }, 404);
      // Back from Stripe before the webhook: settle it the same way the webhook does.
      if (data.any_pending && typeof data.stripe_session_id === "string" && data.stripe_session_id) {
        try {
          const session = await stripeApi().checkout.sessions.retrieve(data.stripe_session_id, { expand: ["payment_intent"] });
          if (isCampSessionPaid(session as never)) {
            await settleCampSession(admin, session as never, origin);
            ({ data, error } = await read());
            if (error) return rpcFail(error, "Could not load your sign-up.");
          }
        } catch (e) {
          console.error("Camp status check with Stripe failed", body.signup_id, e);
        }
      }
      const { stripe_session_id: _hidden, ...rest } = data as Record<string, unknown>;
      return json(rest);
    }

    // ---------------- Coach actions ----------------
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: userRes } = await caller.auth.getUser();
    if (!userRes?.user) return json({ error: "Sign in first" }, 401);

    if (action === "coach_add") {
      const { data: added, error } = await caller.rpc("add_camp_athlete", {
        p_camp_id: body.camp_id,
        p_group_id: body.group_id,
        p_athlete_id: isUuid(body.athlete_id) ? body.athlete_id : null,
        p_first_name: typeof body.first_name === "string" ? body.first_name : null,
        p_last_name: typeof body.last_name === "string" ? body.last_name : null,
        p_birth_year: Number.isInteger(body.birth_year) ? body.birth_year : null,
        p_parent_email: typeof body.parent_email === "string" ? body.parent_email : null,
        p_parent_name: typeof body.parent_name === "string" ? body.parent_name : null,
        p_paid: body.paid === true,
      });
      if (error || !added) return rpcFail(error, "Could not add this athlete.");

      let invited = false;
      if (added.invite_needed && body.send_invite !== false) {
        // The family is already the coach's client (add_camp_athlete confirmed the referral), so
        // the usual invite email goes out for that row, as the coach. Before that migration:
        // a new invite, as before.
        const r = await fetch(`${url}/functions/v1/add-client-referral`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: req.headers.get("Authorization") ?? "", origin },
          body: JSON.stringify(
            isUuid(added.referral_id)
              ? { action: "resend", referral_id: added.referral_id }
              : { clients: [{ email: added.parent_email, name: added.parent_name ?? undefined, athlete_first_name: added.athlete_first_name }] },
          ),
        }).catch(() => null);
        invited = Boolean(r?.ok);
        if (!invited) console.error("Camp family invite failed", added.id, r?.status);
      }

      let emailed = false;
      if (added.parent_email && body.send_details !== false) {
        emailed = await sendDetails(caller, admin, added.id, origin);
      }
      return json({ ...added, invited, emailed });
    }

    if (action === "resend_finish" || action === "send_details") {
      if (!isUuid(body.registration_id)) return json({ error: "Registration not found" }, 404);
      if (action === "send_details") return json({ emailed: await sendDetails(caller, admin, body.registration_id, origin) });
      const { data: contact, error } = await caller.rpc("camp_registration_contact", { p_id: body.registration_id, p_kind: "finish" });
      if (error || !contact) return rpcFail(error, "Could not send the link.");
      if (contact.has_account) return json({ emailed: false, reason: "joined" });
      const { subject, html } = campFinishAccountEmail({
        camp: contact.camp,
        athleteFirstName: contact.athlete_first_name,
        finishUrl: finishAccountUrl(origin, contact.parent_email, contact.signup_id),
      });
      return json({ emailed: await sendCampEmail(admin, contact.parent_email, subject, html) });
    }

    if (action === "resend_invite") {
      if (!isUuid(body.referral_id)) return json({ error: "Invite not found" }, 404);
      const r = await fetch(`${url}/functions/v1/add-client-referral`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: req.headers.get("Authorization") ?? "", origin },
        body: JSON.stringify({ action: "resend", referral_id: body.referral_id }),
      });
      return new Response(await r.text(), { status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("camp-signup failed", e);
    return json({ error: e instanceof Error && /Payments aren't set up/.test(e.message) ? e.message : "Something went wrong. Try again." }, 500);
  }
});

// deno-lint-ignore no-explicit-any
const sendDetails = async (caller: any, admin: any, registrationId: string, origin: string) => {
  const { data: contact, error } = await caller.rpc("camp_registration_contact", { p_id: registrationId, p_kind: "details" });
  if (error || !contact) {
    console.error("Camp details email skipped", registrationId, error?.message);
    return false;
  }
  const { subject, html } = campDetailsEmail({
    camp: contact.camp,
    parentName: contact.parent_name,
    athlete: {
      first_name: contact.athlete_first_name,
      group_name: contact.group_name,
      start_time: contact.start_time,
      end_time: contact.end_time,
    },
    status: contact.status,
    finishUrl: contact.has_account ? null : finishAccountUrl(origin, contact.parent_email, contact.signup_id),
  });
  return await sendCampEmail(admin, contact.parent_email, subject, html);
};
