// Emails coach and family after a booking is paid. Called by create-booking-payment
// with the service role and { booking_id }.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const usd = (n: number) => `$${Number(n).toFixed(2).replace(/\.00$/, "")}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!serviceRole || bearer !== serviceRole) return json({ error: "Unauthorized" }, 401);

    const body = (await req.json().catch(() => ({}))) as { booking_id?: string };
    const bookingId = typeof body.booking_id === "string" ? body.booking_id : "";
    if (!bookingId) return json({ error: "booking_id required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceRole);
    const { data: booking, error } = await admin
      .from("coach_slot_bookings")
      .select(
        "id, payment_status, coach_id, athlete_id, occurrence_id, coach:coaches(id, name, email), athlete:athlete_profiles(id, full_name, user_id), occurrence:coach_availability_slot_occurrences(occurrence_date, start_time, session_name, price)",
      )
      .eq("id", bookingId)
      .maybeSingle();
    if (error || !booking) return json({ error: error?.message ?? "Booking not found" }, 404);

    const { data: cfg } = await admin.from("configurations").select("value").eq("key", "smtp_email").maybeSingle();
    const from = (cfg?.value as string | undefined) ?? "";
    if (!from) return json({ error: "smtp_email not configured", emailed: false }, 200);

    // deno-lint-ignore no-explicit-any
    const row = booking as any;
    const coachName = (row.coach?.name as string) ?? "Your coach";
    const coachEmail = (row.coach?.email as string | null) ?? null;
    const athleteName = (row.athlete?.full_name as string) ?? "Athlete";
    const when = row.occurrence?.occurrence_date
      ? `${row.occurrence.occurrence_date} at ${String(row.occurrence.start_time ?? "").slice(0, 5)}`
      : "your session";
    const sessionName = (row.occurrence?.session_name as string) ?? "Session";
    const price = Number(row.occurrence?.price ?? 0);

    let familyEmail: string | null = null;
    const userId = row.athlete?.user_id as string | null;
    if (userId) {
      const { data: userRes } = await admin.auth.admin.getUserById(userId);
      familyEmail = userRes?.user?.email ?? null;
    }

    const send = async (to: string, subject: string, html: string) => {
      const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRole}`,
        },
        body: JSON.stringify({ to, from, subject, html }),
      }).catch((e) => {
        console.error("send-email failed", e);
        return null;
      });
      return Boolean(res?.ok);
    };

    const results = { coach: false, family: false };

    if (coachEmail) {
      results.coach = await send(
        coachEmail,
        `Booked: ${athleteName} · ${sessionName}`,
        `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
          <h2 style="color:#0054B4;">New booking</h2>
          <p><strong>${escapeHtml(athleteName)}</strong> booked <strong>${escapeHtml(sessionName)}</strong> on ${escapeHtml(when)}.</p>
          <p>Amount: ${usd(price)} (your share is paid after the session, on your weekly payout day).</p>
        </div>`,
      );
    }

    if (familyEmail) {
      results.family = await send(
        familyEmail,
        `Confirmed with ${coachName}`,
        `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
          <h2 style="color:#0054B4;">You're booked</h2>
          <p>Hi,</p>
          <p>Your session with <strong>${escapeHtml(coachName)}</strong> is confirmed: <strong>${escapeHtml(sessionName)}</strong> on ${escapeHtml(when)}.</p>
          <p>Paid: ${usd(price)}. Cancel with enough notice and it comes back as a session credit.</p>
        </div>`,
      );
    }

    return json({ ok: true, emailed: results });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});
