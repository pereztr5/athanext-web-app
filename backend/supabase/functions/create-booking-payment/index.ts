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
    .eq("stripe_session_id", session.id)
    .eq("payment_status", "paid");

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

// Coach payouts: send the coach's (and any org's) share as soon as a booking is paid.
const callPayoutTransfersForBookings = async (bookingIds: string[]) => {
  const ids = Array.from(new Set(bookingIds));
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!ids.length || !supabaseUrl || !serviceRole) return;
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/stripe-payouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRole}` },
      body: JSON.stringify({ action: "transfer_bookings", booking_ids: ids }),
    });
    const text = await resp.text();
    if (!resp.ok) console.error("Payout transfers failed:", resp.status, text);
  } catch (e) {
    console.error("Payout transfers call error:", e);
  }
};

/* ---------- Requests from new families (ATH-85): hold the card, charge only on accept ---------- */

/** Once the family finishes Stripe's page, the request is created with the card held. */
const createRequestFromSession = async (session: Stripe.Checkout.Session, client: SupabaseClient, stripe: Stripe) => {
  if (session.metadata?.request !== "1" || session.status !== "complete") return { created: false, full: false };
  const intentId = extractPaymentIntentId(session);
  const { data: existing } = await client.from("coach_slot_bookings" as any).select("id").eq("stripe_session_id", session.id).limit(1);
  if (existing?.length) return { created: false, full: false };

  const occurrenceIds = String(session.metadata.occurrence_ids ?? "").split(",").filter(Boolean);
  const { data: occurrences } = await client
    .from("coach_availability_slot_occurrences" as any)
    .select("id, coach_id, weekly_slot_id, availability_id, max_bookings_per_slot")
    .in("id", occurrenceIds);
  for (const occ of (occurrences ?? []) as any[]) {
    const { count } = await client
      .from("coach_slot_bookings" as any)
      .select("id", { count: "exact", head: true })
      .eq("occurrence_id", occ.id)
      .in("status", ACTIVE_BOOKING_STATUSES);
    if ((count ?? 0) >= (occ.max_bookings_per_slot || 1)) {
      if (intentId) await stripe.paymentIntents.cancel(intentId).catch((e: unknown) => console.error("Release failed", e));
      return { created: false, full: true };
    }
  }
  const { error } = await client.from("coach_slot_bookings" as any).insert(
    ((occurrences ?? []) as any[]).map((occ) => ({
      occurrence_id: occ.id,
      weekly_slot_id: occ.weekly_slot_id,
      availability_id: occ.availability_id,
      coach_id: occ.coach_id,
      athlete_id: session.metadata!.athlete_id,
      status: "requested",
      payment_status: "authorized",
      notes: session.metadata!.notes || null,
      created_by: session.metadata!.user_id || null,
      stripe_session_id: session.id,
      stripe_payment_intent: intentId,
    })),
  );
  if (error) throw error;
  return { created: true, full: false };
};

/**
 * When every request paid with one card hold has an answer, charge the accepted ones and
 * release the rest. Returns the ids that were charged.
 */
const settleRequestHold = async (sessionId: string, client: SupabaseClient, stripe: Stripe): Promise<string[]> => {
  const { data: rows } = await client
    .from("coach_slot_bookings" as any)
    .select("id, status, payment_status, occurrence_id, stripe_payment_intent")
    .eq("stripe_session_id", sessionId);
  const list = (rows ?? []) as any[];
  if (!list.length || list.some((r) => r.status === "requested")) return [];
  const accepted = list.filter((r) => r.payment_status === "authorized" && (r.status === "booked" || r.status === "pending_payment"));
  const intentId = list.find((r) => r.stripe_payment_intent)?.stripe_payment_intent as string | undefined;
  if (!intentId) return [];
  const intent = await stripe.paymentIntents.retrieve(intentId);
  if (intent.status !== "requires_capture") return [];

  if (!accepted.length) {
    await stripe.paymentIntents.cancel(intentId);
    await client.from("coach_slot_bookings" as any).update({ payment_status: "released" }).eq("stripe_session_id", sessionId).eq("payment_status", "authorized");
    return [];
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const { platformFeePerc, stripeFeePerc } = await resolveFeePercents(session, client);
  const feeFactor = 1 + platformFeePerc / 100 + stripeFeePerc / 100;
  const { data: occs } = await client
    .from("coach_availability_slot_occurrences" as any)
    .select("id, price")
    .in("id", accepted.map((r) => r.occurrence_id));
  const priceOf = new Map(((occs ?? []) as any[]).map((o) => [o.id, Number(o.price || 0)]));
  const amount = accepted.reduce((sum, r) => sum + Math.round((priceOf.get(r.occurrence_id) ?? 0) * feeFactor * 100), 0);
  await stripe.paymentIntents.capture(intentId, { amount_to_capture: Math.min(amount, intent.amount_capturable) });

  const ids = accepted.map((r) => r.id);
  await client.from("coach_slot_bookings" as any).update({ status: "booked", payment_status: "paid", updated_at: new Date().toISOString() }).in("id", ids);
  await client.from("coach_slot_bookings" as any).update({ payment_status: "released" }).eq("stripe_session_id", sessionId).eq("payment_status", "authorized");
  await ensurePaymentRowsForSession(session, client);
  return ids;
};

/** Coach answers a request: accept (and charge once the hold settles) or decline. */
const handleRequestResponse = async (req: Request, body: any, client: SupabaseClient, stripe: () => Stripe) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) return jsonResponse({ error: "Authentication required" }, 401);

  if (body.action === "request_sweep") {
    // Holds whose requests all expired or were answered elsewhere.
    const { data: profile } = await client.from("user_profiles" as any).select("coach_id").eq("id", userData.user.id).maybeSingle();
    const coachId = (profile as any)?.coach_id;
    if (!coachId) return jsonResponse({ settled: 0 });
    const { data: held } = await client
      .from("coach_slot_bookings" as any)
      .select("stripe_session_id")
      .eq("coach_id", coachId)
      .eq("payment_status", "authorized")
      .neq("status", "requested")
      .limit(20);
    const sessions = [...new Set(((held ?? []) as any[]).map((r) => r.stripe_session_id).filter(Boolean))];
    let settled = 0;
    for (const id of sessions) {
      const charged = await settleRequestHold(id, client, stripe()).catch((e: unknown) => {
        console.error("Settle failed", id, e);
        return [] as string[];
      });
      if (charged.length) {
        settled++;
        await callReconcileEndpointForBookings(charged);
        await callNotificationEndpointForBookings(charged);
        await callPayoutTransfersForBookings(charged);
      }
    }
    return jsonResponse({ settled });
  }

  const bookingId = String(body.booking_id ?? "");
  const accept = Boolean(body.accept);
  const { data: result, error } = await userClient.rpc("respond_to_booking_request", { p_booking_id: bookingId, p_accept: accept });
  if (error) return jsonResponse({ error: error.message }, 400);

  const { data: booking } = await client
    .from("coach_slot_bookings" as any)
    .select("id, payment_status, stripe_session_id")
    .eq("id", bookingId)
    .maybeSingle();
  const held = (booking as any)?.payment_status === "authorized" && (booking as any)?.stripe_session_id;
  if (!held) return jsonResponse({ status: result });

  if (accept) {
    await client.from("coach_slot_bookings" as any).update({ status: "booked", updated_at: new Date().toISOString() }).eq("id", bookingId);
  }
  try {
    const charged = await settleRequestHold((booking as any).stripe_session_id, client, stripe());
    if (charged.length) {
      await callReconcileEndpointForBookings(charged);
      await callNotificationEndpointForBookings(charged);
      await callPayoutTransfersForBookings(charged);
    }
    return jsonResponse({ status: accept ? "booked" : "canceled", charged: charged.includes(bookingId) });
  } catch (e) {
    console.error("Charging the request failed", e);
    // The booking is accepted; the charge can be retried by the sweep.
    return jsonResponse({ status: accept ? "booked" : "canceled", charged: false, error: "The card couldn't be charged yet. We'll try again." });
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
  // Card holds for requests (ATH-85) are captured only when the coach accepts.
  if (session.metadata?.request === "1") {
    return { paid: false, newlyPaid: false, bookingIds: [] as string[] };
  }
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

const SESSION_TIME_ZONE = "America/New_York";
// Statuses that hold a spot. "requested" = waiting for the coach to confirm (ATH-49).
const ACTIVE_BOOKING_STATUSES = ["requested", "pending_payment", "booked", "completed"];

const BOOKING_GRACE_MS = 10 * 60 * 1000;

const readZonedParts = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";
  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    hour: Number(value("hour")) % 24,
    minute: Number(value("minute")),
    second: Number(value("second")),
  };
};

const zonedWallTimeToUtc = (isoDate: string, time: string): Date | null => {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return null;
  const [hourRaw = "0", minuteRaw = "0", secondRaw = "0"] = time.split(":");
  const hour = Number.parseInt(hourRaw, 10) || 0;
  const minute = Number.parseInt(minuteRaw, 10) || 0;
  const second = Number.parseInt(secondRaw, 10) || 0;
  const desiredUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let instant = desiredUtc;
  for (let pass = 0; pass < 2; pass += 1) {
    const zoned = readZonedParts(new Date(instant), SESSION_TIME_ZONE);
    const zonedAsUtc = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second,
    );
    instant = desiredUtc - (zonedAsUtc - instant);
  }
  return new Date(instant);
};

const isBookingWindowClosed = (
  isoDate?: string | null,
  startTime?: string | null,
  now = new Date(),
) => {
  if (!isoDate || !startTime) return false;
  const start = zonedWallTimeToUtc(isoDate, startTime);
  if (!start) return false;
  return now.getTime() > start.getTime() + BOOKING_GRACE_MS;
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const resolveCoachOccurrence = async (
  client: SupabaseClient,
  coachId: string,
  slotId: string,
  sessionDate: string | null,
) => {
  if (!slotId) return null;
  const columns =
    "id, availability_id, weekly_slot_id, coach_id, occurrence_date, session_name, price, start_time";
  const { data: byId } = await client
    .from("coach_availability_slot_occurrences" as any)
    .select(columns)
    .eq("id", slotId)
    .maybeSingle();
  if (byId?.coach_id === coachId) return byId;
  if (!sessionDate) return null;
  const { data: bySlot } = await client
    .from("coach_availability_slot_occurrences" as any)
    .select(columns)
    .eq("weekly_slot_id", slotId)
    .eq("occurrence_date", sessionDate)
    .eq("coach_id", coachId)
    .maybeSingle();
  return bySlot ?? null;
};

const handleWalkIn = async (req: Request, body: any, client: SupabaseClient) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Authentication required" }, 401);
  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: authError } = await client.auth.getUser(token);
  if (authError || !userData.user) return jsonResponse({ error: "Invalid authentication token" }, 401);

  const { data: profile, error: profileError } = await client
    .from("user_profiles" as any)
    .select("coach_id")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  const coachId = profile?.coach_id as string | null;
  if (!coachId) return jsonResponse({ error: "Only a coach can add an athlete to a session." }, 403);

  if (body.action === "walk_in_search") {
    const query = String(body.query ?? "").trim();
    if (query.length < 2) return jsonResponse({ athletes: [] });
    const safe = query.replace(/[%_,]/g, "").slice(0, 80);
    const pattern = `%${safe}%`;

    const { data: byName, error: nameError } = await client
      .from("athlete_profiles" as any)
      .select("id, full_name, user_id")
      .ilike("full_name", pattern)
      .limit(8);
    if (nameError) throw nameError;

    const { data: byEmail, error: emailError } = await client
      .from("user_profiles" as any)
      .select("athlete_id, email, name")
      .ilike("email", pattern)
      .not("athlete_id", "is", null)
      .limit(8);
    if (emailError) throw emailError;

    const userIds = (byName || []).map((row: any) => row.user_id).filter(Boolean);
    const emailsByUser = new Map<string, string>();
    if (userIds.length) {
      const { data: emails } = await client
        .from("user_profiles" as any)
        .select("id, email")
        .in("id", userIds);
      (emails || []).forEach((row: any) => emailsByUser.set(row.id, row.email));
    }

    const athletes = new Map<string, { id: string; name: string; email: string | null }>();
    for (const row of byName || []) {
      athletes.set(row.id, {
        id: row.id,
        name: row.full_name,
        email: emailsByUser.get(row.user_id) ?? null,
      });
    }

    const emailAthleteIds = (byEmail || []).map((row: any) => row.athlete_id).filter(Boolean);
    const { data: emailProfiles } = emailAthleteIds.length
      ? await client.from("athlete_profiles" as any).select("id, full_name").in("id", emailAthleteIds)
      : { data: [] };
    const names = new Map((emailProfiles || []).map((row: any) => [row.id, row.full_name]));
    for (const row of byEmail || []) {
      if (!row.athlete_id) continue;
      const current = athletes.get(row.athlete_id);
      athletes.set(row.athlete_id, {
        id: row.athlete_id,
        name: current?.name || names.get(row.athlete_id) || row.name || "Athlete",
        email: row.email ?? current?.email ?? null,
      });
    }

    return jsonResponse({ athletes: [...athletes.values()].slice(0, 8) });
  }

  const slotId = typeof body.slot_id === "string" ? body.slot_id : "";
  const sessionDate = typeof body.session_date === "string" ? body.session_date : null;
  const occurrence = await resolveCoachOccurrence(client, coachId, slotId, sessionDate);
  if (!occurrence) return jsonResponse({ error: "Session not found." }, 404);

  if (body.action === "walk_in_list") {
    const { data: bookings, error } = await client
      .from("coach_slot_bookings" as any)
      .select("id, athlete_id, status, payment_status")
      .eq("occurrence_id", occurrence.id)
      .in("status", ACTIVE_BOOKING_STATUSES);
    if (error) throw error;
    const athleteIds = (bookings || []).map((row: any) => row.athlete_id).filter(Boolean);
    const { data: profiles } = athleteIds.length
      ? await client.from("athlete_profiles" as any).select("id, full_name").in("id", athleteIds)
      : { data: [] };
    const names = new Map((profiles || []).map((row: any) => [row.id, row.full_name]));
    return jsonResponse({
      athletes: (bookings || []).map((row: any) => ({
        id: row.athlete_id,
        name: names.get(row.athlete_id) || "Athlete",
        bookingId: row.id,
        requiresPayment: row.status === "pending_payment" || row.status === "requested",
      })),
    });
  }

  if (body.action !== "walk_in_add") return jsonResponse({ error: "Unknown action." }, 400);

  const athleteId = typeof body.athlete_id === "string" ? body.athlete_id.trim() : "";
  if (!athleteId) return jsonResponse({ error: "Choose an athlete with an AthaNext account." }, 400);

  const { data: athlete, error: athleteError } = await client
    .from("athlete_profiles" as any)
    .select("id, full_name")
    .eq("id", athleteId)
    .maybeSingle();
  if (athleteError) throw athleteError;
  if (!athlete) {
    return jsonResponse({ error: "This person needs an AthaNext account before they can be added." }, 404);
  }

  const { data: existing, error: existingError } = await client
    .from("coach_slot_bookings" as any)
    .select("id, status")
    .eq("occurrence_id", occurrence.id)
    .eq("athlete_id", athleteId)
    .in("status", ACTIVE_BOOKING_STATUSES)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.status === "requested") {
    // Adding a walk-in for an athlete with an open request counts as the coach accepting it (ATH-49).
    const paid = Number(occurrence.price || 0) <= 0;
    const { error: acceptError } = await client
      .from("coach_slot_bookings" as any)
      .update({
        status: paid ? "booked" : "pending_payment",
        payment_status: paid ? "paid" : "unpaid",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (acceptError) throw acceptError;
    return jsonResponse({
      bookingId: existing.id,
      athlete: { id: athlete.id, name: athlete.full_name },
      requiresPayment: !paid,
      alreadyAdded: true,
    });
  }
  if (existing) {
    return jsonResponse({
      bookingId: existing.id,
      athlete: { id: athlete.id, name: athlete.full_name },
      requiresPayment: existing.status === "pending_payment",
      alreadyAdded: true,
    });
  }

  const requiresPayment = Number(occurrence.price || 0) > 0;
  const { data: inserted, error: insertError } = await client
    .from("coach_slot_bookings" as any)
    .insert({
      occurrence_id: occurrence.id,
      weekly_slot_id: occurrence.weekly_slot_id,
      availability_id: occurrence.availability_id,
      coach_id: occurrence.coach_id,
      athlete_id: athleteId,
      status: requiresPayment ? "pending_payment" : "booked",
      payment_status: requiresPayment ? "unpaid" : "paid",
      notes: "Added by coach after arrival",
      created_by: userData.user.id,
    })
    .select("id")
    .single();
  if (insertError) throw insertError;

  return jsonResponse({
    bookingId: inserted.id,
    athlete: { id: athlete.id, name: athlete.full_name },
    requiresPayment,
    alreadyAdded: false,
  });
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );

  try {
    const rawBody = await req.text();
    const stripeSignature = req.headers.get("stripe-signature");
    const parsedBody = rawBody && !stripeSignature ? JSON.parse(rawBody) : {};

    if (typeof parsedBody.action === "string" && parsedBody.action.startsWith("walk_in_")) {
      return await handleWalkIn(req, parsedBody, supabaseClient);
    }

    // Created on first use, so booking only checkouts (ATH-86) work without a Stripe key.
    let stripeClient: Stripe | null = null;
    const stripeApi = () =>
      (stripeClient ??= new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2025-08-27.basil",
      }));

    if (parsedBody.action === "respond_request" || parsedBody.action === "request_sweep") {
      return await handleRequestResponse(req, parsedBody, supabaseClient, stripeApi);
    }

    if (req.method === "GET") {
      const url = new URL(req.url);
      const sessionId = url.searchParams.get("session_id");
      if (!sessionId) {
        return new Response(JSON.stringify({ error: "session_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const session = await stripeApi().checkout.sessions.retrieve(sessionId, {
        expand: ["payment_intent"],
      });

      // A request's card hold (ATH-85): create the request now; nothing is charged yet.
      if (session.metadata?.request === "1") {
        const { full } = await createRequestFromSession(session, supabaseClient, stripeApi());
        return new Response(
          JSON.stringify({ session_id: sessionId, requested: true, held: session.status === "complete" && !full, full }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
        );
      }

      const { paid, newlyPaid, bookingIds } = await updateBookingPaymentStatus(session, supabaseClient);

      if (paid && newlyPaid) {
        await callReconcileEndpointForBookings(bookingIds);
        await callNotificationEndpointForBookings(bookingIds);
        await callPayoutTransfersForBookings(bookingIds);
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
        event = stripeApi().webhooks.constructEvent(rawBody, stripeSignature, webhookSecret);
      } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.metadata?.request === "1") {
          await createRequestFromSession(session, supabaseClient, stripeApi());
          return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }

        // Coach invoices (ATH-89) use the same Stripe account; coach-invoices settles them.
        if (session.metadata?.kind === "invoice" && session.metadata?.invoice_id) {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/coach-invoices`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
            body: JSON.stringify({ action: "settle", invoice_id: session.metadata.invoice_id }),
          }).catch((e) => console.error("Invoice settle call error:", e));
          return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }

        if (isSessionPaid(session)) {
          try {
            const { paid, newlyPaid, bookingIds } = await updateBookingPaymentStatus(session, supabaseClient);

            if (paid && newlyPaid) {
              await callReconcileEndpointForBookings(bookingIds);
              await callNotificationEndpointForBookings(bookingIds);
              await callPayoutTransfersForBookings(bookingIds);
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

      const session = await stripeApi().checkout.sessions.retrieve(sessionId, {
        expand: ["payment_intent"],
      });

      // A request's card hold (ATH-85): create the request now; nothing is charged yet.
      if (session.metadata?.request === "1") {
        const { full } = await createRequestFromSession(session, supabaseClient, stripeApi());
        return new Response(
          JSON.stringify({ session_id: sessionId, requested: true, held: session.status === "complete" && !full, full }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
        );
      }

      const { paid, newlyPaid, bookingIds } = await updateBookingPaymentStatus(session, supabaseClient);

      if (paid && newlyPaid) {
        await callReconcileEndpointForBookings(bookingIds);
        await callNotificationEndpointForBookings(bookingIds);
        await callPayoutTransfersForBookings(bookingIds);
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
        "id, availability_id, weekly_slot_id, coach_id, occurrence_date, session_name, price, duration_minutes, start_time, end_time, session_type, location, max_bookings_per_slot, is_enabled, is_draft, visibility, offered_to",
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
      .in("status", ACTIVE_BOOKING_STATUSES);
    if (bookingsErr) throw bookingsErr;

    const bookingsByOccurrence = new Map<string, any[]>();
    (existingBookings || []).forEach((row) => {
      const list = bookingsByOccurrence.get(row.occurrence_id) || [];
      list.push(row);
      bookingsByOccurrence.set(row.occurrence_id, list);
    });

    for (const occ of occurrences) {
      if (!occ.is_enabled || occ.is_draft) {
        throw new Error("This session isn't available to book.");
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
    if (myBookings.some((b) => b.status === "requested")) {
      throw new Error("You already requested this session. The coach will confirm it soon.");
    }

    const myPendingBookings = myBookings.filter((b) => b.status === "pending_payment");
    const pendingOccSet = new Set(myPendingBookings.map((b) => b.occurrence_id));
    const coversAllPending = myPendingBookings.length > 0
      && occurrenceIds.every((id) => pendingOccSet.has(id))
      && pendingOccSet.size === occurrenceIds.length;
    let reusingPendingBookings = false;

    if (!coversAllPending) {
      const closed = occurrences.find((occ) =>
        isBookingWindowClosed(occ.occurrence_date, occ.start_time)
      );
      if (closed) {
        throw new Error(
          "This session can no longer be booked. Booking stays open until 10 minutes after the start time (Eastern).",
        );
      }
    }

    const { platformFeePerc: basePlatformFeePerc, stripeFeePerc } = await fetchFeePercents(supabaseClient);

    // Platform fee waiver: confirmed offline coach-client relationship for this
    // exact (coach, athlete) pair. This client is service-role (RLS bypassed);
    // the query is scoped by the explicit filters. A query error falls through
    // to the full fee (fails safe toward charging, never toward a discount).
    // athlete_id comes from the request body, so only waive when it is the
    // caller's own athlete profile; otherwise anyone could borrow a confirmed
    // pair's waiver by sending that athlete's id.
    const { data: ownProfile } = await supabaseClient
      .from("user_profiles" as any)
      .select("athlete_id")
      .eq("id", user.id)
      .maybeSingle();
    const { data: ownAthleteRows } = await supabaseClient
      .from("athlete_profiles" as any)
      .select("id")
      .eq("id", athleteId)
      .eq("user_id", user.id)
      .limit(1);
    const callerOwnsAthlete =
      (ownProfile as { athlete_id?: string | null } | null)?.athlete_id === athleteId ||
      Boolean(ownAthleteRows?.length);
    // limit(1) rather than maybeSingle(): a duplicate row must not error into the full fee.
    const { data: waiverRows } = callerOwnsAthlete
      ? await supabaseClient
          .from("coach_client_referrals" as any)
          .select("id")
          .eq("coach_id", coachId)
          .eq("athlete_id", athleteId)
          .eq("status", "confirmed")
          .limit(1)
      : { data: [] };
    const platformFeePerc = waiverRows?.length ? 0 : basePlatformFeePerc;
    const feeFactor = 1 + platformFeePerc / 100 + stripeFeePerc / 100;

    const totalBase = occurrences.reduce((sum, occ) => sum + Number(occ.price || 0), 0);
    const totalWithFees = Number((totalBase * feeFactor).toFixed(2));
    const amountInCents = Math.round(totalWithFees * 100);
    if (amountInCents <= 0) {
      throw new Error("Total amount must be greater than zero");
    }

    // A family already trains with the coach when they have a booked or completed session,
    // or a confirmed referral (ATH-71). Only those families can book "clients" sessions,
    // and they always book instantly.
    const { count: pastSessions } = await supabaseClient
      .from("coach_slot_bookings" as any)
      .select("id", { count: "exact", head: true })
      .eq("coach_id", coachId)
      .eq("athlete_id", athleteId)
      .in("status", ["booked", "completed"]);
    const { data: confirmedReferral } = await supabaseClient
      .from("coach_client_referrals" as any)
      .select("id")
      .eq("coach_id", coachId)
      .eq("athlete_id", athleteId)
      .eq("status", "confirmed")
      .limit(1);
    const isClient = Boolean(pastSessions) || Boolean(confirmedReferral?.length);

    if (!isClient && occurrences.some((occ) => occ.visibility === "clients")) {
      throw new Error("This session is only open to the coach's current athletes.");
    }

    // New families request instead of booking when the coach asks for that (ATH-49, ATH-71).
    // The request is held 24 hours. With in-app payment the card is held first and charged
    // when the coach accepts (ATH-85).
    // A session the coach offered to this athlete by name (a suggested time, ATH-85) is the
    // coach's own choice, so it books straight away.
    const offeredToMe = occurrences.every(
      (occ) => occ.visibility === "offered" && ((occ as { offered_to?: string[] }).offered_to ?? []).includes(athleteId),
    );
    if (!coversAllPending && !isClient && !offeredToMe) {
      const { data: coachSettings } = await supabaseClient
        .from("coaches" as any)
        .select("new_family_booking, pay_mode")
        .eq("id", coachId)
        .maybeSingle();
      const settings = coachSettings as { new_family_booking?: string; pay_mode?: string } | null;
      if (settings?.new_family_booking === "request") {
        if (myPendingBookings.length) {
          throw new Error("You already have a pending booking for this session. Please complete payment for it before creating a new one.");
        }
        // Booking only coaches: the request is sent now and the family pays the coach directly.
        if (settings.pay_mode === "self") {
          const { data: requestRows, error: requestErr } = await supabaseClient
            .from("coach_slot_bookings" as any)
            .insert(occurrences.map((occ) => ({
              occurrence_id: occ.id,
              weekly_slot_id: occ.weekly_slot_id,
              availability_id: occ.availability_id,
              coach_id: occ.coach_id,
              athlete_id: athleteId,
              status: "requested",
              payment_status: "unpaid",
              notes: notes || null,
              created_by: user.id,
            })))
            .select("id");
          if (requestErr) throw requestErr;
          return new Response(
            JSON.stringify({ requested: true, booking_ids: (requestRows || []).map((row: any) => row.id) }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
          );
        }

        // In-app payment (ATH-85): the family's card is held on Stripe's page and charged only
        // if the coach accepts. The request itself is created once the card is held.
        const holdSession = await stripeApi().checkout.sessions.create({
          customer_email: user.email || undefined,
          payment_method_types: ["card"],
          mode: "payment",
          line_items: occurrences.map((occ) => ({
            price_data: {
              currency: "usd",
              unit_amount: Math.round(Number(occ.price || 0) * feeFactor * 100),
              product_data: {
                name: occ.session_name || "Coaching Session",
                description: `${occ.session_type || "session"} on ${occ.occurrence_date}. Charged only if the coach accepts.`,
              },
            },
            quantity: 1,
          })),
          payment_intent_data: {
            capture_method: "manual",
            ...(user.email ? { receipt_email: user.email } : {}),
            metadata: { request: "1", coach_id: coachId },
          },
          success_url: `${req.headers.get("origin")}/booking-confirmation?request=1&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${req.headers.get("origin")}/coach/${coachId}`,
          metadata: {
            request: "1",
            occurrence_ids: occurrenceIds.join(","),
            coach_id: coachId,
            athlete_id: athleteId,
            user_id: user.id,
            notes: String(notes || "").slice(0, 450),
            platform_fee_perc: platformFeePerc.toString(),
            stripe_fee_perc: stripeFeePerc.toString(),
          },
        });
        return new Response(
          JSON.stringify({ url: holdSession.url, session_id: holdSession.id, request: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
        );
      }
    }

    // Booking only coaches (ATH-86): confirm now and let the family pay the coach directly.
    // Nothing goes to Stripe. Unpaid bookings already waiting (an accepted request from
    // before the coach switched) are confirmed the same way.
    const { data: payRow } = await supabaseClient
      .from("coaches" as any)
      .select("pay_mode")
      .eq("id", coachId)
      .maybeSingle();
    if ((payRow as { pay_mode?: string } | null)?.pay_mode === "self") {
      let directIds: string[] = [];
      if (coversAllPending) {
        const { error: confirmErr } = await supabaseClient
          .from("coach_slot_bookings" as any)
          .update({ status: "booked", payment_status: "direct", updated_at: new Date().toISOString() })
          .in("id", myPendingBookings.map((b) => b.id));
        if (confirmErr) throw confirmErr;
        directIds = myPendingBookings.map((b) => b.id);
      } else {
        if (myPendingBookings.length) {
          throw new Error("You already have a pending booking for this session.");
        }
        const { data: directRows, error: directErr } = await supabaseClient
          .from("coach_slot_bookings" as any)
          .insert(occurrences.map((occ) => ({
            occurrence_id: occ.id,
            weekly_slot_id: occ.weekly_slot_id,
            availability_id: occ.availability_id,
            coach_id: occ.coach_id,
            athlete_id: athleteId,
            status: "booked",
            payment_status: "direct",
            notes: notes || null,
            created_by: user.id,
          })))
          .select("id");
        if (directErr) throw directErr;
        directIds = (directRows || []).map((row: any) => row.id);
      }
      return new Response(
        JSON.stringify({ direct: true, booking_ids: directIds }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
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
      const customers = await stripeApi().customers.list({ email: user.email, limit: 1 });
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
      session = await stripeApi().checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email || undefined,
        payment_method_types: ["card"],
        line_items,
        mode: "payment",
        // Stripe emails the receipt (ATH-91). The card is never saved for later.
        payment_intent_data: user.email ? { receipt_email: user.email } : undefined,
        success_url: `${req.headers.get("origin")}/booking-confirmation?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.get("origin")}/coach/${coachId}`,
        metadata: {
          occurrence_ids: occurrenceIds.join(","),
          booking_ids: bookingIds.join(","),
          coach_id: coachId,
          availability_id: availabilityId ?? "",
          weekly_slot_id: weeklySlotId ?? "",
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
