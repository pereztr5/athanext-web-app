// Coach payouts with Stripe Connect Express.
// Booking shares are planned as held until the session sticks; invoices/packages still send on pay.
// Coach (signed in):
//   { action: "onboard", origin }   -> { url }     create the Express account if needed, open Stripe's setup
//   { action: "status" }            -> { account } refresh setup status, then send any waiting transfers
//   { action: "dashboard" }         -> { url }     Stripe Express dashboard login link
//   { action: "payout_day", day }   -> { account } weekly payout day
//   { action: "payouts" }           -> { balance, payouts } for the Payments page (sends waiting shares first)
// Service role (from checkout) or family/coach on cancel:
//   { action: "transfer_bookings", booking_ids } -> { sent, waiting, failed, held }
//   { action: "transfer_invoices", invoice_ids } -> { sent, waiting, failed }
//   { action: "transfer_packages", purchase_ids } -> { sent, waiting, failed }
//   { action: "reverse_bookings", booking_ids? } -> { reversed, failed }
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
type Day = (typeof DAYS)[number];

// Links back to the app only for local dev and athanext hosts (same rule as invite emails).
const DEFAULT_SITE_URL = Deno.env.get("SITE_URL") ?? "https://athanext.com";
const resolveSiteUrl = (origin: unknown): string => {
  if (typeof origin !== "string") return DEFAULT_SITE_URL;
  try {
    const url = new URL(origin);
    const host = url.hostname;
    if (host === "localhost" || host === "127.0.0.1") return url.origin;
    if (host === "athanext.com" || host.endsWith(".athanext.com") || host.endsWith("athanext-staging.vercel.app")) return url.origin;
  } catch {
    // fall through
  }
  return DEFAULT_SITE_URL;
};

let stripeClient: Stripe | null = null;
const stripe = () => {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("Payments aren't set up yet");
  return (stripeClient ??= new Stripe(key, { apiVersion: "2025-08-27.basil" }));
};

const accountRow = (account: Stripe.Account) => {
  const bank = account.external_accounts?.data?.[0] as { last4?: string } | undefined;
  return {
    details_submitted: Boolean(account.details_submitted),
    charges_enabled: Boolean(account.charges_enabled),
    payouts_enabled: Boolean(account.payouts_enabled),
    transfers_active: account.capabilities?.transfers === "active",
    bank_last4: bank?.last4 ?? null,
    updated_at: new Date().toISOString(),
  };
};

const publicAccount = (row: Record<string, unknown> | null) =>
  row
    ? {
        connected: true,
        details_submitted: row.details_submitted,
        payouts_enabled: row.payouts_enabled,
        transfers_active: row.transfers_active,
        payout_day: row.payout_day,
        bank_last4: row.bank_last4,
      }
    : { connected: false };

const chargeIdForInvoice = async (admin: SupabaseClient, invoiceId: string): Promise<string | null> => {
  const { data: inv } = await admin.from("coach_invoices").select("stripe_payment_intent").eq("id", invoiceId).maybeSingle();
  if (!inv?.stripe_payment_intent) return null;
  const intent = await stripe().paymentIntents.retrieve(inv.stripe_payment_intent as string);
  return typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id ?? null;
};

const chargeIdForPackage = async (admin: SupabaseClient, purchaseId: string): Promise<string | null> => {
  const { data: p } = await admin.from("package_purchases").select("stripe_charge_id, stripe_payment_intent").eq("id", purchaseId).maybeSingle();
  if (p?.stripe_charge_id) return p.stripe_charge_id as string;
  if (!p?.stripe_payment_intent) return null;
  const intent = await stripe().paymentIntents.retrieve(p.stripe_payment_intent as string);
  return typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id ?? null;
};

const chargeIdFor = async (admin: SupabaseClient, bookingId: string): Promise<string | null> => {
  const { data: pay } = await admin
    .from("payments")
    .select("stripe_charge_id, stripe_payment_intent")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (pay?.stripe_charge_id) return pay.stripe_charge_id;
  let intentId = pay?.stripe_payment_intent as string | null;
  if (!intentId) {
    const { data: booking } = await admin.from("coach_slot_bookings").select("stripe_payment_intent, credit_purchase_id").eq("id", bookingId).maybeSingle();
    // A session paid with an academy credit is funded by the package payment.
    if (booking?.credit_purchase_id) return await chargeIdForPackage(admin, booking.credit_purchase_id as string);
    intentId = (booking?.stripe_payment_intent as string | null) ?? null;
  }
  if (!intentId) return null;
  const intent = await stripe().paymentIntents.retrieve(intentId);
  const charge = typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id ?? null;
  if (charge) await admin.from("payments").update({ stripe_charge_id: charge }).eq("booking_id", bookingId);
  return charge;
};

/** Sends every waiting transfer in `rows` whose recipient can receive transfers. */
const sendTransfers = async (admin: SupabaseClient, rows: Record<string, any>[]) => {
  const result = { sent: 0, waiting: 0, failed: 0 };
  for (const row of rows) {
    // held = session not done yet; void / reversing = cancel or Stripe clawback.
    if (row.status === "sent" || row.status === "held" || row.status === "void" || row.status === "reversing") continue;
    const { data: account } = await admin
      .from("coach_payout_accounts")
      .select("stripe_account_id, transfers_active")
      .eq("coach_id", row.coach_id)
      .maybeSingle();
    if (!account?.transfers_active || Number(row.amount) <= 0) {
      result.waiting++;
      continue;
    }
    try {
      const charge =
        row.stripe_charge_id ??
        (row.invoice_id
          ? await chargeIdForInvoice(admin, row.invoice_id)
          : row.package_purchase_id
            ? await chargeIdForPackage(admin, row.package_purchase_id)
            : await chargeIdFor(admin, row.booking_id));
      const transfer = await stripe().transfers.create(
        {
          amount: Math.round(Number(row.amount) * 100),
          currency: row.currency ?? "usd",
          destination: account.stripe_account_id,
          ...(charge ? { source_transaction: charge } : {}),
          transfer_group: row.invoice_id ? `invoice_${row.invoice_id}` : row.package_purchase_id ? `package_${row.package_purchase_id}` : `booking_${row.booking_id}`,
          metadata: row.invoice_id
            ? { invoice_id: row.invoice_id, kind: row.kind }
            : row.package_purchase_id
              ? { package_purchase_id: row.package_purchase_id, kind: row.kind }
              : { booking_id: row.booking_id, kind: row.kind },
        },
        { idempotencyKey: `payout-transfer-${row.id}` },
      );
      await admin
        .from("payout_transfers")
        .update({ status: "sent", stripe_transfer_id: transfer.id, stripe_charge_id: charge, sent_at: new Date().toISOString(), error: null })
        .eq("id", row.id);
      result.sent++;
    } catch (e) {
      console.error("transfer failed", row.id, e);
      await admin.from("payout_transfers").update({ status: "failed", error: e instanceof Error ? e.message : String(e) }).eq("id", row.id);
      result.failed++;
    }
  }
  return result;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");

    // Reverse Connect transfers marked reversing (cancel after a share was already sent,
    // or a Stripe refund / dispute). Service role, or the family/coach on those bookings.
    if (body.action === "reverse_pending" || body.action === "reverse_bookings") {
      const isService = Boolean(bearer && bearer === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
      const bookingIds = Array.isArray(body.booking_ids) ? (body.booking_ids as string[]).slice(0, 50) : [];
      let rows: Record<string, any>[] = [];
      if (!isService) {
        const { data: { user }, error: authError } = await admin.auth.getUser(bearer);
        if (authError || !user) return json({ error: "Unauthorized" }, 401);
        if (!bookingIds.length) return json({ error: "booking_ids required" }, 400);
        const { data: profile } = await admin.from("user_profiles").select("coach_id, athlete_id").eq("id", user.id).maybeSingle();
        const { data: bookings } = await admin
          .from("coach_slot_bookings")
          .select("id, coach_id, athlete_id, created_by")
          .in("id", bookingIds);
        const allowed = new Set(
          ((bookings ?? []) as { id: string; coach_id: string; athlete_id: string; created_by: string | null }[])
            .filter(
              (b) =>
                b.coach_id === profile?.coach_id ||
                b.athlete_id === profile?.athlete_id ||
                b.created_by === user.id,
            )
            .map((b) => b.id),
        );
        if (!allowed.size) return json({ error: "Unauthorized" }, 403);
        const { data } = await admin
          .from("payout_transfers")
          .select("*")
          .in("booking_id", [...allowed])
          .eq("status", "reversing");
        rows = (data as Record<string, any>[]) ?? [];
      } else if (bookingIds.length) {
        const { data } = await admin.from("payout_transfers").select("*").in("booking_id", bookingIds).eq("status", "reversing");
        rows = (data as Record<string, any>[]) ?? [];
      } else {
        const { data } = await admin.rpc("list_reversing_transfers", { p_limit: 50 });
        rows = (data as Record<string, any>[]) ?? [];
      }
      const total = { reversed: 0, failed: 0 };
      for (const row of rows) {
        if (!row.stripe_transfer_id) continue;
        try {
          await stripe().transfers.createReversal(row.stripe_transfer_id, {}, { idempotencyKey: `payout-reverse-${row.id}` });
          await admin.from("payout_transfers").update({ status: "void", error: null }).eq("id", row.id);
          total.reversed++;
        } catch (e) {
          console.error("reverse failed", row.id, e);
          await admin
            .from("payout_transfers")
            .update({ status: "failed", error: e instanceof Error ? e.message : String(e) })
            .eq("id", row.id);
          total.failed++;
        }
      }
      return json(total);
    }

    if (body.action === "transfer_bookings" || body.action === "transfer_invoices" || body.action === "transfer_packages") {
      if (!bearer || bearer !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return json({ error: "Unauthorized" }, 401);
      const invoices = body.action === "transfer_invoices";
      const packages = body.action === "transfer_packages";
      const list = invoices ? body.invoice_ids : packages ? body.purchase_ids : body.booking_ids;
      const ids = Array.isArray(list) ? (list as string[]).slice(0, 50) : [];
      const total = { sent: 0, waiting: 0, failed: 0, held: 0 };
      for (const id of ids) {
        const { data: rows, error } = invoices
          ? await admin.rpc("plan_invoice_transfers", { p_invoice_id: id })
          : packages
            ? await admin.rpc("plan_package_transfers", { p_purchase_id: id })
            : await admin.rpc("plan_booking_transfers", { p_booking_id: id });
        if (error) {
          console.error("plan failed", id, error);
          total.failed++;
          continue;
        }
        const planned = (rows as Record<string, any>[]) ?? [];
        total.held += planned.filter((row) => row.status === "held").length;
        // Booking shares stay held until the session sticks; invoices/packages still send now.
        const toSend = invoices || packages ? planned : planned.filter((row) => row.status === "waiting" || row.status === "failed");
        const r = await sendTransfers(admin, toSend);
        total.sent += r.sent;
        total.waiting += r.waiting;
        total.failed += r.failed;
      }
      return json(total);
    }

    const { data: { user }, error: authError } = await admin.auth.getUser(bearer);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);
    const { data: profile } = await admin.from("user_profiles").select("coach_id").eq("id", user.id).maybeSingle();
    const coachId = profile?.coach_id as string | undefined;
    if (!coachId) return json({ error: "Only coaches can set up payouts" }, 403);

    const { data: existing } = await admin.from("coach_payout_accounts").select("*").eq("coach_id", coachId).maybeSingle();

    if (body.action === "onboard") {
      let accountId = existing?.stripe_account_id as string | undefined;
      if (!accountId) {
        const { data: coach } = await admin.from("coaches").select("name, email").eq("id", coachId).single();
        const account = await stripe().accounts.create(
          {
            type: "express",
            country: "US",
            email: (coach?.email as string | undefined) ?? user.email ?? undefined,
            capabilities: { transfers: { requested: true } },
            business_profile: { product_description: "Sports coaching sessions booked through AthaNext" },
            settings: { payouts: { schedule: { interval: "weekly", weekly_anchor: "monday" } } },
            metadata: { coach_id: coachId },
          },
          { idempotencyKey: `connect-account-${coachId}` },
        );
        accountId = account.id;
        const { error } = await admin.from("coach_payout_accounts").insert({ coach_id: coachId, stripe_account_id: accountId, ...accountRow(account) });
        if (error) throw error;
      }
      const site = resolveSiteUrl(body.origin);
      const link = await stripe().accountLinks.create({
        account: accountId,
        type: "account_onboarding",
        refresh_url: `${site}/settings?tab=booking&payouts=refresh`,
        return_url: `${site}/settings?tab=booking&payouts=done`,
      });
      return json({ url: link.url });
    }

    if (!existing) {
      if (body.action === "status" || body.action === "payouts") return json({ account: publicAccount(null), balance: null, payouts: [] });
      return json({ error: "Set up payouts first" }, 400);
    }
    const accountId = existing.stripe_account_id as string;

    if (body.action === "status") {
      const account = await stripe().accounts.retrieve(accountId);
      const { data: row } = await admin
        .from("coach_payout_accounts")
        .update(accountRow(account))
        .eq("coach_id", coachId)
        .select("*")
        .single();
      if (row?.transfers_active) {
        const { data: waiting } = await admin.from("payout_transfers").select("*").eq("coach_id", coachId).in("status", ["waiting", "failed"]).limit(50);
        await sendTransfers(admin, waiting ?? []);
        // Finish any Stripe reversals (cancel / refund after a share was already sent).
        const { data: reversing } = await admin.from("payout_transfers").select("*").eq("coach_id", coachId).eq("status", "reversing").limit(50);
        for (const rowRev of reversing ?? []) {
          if (!rowRev.stripe_transfer_id) continue;
          try {
            await stripe().transfers.createReversal(rowRev.stripe_transfer_id as string, {}, { idempotencyKey: `payout-reverse-${rowRev.id}` });
            await admin.from("payout_transfers").update({ status: "void", error: null }).eq("id", rowRev.id);
          } catch (e) {
            await admin
              .from("payout_transfers")
              .update({ status: "failed", error: e instanceof Error ? e.message : String(e) })
              .eq("id", rowRev.id);
          }
        }
      }
      return json({ account: publicAccount(row) });
    }

    if (body.action === "dashboard") {
      const link = await stripe().accounts.createLoginLink(accountId);
      return json({ url: link.url });
    }

    if (body.action === "payout_day") {
      const day = String(body.day ?? "") as Day;
      if (!DAYS.includes(day)) return json({ error: "Pick a weekday" }, 400);
      await stripe().accounts.update(accountId, { settings: { payouts: { schedule: { interval: "weekly", weekly_anchor: day } } } });
      const { data: row } = await admin.from("coach_payout_accounts").update({ payout_day: day, updated_at: new Date().toISOString() }).eq("coach_id", coachId).select("*").single();
      return json({ account: publicAccount(row) });
    }

    if (body.action === "payouts") {
      // Shares planned later (academy credits, unused credits) go out when the coach looks.
      if (existing.transfers_active) {
        const { data: waiting } = await admin.from("payout_transfers").select("*").eq("coach_id", coachId).in("status", ["waiting", "failed"]).limit(50);
        await sendTransfers(admin, waiting ?? []);
      }
      const [balance, payouts] = await Promise.all([
        stripe().balance.retrieve({}, { stripeAccount: accountId }),
        stripe().payouts.list({ limit: 12 }, { stripeAccount: accountId }),
      ]);
      const cents = (list: { amount: number }[]) => list.reduce((sum, b) => sum + b.amount, 0) / 100;
      return json({
        account: publicAccount(existing),
        balance: { available: cents(balance.available), pending: cents(balance.pending) },
        payouts: payouts.data.map((p) => ({ id: p.id, amount: p.amount / 100, arrival: new Date(p.arrival_date * 1000).toISOString(), status: p.status })),
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Something went wrong";
    return json({ error: message }, 500);
  }
});
