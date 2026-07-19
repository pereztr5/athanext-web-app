import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { package_id, coach_id } = await req.json();

    if (!package_id || !coach_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: package_id and coach_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching package details for:', package_id);

    const { data: packageData, error: packageError } = await supabaseClient
      .from('coach_packages')
      .select('*, coaches!inner(name, email)')
      .eq('id', package_id)
      .eq('coach_id', coach_id)
      .single();

    if (packageError || !packageData) {
      console.error('Package fetch error:', packageError);
      return new Response(
        JSON.stringify({ error: 'Package not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    console.log('Creating Stripe customer for user:', user.email);

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

    console.log('Creating Stripe checkout session');

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + packageData.validity_days);

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: packageData.total_price,
            product_data: {
              name: `${packageData.package_name} - ${packageData.coaches.name}`,
              description: `${packageData.session_count} sessions × ${packageData.duration_minutes} min | Valid for ${packageData.validity_days} days`,
            },
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.get('origin')}/package-confirmation?session_id={CHECKOUT_SESSION_ID}&package_id=${packageData.id}&coach_id=${packageData.coach_id}`,
      cancel_url: `${req.headers.get('origin')}/`,
      metadata: {
        package_id: packageData.id,
        coach_id: packageData.coach_id,
        user_id: user.id,
        sessions_total: packageData.session_count.toString(),
        sessions_remaining: packageData.session_count.toString(),
        expiry_date: expiryDate.toISOString(),
        type: 'package_purchase',
      },
    });

    console.log('Checkout session created:', session.id);

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in create-package-payment function:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
