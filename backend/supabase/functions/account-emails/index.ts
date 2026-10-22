// Account settings emails: "deletion scheduled", "deletion cancelled" and "coach deactivated".
// The client calls this after its own update succeeds, with { event }. The email only goes to the
// caller's own sign-in email, and only when the account is really in that state, so it can't be
// used to send anything else.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { ACCOUNT_EMAIL_EVENTS, buildAccountEmail, type AccountEmailEvent } from "../_shared/account_emails.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: userRes } = await caller.auth.getUser();
    const me = userRes?.user;
    if (!me?.email) return json({ error: "Sign in first" }, 401);

    const { event } = (await req.json().catch(() => ({}))) as { event?: string };
    if (!ACCOUNT_EMAIL_EVENTS.includes(event as AccountEmailEvent)) return json({ error: "Unknown event" }, 400);

    const admin = createClient(url, serviceRole);
    const { data: profile } = await admin
      .from("user_profiles")
      .select("name, coach_id, deletion_requested_at")
      .eq("id", me.id)
      .maybeSingle();
    // deno-lint-ignore no-explicit-any
    const p = (profile ?? {}) as any;

    // Only send what matches the account's state right now.
    if (event === "deletion_requested" && !p.deletion_requested_at) return json({ emailed: false, reason: "not scheduled" });
    if (event === "deletion_cancelled" && p.deletion_requested_at) return json({ emailed: false, reason: "still scheduled" });
    let name = p.name as string | null;
    if (event === "coach_deactivated") {
      if (!p.coach_id) return json({ emailed: false, reason: "not a coach" });
      const { data: coach } = await admin.from("coaches").select("name, deactivated_at").eq("id", p.coach_id).maybeSingle();
      if (!coach?.deactivated_at) return json({ emailed: false, reason: "not deactivated" });
      name = (coach.name as string | null) || name;
    }

    const { data: cfg } = await admin.from("configurations").select("value").eq("key", "smtp_email").maybeSingle();
    const from = (cfg?.value as string | undefined) ?? "";
    if (!from) return json({ emailed: false, reason: "smtp_email not configured" });

    const { subject, html } = buildAccountEmail({
      event: event as AccountEmailEvent,
      name,
      requestedAt: p.deletion_requested_at,
      appOrigin: Deno.env.get("APP_ORIGIN") || "https://athanext.com",
    });
    const res = await fetch(`${url}/functions/v1/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRole}` },
      body: JSON.stringify({ to: me.email, from, subject, html }),
    }).catch(() => null);
    return json({ emailed: Boolean(res?.ok) });
  } catch (e) {
    console.error(e);
    return json({ error: "That didn't send" }, 500);
  }
});
