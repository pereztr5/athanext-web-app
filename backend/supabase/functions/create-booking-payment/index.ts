import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RECONCILE_FUNCTION_NAME = "reconcile-stripe-fees";

const NOTIFICATION_FUNCTION_NAME = "send-booking-notifications";

const isSessionPaid = (session: Stripe.Checkout.Session) => {
  const payStatus = session.payment_status;
  const intentStatus = (session.payment_intent as any)?.status;
  return (
    payStatus === "paid" ||
    payStatus === "no_payment_required" ||
    intentStatus === "succeeded"
  );
};

type SupabaseClient = ReturnType<typeof createClient>;

type PaymentUpdateResult = {
  paid: boolean;
  newlyPaid: boolean;
  bookingIds: string[];
};

const extractPaymentIntentId = (session: Stripe.Checkout.Session): string | null => {
  const intent = session.payment_intent;
  if (!intent) return null;
  if (typeof intent === "string") return intent;
  if (typeof intent === "object" && "id" in intent) {
    return (intent as Stripe.PaymentIntent).id ?? null;
  }
  return null;
};

const parsePercent = (value: unknown): number | null => {
  const num = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(num) ? num : null;
};

const fetchFeePercents = async (client: SupabaseClient) => {
  let platformFeePerc = 0;
  let stripeFeePerc = 0;
  const { data: feeRows, error: feeErr } = await client
    .from("configurations" as any)
    .select("key,value")
    .in("key", ["platform_fees", "stripe_fees"]);

  if (feeErr) throw feeErr;

  feeRows?.forEach((row) => {
    const v = Number.parseFloat(row.value);
    if (Number.isFinite(v)) {
      if (row.key === "platform_fees") platformFeePerc = v;
      if (row.key === "stripe_fees") stripeFeePerc = v;
    }
  });

  return { platformFeePerc, stripeFeePerc };
};

const fetchDefaultGroupCapacity = async (client: SupabaseClient): Promise<number> => {
  try {
    const { data, error } = await client
      .from("configurations" as any)
      .select("value")
      .eq("key", "default_max_bookings_group")
      .maybeSingle();
    if (error) return 50;
    const parsed = Number.parseInt(data?.value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
  } catch (err) {
    console.error("Failed to load default group capacity", err);
    return 50;
  }
};

const resolveFeePercents = async (
  session: Stripe.Checkout.Session,
  client: SupabaseClient,
): Promise<{ platformFeePerc: number; stripeFeePerc: number }> => {
  const metaPlatform = parsePercent((session.metadata as any)?.platform_fee_perc);
  const metaStripe = parsePercent((session.metadata as any)?.stripe_fee_perc);

  if (metaPlatform != null && metaStripe != null) {
    return { platformFeePerc: metaPlatform, stripeFeePerc: metaStripe };
  }

  const fallback = await fetchFeePercents(client);
  return {
    platformFeePerc: metaPlatform ?? fallback.platformFeePerc,
    stripeFeePerc: metaStripe ?? fallback.stripeFeePerc,
  };
};

const ensurePaymentRowsForSession = async (
  session: Stripe.Checkout.Session,
  client: SupabaseClient,
) => {
  const { platformFeePerc, stripeFeePerc } = await resolveFeePercents(session, client);
  const paymentIntentId = extractPaymentIntentId(session);

  const { data: bookings, error: bookingFetchErr } = await client
    .from("coach_slot_bookings" as any)
    .select("id, occurrence_id")
    .eq("stripe_session_id", session.id);

  if (bookingFetchErr) throw bookingFetchErr;
  if (!bookings || bookings.length === 0) return;

  const occurrenceIds = bookings.map((b) => b.occurrence_id);

  const { data: occurrences, error: occErr } = await client
    .from("coach_availability_slot_occurrences" as any)
    .select("id, price")
    .in("id", occurrenceIds);
  if (occErr) throw occErr;

  const occurrenceById = new Map((occurrences || []).map((occ) => [occ.id, occ]));

  const paymentRows = bookings
    .map((booking) => {
      const occ = occurrenceById.get(booking.occurrence_id);
      if (!occ) return null;
      const baseAmount = Number(occ.price || 0);
      const platformFeeAmount = Number((baseAmount * platformFeePerc / 100).toFixed(2));
      const stripeFeeAmount = Number((baseAmount * stripeFeePerc / 100).toFixed(2));
      const totalAmount = Number((baseAmount + platformFeeAmount + stripeFeeAmount).toFixed(2));
      return {
        booking_id: booking.id,
        slot_id: booking.occurrence_id,
        coach_offer_amount: baseAmount,
        platform_fee_amount: platformFeeAmount,
        stripe_price_amount: stripeFeeAmount,
        total_amount: totalAmount,
        currency: "USD",
        type: "booking_credit",
        stripe_session_id: session.id,
        stripe_payment_intent: paymentIntentId,
      };
    })
    .filter((row): row is Record<string, unknown> => Boolean(row));

  if (paymentRows.length) {
    const { error: paymentsInsertErr } = await client
      .from("payments" as any)
      .upsert(paymentRows as any, { onConflict: "booking_id" });
    if (paymentsInsertErr) throw paymentsInsertErr;
  }
};

const getBookingIdsForSession = async (client: SupabaseClient, sessionId: string): Promise<string[]> => {
  const { data, error } = await client
    .from("coach_slot_bookings" as any)
    .select("id")
    .eq("stripe_session_id", sessionId);

  if (error) throw error;
  return (data || []).map((r: any) => r.id);
};


const callReconcileEndpointForBookings = async (bookingIds: string[]) => {
  const uniqueIds = Array.from(new Set(bookingIds));
  if (!uniqueIds.length) return;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRole) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for reconcile call");
    return;
  }

  const url = `${supabaseUrl}/functions/v1/${RECONCILE_FUNCTION_NAME}`;

  for (const booking_id of uniqueIds) {
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRole}`,
        },
        body: JSON.stringify({ booking_id }),
      });

      const text = await resp.text();
      if (!resp.ok) {
        console.error("Reconcile failed for booking:", booking_id, resp.status, text);
      } else {
        console.log("Reconcile ok for booking:", booking_id, text);
      }
    } catch (e) {
      console.error("Reconcile call error for booking:", booking_id, e);
    }
  }
};

const callNotificationEndpointForBookings = async (bookingIds: string[]) => {
  const uniqueIds = Array.from(new Set(bookingIds));
  if (!uniqueIds.length) return;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRole) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for notification call");
    return;
  }

  const url = `${supabaseUrl}/functions/v1/${NOTIFICATION_FUNCTION_NAME}`;

  for (const booking_id of uniqueIds) {
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRole}`,
        },
        body: JSON.stringify({ booking_id }),
      });

      const text = await resp.text();
      if (!resp.ok) {
        console.error("Notification failed for booking:", booking_id, resp.status, text);
      } else {
        console.log("Notification ok for booking:", booking_id, text);
      }
    } catch (e) {
      console.error("Notification call error for booking:", booking_id, e);
    }
  }
};

const updateBookingPaymentStatus = async (
  session: Stripe.Checkout.Session,
  client: SupabaseClient,
): Promise<PaymentUpdateResult> => {
  const paid = isSessionPaid(session);
  if (!paid) {
    return { paid: false, newlyPaid: false, bookingIds: [] as string[] };
  }

  const paymentIntentId = extractPaymentIntentId(session);

  const { data: updatedRows, error: updErr } = await client
    .from("coach_slot_bookings" as any)
    .update({
      status: "booked",
      payment_status: "paid",
      stripe_session_id: session.id,
      stripe_payment_intent: paymentIntentId,
    })
    .eq("stripe_session_id", session.id)
    .neq("payment_status", "paid")
    .select("id");
  if (updErr) throw updErr;

  const newlyPaidIds = (updatedRows || []).map((r) => r.id);

  if (!newlyPaidIds.length) {
    const { error: syncErr } = await client
      .from("coach_slot_bookings" as any)
      .update({
        stripe_session_id: session.id,
        stripe_payment_intent: paymentIntentId,
      })
      .eq("stripe_session_id", session.id);
    if (syncErr) throw syncErr;
  }

  await ensurePaymentRowsForSession(session, client);

  return { paid: true, newlyPaid: newlyPaidIds.length > 0, bookingIds: newlyPaidIds };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  try {
    const rawBody = await req.text();
    const stripeSignature = req.headers.get("stripe-signature");
    const parsedBody = rawBody && !stripeSignature ? JSON.parse(rawBody) : {};

    if (req.method === "GET") {
      const url = new URL(req.url);
      const sessionId = url.searchParams.get("session_id");
      if (!sessionId) {
        return new Response(JSON.stringify({ error: "session_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["payment_intent"],
      });

      const { paid, newlyPaid, bookingIds } = await updateBookingPaymentStatus(session, supabaseClient);

      if (paid && newlyPaid) {
        await callReconcileEndpointForBookings(bookingIds);
        await callNotificationEndpointForBookings(bookingIds);
      }

      return new Response(
        JSON.stringify({
          session_id: sessionId,
          payment_status: session.payment_status,
          reconcile_called: paid && newlyPaid,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    if (stripeSignature) {
      const webhookSecret = Deno.env.get("STRIPE_CHECKOUT_WEBHOOK_SECRET");
      if (!webhookSecret) {
        return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(rawBody, stripeSignature, webhookSecret);
      } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;

        if (isSessionPaid(session)) {
          try {
            const { paid, newlyPaid, bookingIds } = await updateBookingPaymentStatus(session, supabaseClient);

            if (paid && newlyPaid) {
              await callReconcileEndpointForBookings(bookingIds);
              await callNotificationEndpointForBookings(bookingIds);
            }
          } catch (updErr: any) {
            console.error("Failed to mark bookings paid:", updErr);
            return new Response(JSON.stringify({ error: updErr?.message || "Failed to update booking status" }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }

      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (parsedBody.session_id && typeof parsedBody.session_id === "string") {
      const sessionId = parsedBody.session_id;

      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["payment_intent"],
      });

      const { paid, newlyPaid, bookingIds } = await updateBookingPaymentStatus(session, supabaseClient);

      if (paid && newlyPaid) {
        await callReconcileEndpointForBookings(bookingIds);
        await callNotificationEndpointForBookings(bookingIds);
      }

      return new Response(
        JSON.stringify({
          session_id: sessionId,
          payment_status: session.payment_status,
          reconcile_called: paid && newlyPaid,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const {
      occurrence_id,
      occurrence_ids,
      athlete_id,
      notes,
    } = parsedBody;

    const occurrenceIds: string[] = Array.isArray(occurrence_ids)
      ? occurrence_ids
      : occurrence_id
        ? [occurrence_id]
        : [];

    if (!occurrenceIds.length) {
      throw new Error("occurrence_id or occurrence_ids is required");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authentication required for booking");
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !userData.user) {
      console.error("Authentication failed:", authError);
      throw new Error("Invalid authentication token");
    }
    const user = userData.user;

    if (typeof athlete_id !== "string" || !athlete_id.trim()) {
      throw new Error("athlete_id is required");
    }
    const athleteId = athlete_id.trim();

    const { data: occurrences, error: occErr } = await supabaseClient
      .from("coach_availability_slot_occurrences" as any)
      .select(
        "id, availability_id, weekly_slot_id, coach_id, occurrence_date, session_name, price, duration_minutes, start_time, end_time, session_type, location, max_bookings_per_slot, is_enabled",
      )
      .in("id", occurrenceIds);
    if (occErr) throw occErr;
    if (!occurrences || occurrences.length !== occurrenceIds.length) {
      throw new Error("One or more occurrences not found");
    }

    const coachId = occurrences[0].coach_id;
    const availabilityId = occurrences[0].availability_id;
    const weeklySlotId = occurrences[0].weekly_slot_id;
    const sameCoach = occurrences.every((o) => o.coach_id === coachId);
    if (!sameCoach) {
      throw new Error("Occurrences must belong to the same coach");
    }

    const defaultGroupCapacity = await fetchDefaultGroupCapacity(supabaseClient);
    const { data: existingBookings, error: bookingsErr } = await supabaseClient
      .from("coach_slot_bookings" as any)
      .select("id, occurrence_id, athlete_id, status, stripe_session_id")
      .in("occurrence_id", occurrenceIds)
      .in("status", ["pending_payment", "booked", "completed"]);
    if (bookingsErr) throw bookingsErr;

    const bookingsByOccurrence = new Map<string, any[]>();
    (existingBookings || []).forEach((row) => {
      const list = bookingsByOccurrence.get(row.occurrence_id) || [];
      list.push(row);
      bookingsByOccurrence.set(row.occurrence_id, list);
    });

    for (const occ of occurrences) {
      if (!occ.is_enabled) {
        throw new Error(`Occurrence ${occ.id} is disabled`);
      }
      const capacity = occ.session_type === "group"
        ? (occ.max_bookings_per_slot && occ.max_bookings_per_slot > 0 ? occ.max_bookings_per_slot : defaultGroupCapacity)
        : (occ.max_bookings_per_slot && occ.max_bookings_per_slot > 0 ? occ.max_bookings_per_slot : 1);
      const bookingsForOcc = bookingsByOccurrence.get(occ.id) || [];
      const currentCount = bookingsForOcc.length;
      const myBookingForOcc = bookingsForOcc.find((b) => b.athlete_id === athleteId);
      if (currentCount >= capacity && !myBookingForOcc) {
        throw new Error(`Occurrence on ${occ.occurrence_date} is fully booked`);
      }
    }

    const myBookings = (existingBookings || []).filter((b) => b.athlete_id === athleteId);
    const hasPaidBooking = myBookings.some((b) => b.status === "booked" || b.status === "completed");
    if (hasPaidBooking) {
      throw new Error("You already have a booking for this session.");
    }

    const myPendingBookings = myBookings.filter((b) => b.status === "pending_payment");
    const pendingOccSet = new Set(myPendingBookings.map((b) => b.occurrence_id));
    const coversAllPending = myPendingBookings.length > 0
      && occurrenceIds.every((id) => pendingOccSet.has(id))
      && pendingOccSet.size === occurrenceIds.length;
    let reusingPendingBookings = false;

    const { platformFeePerc: basePlatformFeePerc, stripeFeePerc } = await fetchFeePercents(supabaseClient);

    // Platform fee waiver: confirmed offline coach-client relationship for this
    // exact (coach, athlete) pair. This client is service-role (RLS bypassed);
    // the query is scoped by the explicit filters. A query error falls through
    // to the full fee (fails safe toward charging, never toward a discount).
    const { data: waiverRow } = await supabaseClient
      .from("coach_client_referrals" as any)
      .select("id")
      .eq("coach_id", coachId)
      .eq("athlete_id", athleteId)
      .eq("status", "confirmed")
      .maybeSingle();
    const platformFeePerc = waiverRow ? 0 : basePlatformFeePerc;
    const feeFactor = 1 + platformFeePerc / 100 + stripeFeePerc / 100;

    const totalBase = occurrences.reduce((sum, occ) => sum + Number(occ.price || 0), 0);
    const totalWithFees = Number((totalBase * feeFactor).toFixed(2));
    const amountInCents = Math.round(totalWithFees * 100);
    if (amountInCents <= 0) {
      throw new Error("Total amount must be greater than zero");
    }

    let bookingIds: string[] = [];
    if (coversAllPending) {
      reusingPendingBookings = true;
      bookingIds = myPendingBookings.map((b) => b.id);
    } else {
      if (myPendingBookings.length) {
        throw new Error("You already have a pending booking for this session. Please complete payment for it before creating a new one.");
      }

      const inserts = occurrences.map((occ) => ({
        occurrence_id: occ.id,
        weekly_slot_id: occ.weekly_slot_id,
        availability_id: occ.availability_id,
        coach_id: occ.coach_id,
        athlete_id: athleteId,
        status: "pending_payment",
        payment_status: "unpaid",
        notes: notes || null,
        created_by: user.id,
      }));

      const { data: bookingRows, error: bookingErr } = await supabaseClient
        .from("coach_slot_bookings" as any)
        .insert(inserts)
        .select("id, occurrence_id");
      if (bookingErr) throw bookingErr;
      bookingIds = (bookingRows || []).map((b) => b.id);
    }

    let customerId: string | undefined;
    if (user?.email) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }

    const line_items = occurrences.map((occ) => ({
      price_data: {
        currency: "usd",
        unit_amount: Math.round(Number(occ.price || 0) * feeFactor * 100),
        product_data: {
          name: occ.session_name || "Coaching Session",
          description: `${occ.session_type || "session"} on ${occ.occurrence_date}`,
        },
      },
      quantity: 1,
    }));

    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email || undefined,
        payment_method_types: ["card"],
        line_items,
        mode: "payment",
        success_url: `${req.headers.get("origin")}/booking-confirmation?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.get("origin")}/coach/${coachId}`,
        metadata: {
          occurrence_ids: occurrenceIds.join(","),
          booking_ids: bookingIds.join(","),
          coach_id: coachId,
          availability_id: availabilityId,
          weekly_slot_id: weeklySlotId,
          athlete_id: athleteId,
          platform_fee_perc: platformFeePerc.toString(),
          stripe_fee_perc: stripeFeePerc.toString(),
        },
      });
    } catch (err) {
      if (!reusingPendingBookings && bookingIds.length) {
        await supabaseClient.from("coach_slot_bookings" as any).delete().in("id", bookingIds);
      }
      throw err;
    }

    const { error: updErr } = await supabaseClient
      .from("coach_slot_bookings" as any)
      .update({
        stripe_session_id: session.id,
        stripe_payment_intent: extractPaymentIntentId(session),
      })
      .in("id", bookingIds);
    if (updErr) throw updErr;

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error creating booking payment:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
