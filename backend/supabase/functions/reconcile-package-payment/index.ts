// Finishes a package purchase after Stripe's page (ATH-94): the package's sessions become
// credits with that coach, and the coach is paid the list price (marketplace + processing stay with AthaNext).
// Academy packages become credits with the listed coaches and pay out per session used, so
// nothing is sent here. A group pass renews monthly: each paid renewal adds a month of credits.
// A $0 trial checkout creates a trialing row with zero credits until the first paid invoice.
// Family:  { session_id } -> { state: "reconciled" | "pending" | "trialing" }
// Service: same body from the checkout webhook, or { invoice_id } for a subscription renewal.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const listPriceFromMeta = (meta: Record<string, string>, fallbackCents: number | null) => {
  const fromMeta = Number.parseFloat(meta.list_price ?? "");
  if (Number.isFinite(fromMeta) && fromMeta >= 0) return fromMeta;
  return (fallbackCents ?? 0) / 100;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const key = Deno.env.get("STRIPE_SECRET_KEY");
    if (!key) return json({ error: "Payments aren't set up yet" }, 500);
    const stripe = new Stripe(key, { apiVersion: "2025-08-27.basil" });
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);
    const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const isService = bearer === serviceKey;
    let userId: string | null = null;
    if (!isService) {
      const {
        data: { user },
      } = await admin.auth.getUser(bearer);
      if (!user) return json({ error: "Unauthorized" }, 401);
      userId = user.id;
    }

    const { session_id: sessionId, invoice_id: invoiceId } = (await req.json().catch(() => ({}))) as {
      session_id?: string;
      invoice_id?: string;
    };

    // A group pass renewal (service role only): a new month of credits. List price from sub metadata.
    if (invoiceId) {
      if (!isService) return json({ error: "Unauthorized" }, 401);
      const invoice = await stripe.invoices.retrieve(invoiceId);
      const subId =
        typeof (invoice as any).subscription === "string"
          ? (invoice as any).subscription
          : (invoice as any).parent?.subscription_details?.subscription;
      if (!subId || invoice.status !== "paid") return json({ state: "pending" });
      // $0 trial invoices (subscription_create) do not grant credits.
      if ((invoice.amount_paid ?? 0) <= 0) return json({ state: "trialing" });
      const sub = await stripe.subscriptions.retrieve(subId);
      const meta = (sub.metadata ?? {}) as Record<string, string>;
      if (meta.type !== "package_purchase" || !meta.org_package_id) return json({ error: "Not found" }, 404);
      const periodStart = new Date(((invoice as any).period_start ?? invoice.created) * 1000);
      const expiry = new Date(periodStart);
      expiry.setDate(expiry.getDate() + (Number(meta.validity_days) || 31));
      const sessions = Number(meta.sessions_total) || 1;
      const listPrice = listPriceFromMeta(meta, invoice.amount_paid);
      const { error } = await admin.from("package_purchases").insert({
        org_package_id: meta.org_package_id,
        organization_id: meta.organization_id,
        user_id: meta.user_id,
        source: "package",
        sessions_total: sessions,
        sessions_remaining: sessions,
        status: "active",
        purchase_date: periodStart.toISOString(),
        expiry_date: expiry.toISOString(),
        total_amount: listPrice,
        stripe_subscription_id: subId,
      });
      // The unique (subscription, period) index makes a repeat call a no-op.
      if (error && !/duplicate/i.test(error.message)) throw error;

      // Promote any trialing placeholder for this subscription to expired (credits live on the new row).
      await admin
        .from("package_purchases")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("stripe_subscription_id", subId)
        .eq("status", "trialing");

      return json({ state: "reconciled" });
    }

    if (!sessionId) return json({ error: "session_id required" }, 400);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const meta = (session.metadata ?? {}) as Record<string, string>;
    if (meta.type !== "package_purchase" || (!isService && meta.user_id !== userId)) return json({ error: "Not found" }, 404);

    const isTrialCheckout = (session.amount_total ?? 0) === 0 && Boolean(session.subscription);
    if (!isTrialCheckout && session.payment_status !== "paid") return json({ state: "pending" });

    const intentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
    const { data: existing } = await admin.from("package_purchases").select("id, status").eq("stripe_session_id", sessionId).maybeSingle();
    let purchaseId = existing?.id as string | undefined;
    if (!purchaseId) {
      const sessions = Number(meta.sessions_total) || 1;
      const academy = Boolean(meta.org_package_id);
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
      const listPrice = listPriceFromMeta(meta, isTrialCheckout ? 0 : session.amount_total);
      const { data: row, error } = await admin
        .from("package_purchases")
        .insert({
          coach_id: academy ? null : meta.coach_id,
          org_package_id: academy ? meta.org_package_id : null,
          organization_id: academy ? meta.organization_id : null,
          stripe_subscription_id: subscriptionId,
          user_id: meta.user_id,
          package_id: academy ? null : meta.package_id,
          source: "package",
          sessions_total: isTrialCheckout ? sessions : sessions,
          sessions_remaining: isTrialCheckout ? 0 : sessions,
          status: isTrialCheckout ? "trialing" : "active",
          purchase_date: new Date().toISOString(),
          expiry_date: meta.expiry_date,
          // Payouts use list price; marketplace + processing stay with AthaNext.
          total_amount: listPrice,
          stripe_session_id: sessionId,
          stripe_payment_intent: intentId,
          payment_intent_id: intentId,
        })
        .select("id")
        .single();
      if (error) {
        // Another call (webhook or the return page) finished it first.
        const { data: again } = await admin.from("package_purchases").select("id").eq("stripe_session_id", sessionId).maybeSingle();
        if (!again) throw error;
        return json({ state: isTrialCheckout ? "trialing" : "reconciled", purchase_id: again.id });
      }
      purchaseId = row.id as string;
      if (isTrialCheckout) return json({ state: "trialing", purchase_id: purchaseId });
      // Academy packages pay out per session used (plan_academy_credit_transfers), not now.
      if (academy) return json({ state: "reconciled", purchase_id: purchaseId });
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/stripe-payouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ action: "transfer_packages", purchase_ids: [purchaseId] }),
      }).catch((e) => console.error("Package transfer call failed", e));
    }
    return json({ state: existing?.status === "trialing" || isTrialCheckout ? "trialing" : "reconciled", purchase_id: purchaseId });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Something went wrong" }, 500);
  }
});
