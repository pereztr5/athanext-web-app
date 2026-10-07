// Coach invoices (ATH-89). Only for families a coach brought to AthaNext; the database checks that.
// Coach:   { action: "create", athlete_id, service, amount, due, note } -> { id, emailed }
//          { action: "remind", invoice_id }                              -> { reminders, emailed }
// Family:  { action: "checkout", invoice_id, origin }                    -> { url }  Stripe Checkout
//          { action: "verify", invoice_id }                              -> { status }
// Service: { action: "settle", invoice_id }  (checkout webhook)          -> { status }
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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
  if (!key) throw new Error("Card payments aren't set up yet");
  return (stripeClient ??= new Stripe(key, { apiVersion: "2025-08-27.basil" }));
};

const escapeHtml = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const usd = (n: number) => `$${Number(n).toFixed(2).replace(/\.00$/, "")}`;

const sendEmail = async (admin: SupabaseClient, to: string, subject: string, html: string) => {
  const { data: cfg } = await admin.from("configurations").select("value").eq("key", "smtp_email").maybeSingle();
  if (!cfg?.value || !to) return false;
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
    body: JSON.stringify({ to, from: cfg.value, subject, html }),
  }).catch(() => null);
  return Boolean(res?.ok);
};

/** Emails the account holder of the invoice's athlete. */
const emailInvoice = async (admin: SupabaseClient, invoiceId: string, site: string, reminder: boolean) => {
  const { data: inv } = await admin
    .from("coach_invoices")
    .select("id, service, amount, due_date, note, family_name, athlete_id, coach:coaches(name)")
    .eq("id", invoiceId)
    .single();
  if (!inv?.athlete_id) return false;
  const { data: athlete } = await admin.from("athlete_profiles").select("user_id").eq("id", inv.athlete_id).maybeSingle();
  if (!athlete?.user_id) return false;
  const { data: userRes } = await admin.auth.admin.getUserById(athlete.user_id as string);
  const to = userRes?.user?.email;
  if (!to) return false;
  // deno-lint-ignore no-explicit-any
  const coach = ((inv as any).coach?.name as string) ?? "Your coach";
  const due = new Date(`${inv.due_date}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const link = `${site}/invoices/${inv.id}`;
  const subject = reminder ? `Reminder: ${coach}'s invoice for ${usd(inv.amount)}` : `${coach} sent you an invoice for ${usd(inv.amount)}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
      <h2 style="color:#0054B4;">${escapeHtml(subject)}</h2>
      <p>${inv.family_name ? `Hi ${escapeHtml(inv.family_name)},` : "Hi,"}</p>
      <p>${escapeHtml(inv.service)}: <strong>${usd(inv.amount)}</strong>, due ${escapeHtml(due)}.</p>
      ${inv.note ? `<p>${escapeHtml(inv.note)}</p>` : ""}
      <p><a href="${link}" style="background:#0054B4;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;">Pay by card</a></p>
      <p style="color:#767980;font-size:13px;">Paid ${escapeHtml(coach)} another way? Let them know and they'll mark it as paid.</p>
    </div>`;
  return await sendEmail(admin, to, subject, html);
};

const callTransfers = async (invoiceId: string) => {
  await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/stripe-payouts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
    body: JSON.stringify({ action: "transfer_invoices", invoice_ids: [invoiceId] }),
  }).catch((e) => console.error("transfer call failed", e));
};

/** Marks the invoice paid if its Checkout session is paid, then pays the coach. */
const settle = async (admin: SupabaseClient, invoiceId: string) => {
  const { data: inv } = await admin.from("coach_invoices").select("id, status, stripe_session_id").eq("id", invoiceId).maybeSingle();
  if (!inv) return "missing";
  if (inv.status !== "open" || !inv.stripe_session_id) return inv.status as string;
  const session = await stripe().checkout.sessions.retrieve(inv.stripe_session_id as string);
  if (session.payment_status !== "paid" || session.metadata?.invoice_id !== invoiceId) return "open";
  const intent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  const { data: updated } = await admin
    .from("coach_invoices")
    .update({ status: "paid", paid_at: new Date().toISOString(), paid_method: "card", stripe_payment_intent: intent })
    .eq("id", invoiceId)
    .eq("status", "open")
    .select("id");
  if (updated?.length) await callTransfers(invoiceId);
  return "paid";
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "");
    const invoiceId = typeof body.invoice_id === "string" ? body.invoice_id : "";

    if (body.action === "settle") {
      if (bearer !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return json({ error: "Unauthorized" }, 401);
      return json({ status: await settle(admin, invoiceId) });
    }

    const userClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const site = resolveSiteUrl(body.origin ?? req.headers.get("origin"));

    if (body.action === "create") {
      const { data: id, error } = await userClient.rpc("create_coach_invoice", {
        p_athlete_id: body.athlete_id,
        p_service: body.service,
        p_amount: body.amount,
        p_due: body.due,
        p_note: body.note ?? null,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ id, emailed: await emailInvoice(admin, id as string, site, false) });
    }

    if (body.action === "remind") {
      const { data: count, error } = await userClient.rpc("remind_coach_invoice", { p_invoice_id: invoiceId });
      if (error) return json({ error: error.message }, 400);
      return json({ reminders: count, emailed: await emailInvoice(admin, invoiceId, site, true) });
    }

    if (body.action === "checkout" || body.action === "verify") {
      // get_family_invoice only returns invoices for the caller's own athletes.
      const { data: inv, error } = await userClient.rpc("get_family_invoice", { p_invoice_id: invoiceId });
      if (error || !inv) return json({ error: "Invoice not found" }, 404);
      if (body.action === "verify") return json({ status: await settle(admin, invoiceId) });
      if (inv.status !== "open") return json({ error: "This invoice is already settled" }, 400);

      const { data: fees } = await admin.from("configurations").select("value").eq("key", "stripe_fees").maybeSingle();
      const stripeFee = Number.parseFloat(fees?.value ?? "0") || 0;
      const amount = Number(inv.amount);
      const fee = Math.round(amount * stripeFee) / 100;
      const session = await stripe().checkout.sessions.create({
        mode: "payment",
        customer_email: user.email ?? undefined,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: Math.round((amount + fee) * 100),
              product_data: { name: `${inv.service} with ${inv.coach}`, description: fee ? `Includes ${usd(fee)} card processing` : undefined },
            },
          },
        ],
        metadata: { invoice_id: invoiceId, kind: "invoice" },
        payment_intent_data: { metadata: { invoice_id: invoiceId, kind: "invoice" } },
        success_url: `${site}/invoices/${invoiceId}?paid=1`,
        cancel_url: `${site}/invoices/${invoiceId}`,
      });
      await admin.from("coach_invoices").update({ stripe_session_id: session.id }).eq("id", invoiceId).eq("status", "open");
      return json({ url: session.url });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Something went wrong" }, 500);
  }
});
