import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { loadFeeConfig } from "../_shared/fee_config.ts";
import { feeConfigMetadata, feeLine, toCents } from "../_shared/fees.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error("Authentication error:", authError);
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error("STRIPE_SECRET_KEY is not set: package payments can't run");
      return json({ error: "Payments aren't set up yet. Please try again later." }, 500);
    }
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Cancel a monthly group pass at period end (family owns the purchase).
    if (body.action === "cancel") {
      const purchaseId = body.purchase_id as string | undefined;
      if (!purchaseId) return json({ error: "purchase_id required" }, 400);
      const { data: purchase } = await admin
        .from("package_purchases")
        .select("id, user_id, stripe_subscription_id, status")
        .eq("id", purchaseId)
        .maybeSingle();
      if (!purchase || purchase.user_id !== user.id) return json({ error: "Not found" }, 404);
      if (!purchase.stripe_subscription_id) return json({ error: "This package does not renew" }, 400);
      await stripe.subscriptions.update(purchase.stripe_subscription_id as string, { cancel_at_period_end: true });
      return json({ canceled: true, cancel_at_period_end: true });
    }

    const fees = await loadFeeConfig(admin);
    const { package_id, coach_id, org_package_id } = body as {
      package_id?: string;
      coach_id?: string;
      org_package_id?: string;
    };

    // Academy packages (Working Copy): credits with the listed coaches, paid per session used.
    // Group passes renew monthly as a Stripe subscription (no free trial).
    if (org_package_id) {
      const { data: pkg } = await admin
        .from("org_packages")
        .select("id, organization_id, name, kind, session_count, price, validity_days, renews_monthly, is_active, organizations(name, slug)")
        .eq("id", org_package_id)
        .maybeSingle();
      if (!pkg || !pkg.is_active) {
        return json({ error: "Package not found" }, 404);
      }
      const org = (pkg as any).organizations as { name: string; slug: string } | null;
      const found = await stripe.customers.list({ email: user.email, limit: 1 });
      const customer = found.data[0] ?? (await stripe.customers.create({ email: user.email, metadata: { supabase_user_id: user.id } }));
      const days = pkg.renews_monthly ? 31 : pkg.validity_days;
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + days);
      const listPrice = Number(pkg.price);
      // Academy packages: the platform fee only, card processing absorbed (no referral waiver).
      const unitAmount = feeLine(toCents(listPrice), "org_package", fees).totalCents;
      const metadata = {
        type: "package_purchase",
        org_package_id: pkg.id,
        organization_id: pkg.organization_id,
        user_id: user.id,
        sessions_total: String(pkg.session_count),
        validity_days: String(days),
        expiry_date: expiry.toISOString(),
        list_price: String(listPrice),
        ...feeConfigMetadata(fees),
        platform_waived: "0",
      };
      const priceData = {
        currency: "usd",
        unit_amount: unitAmount,
        product_data: {
          name: `${pkg.name} - ${org?.name ?? "Academy"}`,
          description: `${pkg.session_count} ${pkg.kind === "group" ? "group sessions" : "sessions"}${
            pkg.renews_monthly ? " every month" : ` | Valid for ${pkg.validity_days} days`
          }`,
        },
      };
      const origin = req.headers.get("origin");
      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ["card"],
        line_items: [{ price_data: pkg.renews_monthly ? { ...priceData, recurring: { interval: "month" } } : priceData, quantity: 1 }],
        mode: pkg.renews_monthly ? "subscription" : "payment",
        ...(pkg.renews_monthly ? { subscription_data: { metadata } } : {}),
        success_url: `${origin}/package-confirmation?session_id={CHECKOUT_SESSION_ID}&org_package_id=${pkg.id}`,
        cancel_url: `${origin}/organizations/${org?.slug ?? ""}`,
        metadata,
      });
      return json({ url: session.url, session_id: session.id });
    }

    if (!package_id || !coach_id) {
      return json({ error: "Missing required fields: package_id and coach_id" }, 400);
    }

    const { data: packageData, error: packageError } = await supabaseClient
      .from("coach_packages")
      .select("*, coaches!inner(name, email)")
      .eq("id", package_id)
      .eq("coach_id", coach_id)
      .single();

    if (packageError || !packageData) {
      console.error("Package fetch error:", packageError);
      return json({ error: "Package not found" }, 404);
    }

    // Camps are one registration. Reconcile copies sessions_total onto the purchase and
    // treats 0 as 1, and package_purchases requires sessions_total > 0. Metadata therefore
    // sends 1. The camp purchase trigger sets sessions_remaining to 0, which is what
    // booking spends, so the family does not get a session credit. The purchase row still
    // counts toward capacity and the coach is still paid the list price.
    const isCamp = packageData.kind === "camp";
    if (isCamp) {
      if (packageData.is_active === false) {
        return json({ error: "This camp is not open for registration" }, 400);
      }
      const endsOn = typeof packageData.camp_ends_on === "string" ? packageData.camp_ends_on.slice(0, 10) : null;
      const today = new Date().toISOString().slice(0, 10);
      if (endsOn && endsOn < today) {
        return json({ error: "This camp has ended" }, 400);
      }
      if (packageData.camp_capacity != null) {
        const capacity = Number(packageData.camp_capacity);
        if (!Number.isFinite(capacity)) {
          return json({ error: "Could not check how many spots are left. Try again." }, 500);
        }
        // camp_spots_left counts these purchases plus camp sign-up registrations (camp-signup),
        // so the two ways in never oversell. Before that migration: purchases only, as before.
        const { data: spotsLeft, error: spotsError } = await admin.rpc("camp_spots_left", { p_camp_id: packageData.id });
        if (!spotsError && typeof spotsLeft === "number") {
          if (spotsLeft <= 0) return json({ error: "This camp is full" }, 409);
        } else {
          const { count, error: countError } = await admin
            .from("package_purchases")
            .select("id", { count: "exact", head: true })
            .eq("package_id", packageData.id)
            .in("status", ["active", "expired", "completed"]);
          if (countError) {
            console.error("Camp capacity check failed", countError);
            return json({ error: "Could not check how many spots are left. Try again." }, 500);
          }
          if ((count ?? 0) >= capacity) {
            return json({ error: "This camp is full" }, 409);
          }
        }
      }
    }

    const campWhen = [packageData.camp_starts_on, packageData.camp_ends_on].filter(Boolean).join(" to ");
    const campLine = [packageData.camp_location, campWhen].filter(Boolean).join(" · ");

    // Camps carry no platform fee for anyone (card processing only). Packages: same referral
    // waiver as booking, a confirmed coach-client pair for an athlete the caller owns.
    let platformWaived = isCamp;
    const { data: athleteRows } = isCamp
      ? { data: [] }
      : await supabaseClient.from("athlete_profiles").select("id").eq("user_id", user.id).limit(20);
    const athleteIds = (athleteRows ?? []).map((a) => a.id as string);
    if (athleteIds.length) {
      const { data: waiverRows } = await supabaseClient
        .from("coach_client_referrals")
        .select("id")
        .eq("coach_id", coach_id)
        .in("athlete_id", athleteIds)
        .eq("status", "confirmed")
        .limit(1);
      if (waiverRows?.length) platformWaived = true;
    }

    // coach_packages.total_price is stored in cents.
    const listPrice = Number(packageData.total_price) / 100;
    const unitAmount = feeLine(toCents(listPrice), isCamp ? "camp" : "package", fees, platformWaived).totalCents;

    let customer;
    const existingCustomers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
    }

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + packageData.validity_days);

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: unitAmount,
            product_data: {
              name: `${packageData.package_name} - ${packageData.coaches.name}`,
              description: isCamp
                ? campLine || "One registration. This does not add session credits."
                : `${packageData.session_count} sessions × ${packageData.duration_minutes} min | Valid for ${packageData.validity_days} days`,
            },
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/package-confirmation?session_id={CHECKOUT_SESSION_ID}&package_id=${packageData.id}&coach_id=${packageData.coach_id}`,
      cancel_url: `${req.headers.get("origin")}/`,
      metadata: {
        package_id: packageData.id,
        coach_id: packageData.coach_id,
        user_id: user.id,
        sessions_total: isCamp ? "1" : packageData.session_count.toString(),
        sessions_remaining: isCamp ? "0" : packageData.session_count.toString(),
        camp: isCamp ? "1" : "0",
        expiry_date: expiryDate.toISOString(),
        type: "package_purchase",
        list_price: String(listPrice),
        ...feeConfigMetadata(fees),
        ...(platformWaived ? { platform_fee_perc: "0" } : {}),
        platform_waived: platformWaived ? "1" : "0",
      },
    });

    return json({ url: session.url, session_id: session.id });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in create-package-payment function:", error);
    return json({ error: errorMessage }, 500);
  }
});
