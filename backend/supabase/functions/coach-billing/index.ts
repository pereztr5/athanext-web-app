// ATH-102: coach SaaS plan — $29/month after a 30-day trial from coaches.created_at.
// Coach (signed in):
//   { action: "status" }              -> billing status + access
//   { action: "checkout", origin }    -> { url } Stripe Checkout (subscription)
//   { action: "portal", origin }      -> { url } Stripe Customer Portal
// Stripe webhook (signature):
//   checkout.session.completed / customer.subscription.* / invoice.paid|invoice.payment_failed
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { minuteBucket, USD_ONLY_CHECKOUT } from "../_shared/checkout.ts";
import { subscriptionIdFromInvoice } from "./subscription.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
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
    if (host === "athanext.com" || host.endsWith(".athanext.com") || host.endsWith("athanext-staging.vercel.app")) {
      return url.origin;
    }
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

const adminClient = () =>
  createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

const PAID = new Set(["active", "trialing"]);

type CoachRow = {
  id: string;
  email: string | null;
  name: string;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
};

const hasAccess = (coach: CoachRow) => {
  if (coach.subscription_status && PAID.has(coach.subscription_status)) return true;
  if (coach.trial_ends_at && new Date(coach.trial_ends_at).getTime() > Date.now()) return true;
  return false;
};

const daysLeft = (trialEndsAt: string | null) => {
  if (!trialEndsAt) return 0;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
};

const publicStatus = (coach: CoachRow) => {
  const access = hasAccess(coach);
  const subscribed = Boolean(coach.subscription_status && PAID.has(coach.subscription_status));
  const trialActive = Boolean(coach.trial_ends_at && new Date(coach.trial_ends_at).getTime() > Date.now());
  return {
    access,
    locked: !access,
    subscribed,
    trial_active: trialActive && !subscribed,
    trial_ends_at: coach.trial_ends_at,
    days_left: daysLeft(coach.trial_ends_at),
    subscription_status: coach.subscription_status,
    price_monthly: 29,
  };
};

const coachForUser = async (admin: SupabaseClient, userId: string): Promise<CoachRow | null> => {
  const { data: profile } = await admin.from("user_profiles").select("coach_id").eq("id", userId).maybeSingle();
  if (!profile?.coach_id) return null;
  const { data: coach } = await admin
    .from("coaches")
    .select("id, email, name, trial_ends_at, stripe_customer_id, stripe_subscription_id, subscription_status")
    .eq("id", profile.coach_id)
    .maybeSingle();
  return (coach as CoachRow | null) ?? null;
};

/** Prefer STRIPE_COACH_PRICE_ID; otherwise find-or-create a $29/mo price. */
const coachPriceId = async (): Promise<string> => {
  const fromEnv = Deno.env.get("STRIPE_COACH_PRICE_ID");
  if (fromEnv) return fromEnv;

  const s = stripe();
  const products = await s.products.search({ query: "name:'AthaNext Coach Plan' AND active:'true'", limit: 1 });
  let productId = products.data[0]?.id;
  if (!productId) {
    const product = await s.products.create({
      name: "AthaNext Coach Plan",
      description: "Full coach tools on AthaNext — $29 every month after your 30-day free period.",
      metadata: { athanext: "coach_plan" },
    });
    productId = product.id;
  }
  const prices = await s.prices.list({ product: productId, active: true, type: "recurring", limit: 10 });
  const match = prices.data.find((p: Stripe.Price) => p.unit_amount === 2900 && p.currency === "usd" && p.recurring?.interval === "month");
  if (match) return match.id;
  const price = await s.prices.create({
    product: productId,
    unit_amount: 2900,
    currency: "usd",
    recurring: { interval: "month" },
    metadata: { athanext: "coach_plan" },
  });
  return price.id;
};

const ensureCustomer = async (coach: CoachRow, email: string | undefined): Promise<string> => {
  if (coach.stripe_customer_id) return coach.stripe_customer_id;
  const s = stripe();
  const admin = adminClient();
  if (email) {
    const found = await s.customers.list({ email, limit: 1 });
    const existing = found.data.find((c: Stripe.Customer) => c.metadata?.coach_id === coach.id) ?? found.data[0];
    if (existing) {
      await admin.from("coaches").update({ stripe_customer_id: existing.id }).eq("id", coach.id);
      return existing.id;
    }
  }
  const customer = await s.customers.create({
    email: email || coach.email || undefined,
    name: coach.name,
    metadata: { coach_id: coach.id, athanext: "coach_plan" },
  });
  await admin.from("coaches").update({ stripe_customer_id: customer.id }).eq("id", coach.id);
  return customer.id;
};

const syncSubscription = async (
  admin: SupabaseClient,
  coachId: string,
  sub: Stripe.Subscription,
) => {
  const { error } = await admin
    .from("coaches")
    .update({
      stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      subscription_status: sub.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", coachId);
  // Thrown so the webhook answers 500 and Stripe retries instead of losing the update.
  if (error) throw error;
};

/** Only the coach plan's subscriptions belong here (family group passes use the same Stripe account). */
const isCoachPlan = (sub: Stripe.Subscription) => !sub.metadata?.type || sub.metadata.type === "coach_plan";

const coachIdFromSub = async (admin: SupabaseClient, sub: Stripe.Subscription): Promise<string | null> => {
  const fromMeta = sub.metadata?.coach_id;
  if (fromMeta) return fromMeta;
  const { data } = await admin
    .from("coaches")
    .select("id")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();
  if (data?.id) return data.id as string;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return null;
  const { data: byCustomer } = await admin.from("coaches").select("id").eq("stripe_customer_id", customerId).maybeSingle();
  return (byCustomer?.id as string | undefined) ?? null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const stripeSignature = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  // Webhooks: Stripe signs the body; no user JWT. This endpoint has its own signing secret.
  if (stripeSignature) {
    const webhookSecret = Deno.env.get("STRIPE_COACH_BILLING_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("STRIPE_COACH_BILLING_WEBHOOK_SECRET is not set: coach plan webhooks can't be verified");
      return json({ error: "Webhook secret not configured" }, 500);
    }
    let event: Stripe.Event;
    try {
      event = await stripe().webhooks.constructEventAsync(rawBody, stripeSignature, webhookSecret);
    } catch (err) {
      console.error("coach-billing webhook signature check failed:", err);
      return json({ error: "Invalid signature" }, 400);
    }
    try {
      const admin = adminClient();

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.type === "coach_plan" && session.subscription) {
          const coachId = session.metadata.coach_id;
          const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const sub = await stripe().subscriptions.retrieve(subId);
          if (coachId) await syncSubscription(admin, coachId, sub);
        }
        return json({ received: true });
      }

      if (
        event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.deleted" ||
        event.type === "customer.subscription.created"
      ) {
        const sub = event.data.object as Stripe.Subscription;
        const coachId = isCoachPlan(sub) ? await coachIdFromSub(admin, sub) : null;
        if (coachId) {
          if (event.type === "customer.subscription.deleted") {
            const { error } = await admin
              .from("coaches")
              .update({
                stripe_subscription_id: sub.id,
                subscription_status: "canceled",
                updated_at: new Date().toISOString(),
              })
              .eq("id", coachId)
              // A newer subscription may already be active; only the coach's current one ends here.
              .or(`stripe_subscription_id.is.null,stripe_subscription_id.eq.${sub.id}`);
            if (error) throw error;
          } else {
            await syncSubscription(admin, coachId, sub);
          }
        }
        return json({ received: true });
      }

      if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
        // API 2025-08-27.basil moved the subscription to invoice.parent.subscription_details.
        const subRef = subscriptionIdFromInvoice(event.data.object as Parameters<typeof subscriptionIdFromInvoice>[0]);
        if (subRef) {
          const sub = await stripe().subscriptions.retrieve(subRef);
          const coachId = isCoachPlan(sub) ? await coachIdFromSub(admin, sub) : null;
          if (coachId) await syncSubscription(admin, coachId, sub);
        }
        return json({ received: true });
      }

      return json({ received: true });
    } catch (err) {
      console.error("coach-billing webhook error:", err);
      // 500 so Stripe retries; every branch is safe to repeat.
      return json({ error: err instanceof Error ? err.message : "Webhook failed" }, 500);
    }
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const body = rawBody ? JSON.parse(rawBody) : {};
    const action = (body.action as string | undefined) ?? "status";
    const admin = adminClient();
    const coach = await coachForUser(admin, user.id);
    if (!coach) return json({ error: "Only coaches have a plan" }, 403);

    if (action === "status") {
      // Soft reconcile so return-from-Checkout works before a webhook secret is configured:
      // if Stripe already has an active/trialing sub for this customer, mirror it onto coaches.
      let current = coach;
      if (current.stripe_customer_id && !(current.subscription_status && PAID.has(current.subscription_status))) {
        try {
          const listed = await stripe().subscriptions.list({
            customer: current.stripe_customer_id,
            status: "all",
            limit: 5,
          });
          const live = listed.data.find((s: Stripe.Subscription) => PAID.has(s.status));
          if (live) {
            await syncSubscription(admin, current.id, live);
            current = (await coachForUser(admin, user.id)) ?? current;
          }
        } catch (err) {
          console.error("coach-billing status reconcile:", err);
        }
      }
      return json(publicStatus(current));
    }

    if (action === "checkout") {
      if (coach.subscription_status && PAID.has(coach.subscription_status) && coach.stripe_subscription_id) {
        return json({ error: "You're already on the coach plan" }, 400);
      }
      const site = resolveSiteUrl(body.origin);
      const customerId = await ensureCustomer(coach, user.email);
      const priceId = await coachPriceId();
      // Subscribing during the free period keeps the rest of it: billing starts when it ends.
      // Stripe needs a trial end at least 48 hours away.
      const trialEnd = coach.trial_ends_at ? Math.floor(new Date(coach.trial_ends_at).getTime() / 1000) : 0;
      const keepTrial = trialEnd > Math.floor(Date.now() / 1000) + 48 * 60 * 60;
      const session = await stripe().checkout.sessions.create(
        {
          ...USD_ONLY_CHECKOUT,
          customer: customerId,
          mode: "subscription",
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: `${site}/settings?tab=plan&billing=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${site}/settings?tab=plan&billing=cancel`,
          client_reference_id: coach.id,
          subscription_data: {
            metadata: { type: "coach_plan", coach_id: coach.id },
            ...(keepTrial ? { trial_end: trialEnd } : {}),
          },
          metadata: { type: "coach_plan", coach_id: coach.id },
        },
        // A double click within the same minute opens the same Checkout, not two subscriptions.
        { idempotencyKey: `coach-plan-checkout:${coach.id}:${keepTrial ? trialEnd : "now"}:${site}:${minuteBucket(Date.now())}` },
      );
      return json({ url: session.url, session_id: session.id });
    }

    if (action === "portal") {
      const site = resolveSiteUrl(body.origin);
      const customerId = await ensureCustomer(coach, user.email);
      const portal = await stripe().billingPortal.sessions.create({
        customer: customerId,
        return_url: `${site}/settings?tab=plan`,
      });
      return json({ url: portal.url });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("coach-billing error:", err);
    return json({ error: err instanceof Error ? err.message : "Something went wrong" }, 500);
  }
});
