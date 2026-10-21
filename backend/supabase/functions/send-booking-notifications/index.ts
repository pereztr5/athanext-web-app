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
        "id, payment_status, coach_id, athlete_id, occurrence_id, coach:coaches(id, name, email, user_id), athlete:athlete_profiles(id, full_name, user_id), occurrence:coach_availability_slot_occurrences(occurrence_date, start_time, session_name, price, location)",
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
    const video = row.occurrence?.location === "online";
    let meetingUrl = "";
    if (video && row.coach_id) {
      const { data: link } = await admin.from("coach_meeting_links").select("meeting_url").eq("coach_id", row.coach_id).maybeSingle();
      meetingUrl = typeof link?.meeting_url === "string" ? link.meeting_url : "";
    }
    const videoHtml = (audience: "coach" | "family") => {
      if (!video) return "";
      if (meetingUrl) return `<p>Video call: <a href="${escapeHtml(meetingUrl)}">${escapeHtml(meetingUrl)}</a></p>`;
      return audience === "coach"
        ? `<p>This is a video call. Add your Zoom, Meet or Teams link in Schedule settings so the family can join.</p>`
        : `<p>This is a video call. The join link shows on the session page once your coach adds it.</p>`;
    };
    // Gmail SMTP only delivers from the configured mailbox. Reply-To is support@ so families
    // reach AthaNext even while the visible From is still that mailbox.
    const replyTo = "support@athanext.com";

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
        body: JSON.stringify({ to, from, replyTo, subject, html }),
      }).catch((e) => {
        console.error("send-email failed", e);
        return null;
      });
      return Boolean(res?.ok);
    };

    // Account settings > Notifications: "<kind>_email": false turns this email off (missing = on).
    const emailOn = async (uid: string | null | undefined) => {
      if (!uid) return true;
      const { data } = await admin.from("user_profiles").select("notification_prefs").eq("id", uid).maybeSingle();
      const prefs = (data?.notification_prefs ?? {}) as Record<string, unknown>;
      return prefs.booking_email !== false;
    };
    const receiptsOn = async (uid: string | null | undefined) => {
      if (!uid) return true;
      const { data } = await admin.from("user_profiles").select("notification_prefs").eq("id", uid).maybeSingle();
      return ((data?.notification_prefs ?? {}) as Record<string, unknown>).receipts_email !== false;
    };

    const results = { coach: false, family: false };

    if (coachEmail && (await emailOn(row.coach?.user_id as string | null))) {
      results.coach = await send(
        coachEmail,
        `Booked: ${athleteName} · ${sessionName}`,
        `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
          <h2 style="color:#0054B4;">New booking</h2>
          <p><strong>${escapeHtml(athleteName)}</strong> booked <strong>${escapeHtml(sessionName)}</strong> on ${escapeHtml(when)}.</p>
          ${videoHtml("coach")}
          <p>Amount: ${usd(price)} (your share is paid after the session, on your weekly payout day).</p>
        </div>`,
      );
    }

    if (familyEmail && (await emailOn(userId))) {
      results.family = await send(
        familyEmail,
        `Confirmed with ${coachName}`,
        `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
          <h2 style="color:#0054B4;">You're booked</h2>
          <p>Hi,</p>
          <p>Your session with <strong>${escapeHtml(coachName)}</strong> is confirmed: <strong>${escapeHtml(sessionName)}</strong> on ${escapeHtml(when)}.</p>
          ${videoHtml("family")}
          <p>Paid: ${usd(price)}. Cancel with enough notice and it comes back as a session credit.</p>
        </div>`,
      );
    }

    // Second guardians with "copy receipts" on get the same confirmation (Account settings).
    let guardians = 0;
    if (row.athlete?.id && (await receiptsOn(userId))) {
      const { data: gs } = await admin
        .from("athlete_guardians")
        .select("email")
        .eq("athlete_id", row.athlete.id)
        .eq("copy_receipts", true);
      for (const g of gs ?? []) {
        const ok = await send(
          g.email as string,
          `Confirmed with ${coachName} for ${athleteName.split(" ")[0]}`,
          `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
            <h2 style="color:#0054B4;">${escapeHtml(athleteName.split(" ")[0])} is booked</h2>
            <p>${escapeHtml(sessionName)} with <strong>${escapeHtml(coachName)}</strong> on ${escapeHtml(when)}. Paid: ${usd(price)}.</p>
            ${videoHtml("family")}
            <p style="color:#686B72;font-size:13px;">You get this copy as a guardian on the family's AthaNext account.</p>
          </div>`,
        );
        if (ok) guardians += 1;
      }
    }

    return json({ ok: true, emailed: { ...results, guardians } });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});
