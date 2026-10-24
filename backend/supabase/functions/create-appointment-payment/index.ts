import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { USD_ONLY_CHECKOUT } from "../_shared/checkout.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    // Get request data with enhanced validation
    const body = await req.json();
    const {
      coach_id,
      scheduled_at,
      duration_minutes,
      service_type,
      location,
      total_amount,
      notes,
    } = body;

    // Enhanced input validation
    if (!coach_id || typeof coach_id !== 'string') {
      throw new Error('Valid coach ID is required');
    }
    
    if (!scheduled_at || !Date.parse(scheduled_at)) {
      throw new Error('Valid scheduled date is required');
    }
    
    if (!duration_minutes || typeof duration_minutes !== 'number' || duration_minutes < 30 || duration_minutes > 300) {
      throw new Error('Valid duration (30-300 minutes) is required');
    }
    
    if (!service_type || typeof service_type !== 'string' || service_type.length > 100) {
      throw new Error('Valid service type is required');
    }
    
    if (!location || typeof location !== 'string' || location.length > 200) {
      throw new Error('Valid location is required');
    }
    
    if (typeof total_amount !== 'number' || total_amount < 0) {
      throw new Error('Valid total amount is required');
    }
    
    if (notes && (typeof notes !== 'string' || notes.length > 500)) {
      throw new Error('Notes must be less than 500 characters');
    }

    console.log("Creating appointment payment for:", {
      coach_id,
      scheduled_at,
      duration_minutes,
      service_type,
      location,
      total_amount,
    });

    // Enhanced authentication check - require authentication for bookings
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error('Authentication required for booking');
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !userData.user) {
      console.error('Authentication failed:', authError);
      throw new Error('Invalid authentication token');
    }
    
    const user = userData.user;
    console.log('Authenticated user:', user.id);

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Get coach details
    const { data: coach, error: coachError } = await supabaseClient
      .from('coaches')
      .select('name, hourly_rate')
      .eq('id', coach_id)
      .single();

    if (coachError || !coach) {
      throw new Error('Coach not found');
    }

    // Create or find Stripe customer if user is authenticated
    let customerId;
    if (user?.email) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }

    // Create checkout session for appointment payment
    const session = await stripe.checkout.sessions.create({
      ...USD_ONLY_CHECKOUT,
      customer: customerId,
      customer_email: customerId ? undefined : undefined, // Allow guest checkout
      line_items: [
        {
          price: "price_1SAtpAHdrmovhJRNe6PrkcgM", // Coaching session price
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/booking-confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/`,
      metadata: {
        coach_id,
        scheduled_at,
        duration_minutes: duration_minutes.toString(),
        service_type,
        location,
        total_amount: total_amount.toString(),
        notes: notes || "",
        user_id: user?.id || "",
      },
    });

    console.log("Checkout session created:", session.id);

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error creating appointment payment:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});