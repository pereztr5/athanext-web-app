// Finishes a package purchase after Stripe's page (ATH-94): the package's sessions become
// credits with that coach, and the coach is paid the whole package right away.
// Family:  { session_id } -> { state: "reconciled" | "pending" }
// Service: same body from the checkout webhook.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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
      const { data: { user } } = await admin.auth.getUser(bearer);
      if (!user) return json({ error: "Unauthorized" }, 401);
      userId = user.id;
    }

    const { session_id: sessionId } = (await req.json().catch(() => ({}))) as { session_id?: string };
    if (!sessionId) return json({ error: "session_id required" }, 400);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const meta = session.metadata ?? {};
    if (meta.type !== "package_purchase" || (!isService && meta.user_id !== userId)) return json({ error: "Not found" }, 404);
    if (session.payment_status !== "paid") return json({ state: "pending" });

    const intentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
    const { data: existing } = await admin.from("package_purchases").select("id").eq("stripe_session_id", sessionId).maybeSingle();
    let purchaseId = existing?.id as string | undefined;
    if (!purchaseId) {
      const sessions = Number(meta.sessions_total) || 1;
      const { data: row, error } = await admin
        .from("package_purchases")
        .insert({
          coach_id: meta.coach_id,
          user_id: meta.user_id,
          package_id: meta.package_id,
          source: "package",
          sessions_total: sessions,
          sessions_remaining: sessions,
          status: "active",
          purchase_date: new Date().toISOString(),
          expiry_date: meta.expiry_date,
          total_amount: (session.amount_total ?? 0) / 100,
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
        return json({ state: "reconciled", purchase_id: again.id });
      }
      purchaseId = row.id as string;
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/stripe-payouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ action: "transfer_packages", purchase_ids: [purchaseId] }),
      }).catch((e) => console.error("Package transfer call failed", e));
    }
    return json({ state: "reconciled", purchase_id: purchaseId });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Something went wrong" }, 500);
  }
});
