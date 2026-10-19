// Second guardian: email the person a family added in Account settings. The row itself is
// inserted by the client under RLS (only the athlete's own account can); this checks the caller
// owns it again, sends one email and stamps emailed_at.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const auth = req.headers.get("Authorization") ?? "";
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: auth } } });
    const { data: userRes } = await caller.auth.getUser();
    const me = userRes?.user;
    if (!me) return json({ error: "Sign in first" }, 401);

    const { guardian_id } = (await req.json().catch(() => ({}))) as { guardian_id?: string };
    if (typeof guardian_id !== "string" || !guardian_id) return json({ error: "guardian_id required" }, 400);

    const admin = createClient(url, serviceRole);
    const { data: row } = await admin
      .from("athlete_guardians")
      .select("id, name, email, relationship, athlete:athlete_profiles(id, full_name, user_id)")
      .eq("id", guardian_id)
      .maybeSingle();
    // deno-lint-ignore no-explicit-any
    const g = row as any;
    if (!g || g.athlete?.user_id !== me.id) return json({ error: "Not found" }, 404);

    const { data: holder } = await admin.from("user_profiles").select("name").eq("id", me.id).maybeSingle();
    const holderName = (holder?.name as string | null) || "The account holder";
    const athleteFirst = String(g.athlete?.full_name ?? "your athlete").split(" ")[0];

    const { data: cfg } = await admin.from("configurations").select("value").eq("key", "smtp_email").maybeSingle();
    const from = (cfg?.value as string | undefined) ?? "";
    if (!from) return json({ emailed: false, reason: "smtp_email not configured" });

    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1A202C;">
      <h2 style="color:#0054B4;">${escapeHtml(holderName)} added you as ${escapeHtml(athleteFirst)}'s ${escapeHtml(String(g.relationship).toLowerCase())}</h2>
      <p>Hi ${escapeHtml(String(g.name).split(" ")[0])},</p>
      <p>You'll get a copy of booking receipts for ${escapeHtml(athleteFirst)}'s AthaNext sessions. ${escapeHtml(holderName)} manages the account and can remove you at any time in Account settings.</p>
      <p style="color:#686B72;font-size:13px;">Not expecting this? You can ignore it, or reply to let us know.</p>
    </div>`;
    const res = await fetch(`${url}/functions/v1/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRole}` },
      body: JSON.stringify({ to: g.email, from, subject: `${holderName} added you on AthaNext`, html }),
    }).catch(() => null);
    const emailed = Boolean(res?.ok);
    if (emailed) await admin.from("athlete_guardians").update({ emailed_at: new Date().toISOString() }).eq("id", g.id);
    return json({ emailed });
  } catch (e) {
    console.error(e);
    return json({ error: "That didn't send. Try again" }, 500);
  }
});
