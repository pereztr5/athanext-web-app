// Organizations (ATH-90): invite a coach, resend an invite, or ask a coach to accept a new rate.
// The database functions check the caller owns the org; this only builds the link and emails it.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Links go to third parties, so only local dev and athanext.com hosts may set the origin.
const DEFAULT_SITE_URL = Deno.env.get("SITE_URL") ?? "https://athanext.com";
const resolveSiteUrl = (origin: string | null): string => {
  if (!origin) return DEFAULT_SITE_URL;
  try {
    const url = new URL(origin);
    const host = url.hostname;
    if (host === "localhost" || host === "127.0.0.1") return url.origin;
    if (host === "athanext.com" || host.endsWith(".athanext.com")) return url.origin;
  } catch {
    // fall through
  }
  return DEFAULT_SITE_URL;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const pct = (rate: number) => `${Number(Number(rate).toFixed(2))}%`;

const emailHtml = (kind: "join" | "rate", org: string, owner: string, rate: number, link: string) => `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
    <h2 style="color:#0054B4;">${
      kind === "join"
        ? `${escapeHtml(owner)} invited you to join ${escapeHtml(org)}`
        : `${escapeHtml(org)} asked to change your rate`
    }</h2>
    <p>${
      kind === "join"
        ? `Join ${escapeHtml(org)} on AthaNext. You keep your own profile, athletes and payouts.
           ${pct(rate)} of each paid session goes to ${escapeHtml(org)} and the rest is yours.`
        : `${escapeHtml(owner)} would like ${escapeHtml(org)}'s share of each paid session to be ${pct(rate)}.
           It starts once you accept and only applies to sessions booked after that.`
    }</p>
    <p><a href="${link}" style="background:#0054B4;color:#fff;padding:12px 20px;
    border-radius:6px;text-decoration:none;">${kind === "join" ? "See the invite" : "Review the new rate"}</a></p>
    <p style="color:#767980;font-size:13px;">${
      kind === "join" ? "Sign in or sign up as a coach with this email address to accept." : "Sign in with your coach account to accept or decline."
    }</p>
  </div>`;

const sendEmail = async (service: SupabaseClient, to: string, subject: string, html: string) => {
  const { data: cfg } = await service.from("configurations").select("value").eq("key", "smtp_email").maybeSingle();
  const from = cfg?.value as string | undefined;
  if (!from || !to) return false;
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify({ to, from, subject, html }),
  }).catch((e) => {
    console.error("send-email failed", e);
    return null;
  });
  return Boolean(res?.ok);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const service = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const body = (await req.json()) as Record<string, unknown>;
    const siteUrl = resolveSiteUrl(req.headers.get("origin"));

    let token: string | null = null;
    let kind: "join" | "rate" = "join";
    if (body.action === "invite") {
      const { data, error } = await authClient.rpc("invite_organization_coach", { p_email: body.email, p_rate: body.rate });
      if (error) return json({ error: error.message }, 400);
      token = data as string;
    } else if (body.action === "resend") {
      const { data, error } = await authClient.rpc("resend_organization_invite", { p_invite_id: body.invite_id });
      if (error || !data) return json({ error: error?.message ?? "This invite is no longer open" }, 400);
      token = data as string;
    } else if (body.action === "rate") {
      kind = "rate";
      const { data, error } = await authClient.rpc("change_organization_rate", { p_coach_id: body.coach_id, p_rate: body.rate });
      if (error) return json({ error: error.message }, 400);
      if (!data) return json({ link: null, emailed: false, unchanged: true });
      token = data as string;
    } else {
      return json({ error: "Unknown action" }, 400);
    }

    const { data: invite } = await service
      .from("organization_invites")
      .select("kind, email, rate, coach_id, organization:organizations(name, owner:coaches!organizations_owner_coach_id_fkey(name))")
      .eq("token", token)
      .single();
    if (!invite) return json({ error: "Invite not found" }, 400);
    kind = invite.kind as "join" | "rate";
    // deno-lint-ignore no-explicit-any
    const org = invite.organization as any;
    let to = invite.email as string | null;
    if (kind === "rate") {
      const { data: coach } = await service.from("coaches").select("email").eq("id", invite.coach_id).maybeSingle();
      to = (coach?.email as string | undefined) ?? null;
    }
    const link = `${siteUrl}/org-invite/${token}`;
    const subject = kind === "join" ? `${org.owner?.name ?? "A coach"} invited you to join ${org.name}` : `${org.name} asked to change your rate`;
    const emailed = to ? await sendEmail(service, to, subject, emailHtml(kind, org.name, org.owner?.name ?? "The owner", Number(invite.rate), link)) : false;
    return json({ link, emailed });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Something went wrong" }, 500);
  }
});
