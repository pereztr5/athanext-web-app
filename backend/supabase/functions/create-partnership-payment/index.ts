import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { USD_ONLY_CHECKOUT } from "../_shared/checkout.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
      }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const { partnershipId } = await req.json();

    if (!partnershipId) {
      throw new Error("Partnership ID is required");
    }

    // Fetch partnership details
    const { data: partnership, error: partnershipError } = await supabaseClient
      .from("partnerships")
      .select("*")
      .eq("id", partnershipId)
      .single();

    if (partnershipError || !partnership) {
      throw new Error("Partnership not found");
    }

    // Check if partnership is available
    if (partnership.status !== "Available Now") {
      throw new Error("This partnership service is not currently available");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Create or retrieve customer
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    let customer;
    if (customers.data.length > 0) {
      customer = customers.data[0];
    } else {
      customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
    }

    const session = await stripe.checkout.sessions.create({
      ...USD_ONLY_CHECKOUT,
      customer: customer.id,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: partnership.name,
              description: partnership.description,
              images: partnership.logo ? [partnership.logo] : [],
            },
            unit_amount: partnership.price,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/partnership-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/partnerships`,
      metadata: {
        partnership_id: partnershipId,
        partnership_name: partnership.name,
        user_id: user.id,
        user_email: user.email || "",
      },
    });

    console.log("Stripe session created:", session.id);

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error("Error creating partnership payment:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
