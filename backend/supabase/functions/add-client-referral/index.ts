import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const inviteEmailHtml = (coachName: string, link: string) => `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
    <h2 style="color:#0054B4;">${coachName} added you as a client on AthaNext</h2>
    <p>${coachName} manages their sessions on AthaNext. As an existing client,
    you book with them with <strong>no platform service fee</strong>.</p>
    <p><a href="${link}" style="background:#0054B4;color:#fff;padding:12px 20px;
    border-radius:6px;text-decoration:none;">Create your account</a></p>
  </div>`;

const notifyEmailHtml = (coachName: string, link: string) => `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
    <h2 style="color:#0054B4;">${coachName} added you as an existing client</h2>
    <p>Confirm the relationship to remove the platform service fee from your
    bookings with ${coachName}.</p>
    <p><a href="${link}" style="background:#0054B4;color:#fff;padding:12px 20px;
    border-radius:6px;text-decoration:none;">Review in My Coaches</a></p>
  </div>`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const service = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json();
    const rawEmails: unknown = body?.client_emails;
    if (!Array.isArray(rawEmails) || rawEmails.length === 0) {
      return json({ error: "client_emails must be a non-empty array" }, 400);
    }
    const emails = [...new Set(
      rawEmails
        .filter((e): e is string => typeof e === "string")
        .map((e) => e.trim().toLowerCase())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
    )].slice(0, 50); // ponytail: hard cap, no pagination; raise if coaches complain

    // Resolve acting coach: admin may act on any coach_id, coaches only on their own.
    let coachId: string | null = null;
    let adminCreated = false;
    if (typeof body?.coach_id === "string" && body.coach_id) {
      const { data: isAdmin } = await service.rpc("has_role", {
        _role: "admin",
        _user_id: user.id,
      });
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      coachId = body.coach_id;
      adminCreated = true;
    } else {
      const { data: profile } = await service
        .from("user_profiles")
        .select("coach_id")
        .eq("id", user.id)
        .maybeSingle();
      coachId = profile?.coach_id ?? null;
    }
    if (!coachId) return json({ error: "Caller has no coach profile" }, 403);

    const { data: coachRow } = await service
      .from("coaches")
      .select("name")
      .eq("id", coachId)
      .maybeSingle();
    const coachName = coachRow?.name ?? "Your coach";

    const { data: cfgRows } = await service
      .from("configurations")
      .select("key,value")
      .in("key", ["smtp_email"]);
    const fromEmail = cfgRows?.find((r: { key: string }) => r.key === "smtp_email")?.value;
    const origin = req.headers.get("origin") ?? "https://athanext.com";

    const results: Array<{ email: string; status: string }> = [];
    for (const email of emails) {
      const { data: existing } = await service
        .from("coach_client_referrals")
        .select("id")
        .eq("coach_id", coachId)
        .eq("client_email", email)
        .maybeSingle();
      if (existing) {
        results.push({ email, status: "already_exists" });
        continue;
      }

      const { data: targetProfile } = await service
        .from("user_profiles")
        .select("athlete_id")
        .eq("email", email)
        .maybeSingle();
      const athleteId = targetProfile?.athlete_id ?? null;

      const status = adminCreated
        ? "confirmed"
        : athleteId
          ? "pending_confirmation"
          : "invited";

      const { data: inserted, error: insertError } = await service
        .from("coach_client_referrals")
        .insert({
          coach_id: coachId,
          client_email: email,
          athlete_id: athleteId,
          initiated_by: adminCreated ? "admin" : "coach",
          status,
          confirmed_at: adminCreated ? new Date().toISOString() : null,
        })
        .select("invite_token")
        .single();
      if (insertError || !inserted) {
        results.push({ email, status: "error" });
        continue;
      }

      if (fromEmail && (!adminCreated || !athleteId)) {
        const link = athleteId
          ? `${origin}/my-coaches`
          : `${origin}/auth?mode=signup&persona=athlete&invite=${inserted.invite_token}`;
        const html = athleteId
          ? notifyEmailHtml(coachName, link)
          : inviteEmailHtml(coachName, link);
        // Fire-and-forget via the deployed send-email function (same pattern as
        // create-booking-payment -> reconcile-stripe-fees).
        fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            to: email,
            from: fromEmail,
            subject: `${coachName} added you as a client on AthaNext`,
            html,
          }),
        }).catch((e) => console.error("send-email failed", e));
      }
      results.push({ email, status });
    }

    return json({ results });
  } catch (e) {
    console.error(e);
    return json({ error: "Internal error" }, 500);
  }
});
