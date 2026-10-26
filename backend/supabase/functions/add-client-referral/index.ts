import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { EMAIL_MUTED, emailButton, emailShell, escapeEmailHtml } from "../_shared/email_shell.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const INVITE_TTL_DAYS = 14;
const MAX_CLIENTS_PER_REQUEST = 50;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Invite links go to third parties, so never build them from an arbitrary
// caller-supplied Origin header (a coach could otherwise point the email at
// their own site). Local dev and athanext.com hosts are allowed; anything else
// falls back to SITE_URL.
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

const escapeHtml = escapeEmailHtml;

const inviteEmailHtml = (
  coachName: string,
  clientName: string | null,
  link: string,
  athleteFirstName: string | null = null,
) =>
  emailShell(
    `${coachName} invited you to AthaNext`,
    [
      `<p>${clientName ? `Hi ${escapeHtml(clientName)},` : "Hi,"}</p>`,
      `<p>${escapeHtml(coachName)} manages their sessions on AthaNext. As an existing client,
    you book with them with <strong>no platform service fee</strong>.</p>`,
      `<p>${athleteFirstName ? `After you accept, add ${escapeHtml(athleteFirstName)} as your athlete.` : "After you accept, add your athlete (or yourself, if you're 18 or older)."}</p>`,
      emailButton(link, "Accept invite"),
    ],
    `<p style="color:${EMAIL_MUTED};font-size:13px;margin:24px 0 0;">Use this email address when you sign up or log in.
    This invite expires in ${INVITE_TTL_DAYS} days.</p>`,
  );

type ClientInput = { email: string; name: string | null; athleteFirstName: string | null };

const parseClients = (body: Record<string, unknown>): ClientInput[] => {
  const raw: ClientInput[] = [];
  if (Array.isArray(body?.clients)) {
    for (const c of body.clients as Array<Record<string, unknown>>) {
      if (typeof c?.email !== "string") continue;
      const name = typeof c?.name === "string" ? c.name.trim().slice(0, 100) : "";
      const athleteFirstName =
        typeof c?.athlete_first_name === "string" ? c.athlete_first_name.trim().slice(0, 100) : "";
      raw.push({ email: c.email, name: name || null, athleteFirstName: athleteFirstName || null });
    }
  }
  // Legacy payload: plain email list.
  if (Array.isArray(body?.client_emails)) {
    for (const e of body.client_emails as unknown[]) {
      if (typeof e === "string") raw.push({ email: e, name: null, athleteFirstName: null });
    }
  }
  const seen = new Set<string>();
  const clients: ClientInput[] = [];
  for (const c of raw) {
    const email = c.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email) || seen.has(email)) continue;
    seen.add(email);
    clients.push({ ...c, email });
  }
  return clients.slice(0, MAX_CLIENTS_PER_REQUEST);
};

const sendInviteEmail = async (
  service: SupabaseClient,
  to: string,
  coachName: string,
  clientName: string | null,
  link: string,
  athleteFirstName: string | null = null,
) => {
  const { data: cfgRows } = await service
    .from("configurations")
    .select("key,value")
    .in("key", ["smtp_email"]);
  const fromEmail = cfgRows?.find((r: { key: string }) => r.key === "smtp_email")?.value;
  if (!fromEmail) return false;
  // Fire-and-forget via the deployed send-email function (same pattern as
  // create-booking-payment -> reconcile-stripe-fees).
  fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify({
      to,
      from: fromEmail,
      subject: `${coachName} invited you to AthaNext`,
      html: inviteEmailHtml(coachName, clientName, link, athleteFirstName),
    }),
  }).catch((e) => console.error("send-email failed", e));
  return true;
};

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
    const siteUrl = resolveSiteUrl(req.headers.get("origin"));
    const inviteLink = (token: string) => `${siteUrl}/invite/${token}`;
    const body = (await req.json()) as Record<string, unknown>;

    const coachNameFor = async (coachId: string) => {
      const { data } = await service.from("coaches").select("name").eq("id", coachId).maybeSingle();
      return (data?.name as string | undefined) ?? "Your coach";
    };

    // Resend: the RPC checks the caller owns the invite (or is admin) and
    // rotates the token, which kills the previous link.
    if (body?.action === "resend") {
      if (typeof body.referral_id !== "string") {
        return json({ error: "referral_id is required" }, 400);
      }
      const { data: token, error: resendError } = await authClient.rpc("resend_coach_referral", {
        _referral_id: body.referral_id,
      });
      if (resendError || !token) {
        return json({ error: resendError?.message ?? "Invite cannot be resent" }, 400);
      }
      const { data: row } = await service
        .from("coach_client_referrals")
        .select("coach_id, client_email, client_name, athlete_first_name")
        .eq("id", body.referral_id)
        .single();
      const link = inviteLink(token as string);
      const emailed = row
        ? await sendInviteEmail(
            service, row.client_email, await coachNameFor(row.coach_id), row.client_name, link, row.athlete_first_name,
          )
        : false;
      return json({ invite_link: link, emailed });
    }

    const clients = parseClients(body);
    if (clients.length === 0) {
      return json({ error: "Add at least one valid client email" }, 400);
    }

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
    const coachName = await coachNameFor(coachId);

    const results: Array<{ email: string; status: string; invite_link?: string; emailed?: boolean }> = [];
    for (const { email, name, athleteFirstName } of clients) {
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

      // Admin override on a known athlete confirms straight away (book of
      // business import). Everything else waits for the athlete to claim.
      const confirmedNow = adminCreated && Boolean(athleteId);
      const status = adminCreated
        ? "confirmed"
        : athleteId
          ? "pending_confirmation"
          : "invited";

      if (confirmedNow) {
        const { data: already } = await service
          .from("coach_client_referrals")
          .select("id")
          .eq("coach_id", coachId)
          .eq("athlete_id", athleteId)
          .eq("status", "confirmed")
          .limit(1);
        if (already?.length) {
          results.push({ email, status: "already_exists" });
          continue;
        }
      }

      const { data: inserted, error: insertError } = await service
        .from("coach_client_referrals")
        .insert({
          coach_id: coachId,
          client_email: email,
          client_name: name,
          athlete_first_name: athleteFirstName,
          athlete_id: athleteId,
          initiated_by: adminCreated ? "admin" : "coach",
          status,
          confirmed_at: adminCreated ? new Date().toISOString() : null,
          expires_at: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString(),
          invite_token: confirmedNow ? null : crypto.randomUUID(),
        })
        .select("invite_token")
        .single();
      if (insertError || !inserted) {
        console.error("insert referral failed", insertError);
        results.push({ email, status: "error" });
        continue;
      }

      if (!inserted.invite_token) {
        results.push({ email, status });
        continue;
      }
      const link = inviteLink(inserted.invite_token);
      const emailed = await sendInviteEmail(service, email, coachName, name, link, athleteFirstName);
      results.push({ email, status, invite_link: link, emailed });
    }

    return json({ results });
  } catch (e) {
    console.error(e);
    return json({ error: "Internal error" }, 500);
  }
});
