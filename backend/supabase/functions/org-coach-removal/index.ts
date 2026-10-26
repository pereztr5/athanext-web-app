// Owner asks AthaNext to remove a coach. The database keeps the request; this emails support.
// Support settles splits, payouts and package credits by hand. Nothing is deleted here.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { EMAIL_MUTED, emailShell, escapeEmailHtml } from "../_shared/email_shell.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const escapeHtml = escapeEmailHtml;

const sendEmail = async (service: SupabaseClient, to: string, from: string, subject: string, html: string) => {
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

    const body = (await req.json()) as { coach_id?: string; reason?: string };
    if (!body.coach_id) return json({ error: "Missing coach" }, 400);

    const { data: requestId, error: rpcError } = await authClient.rpc("request_org_coach_removal", {
      p_coach_id: body.coach_id,
      p_reason: body.reason ?? null,
    });
    if (rpcError) return json({ error: rpcError.message }, 400);
    if (!requestId) return json({ error: "Couldn't save the request" }, 400);

    const service = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: cfgRows } = await service
      .from("configurations")
      .select("key, value")
      .in("key", ["smtp_email", "contact_admin_email"]);
    const cfg = Object.fromEntries((cfgRows ?? []).map((row: { key: string; value: string }) => [row.key, row.value]));
    const from = cfg.smtp_email as string | undefined;
    const recipients = String(cfg.contact_admin_email ?? "")
      .split(/[,;]/)
      .map((part) => part.trim())
      .filter(Boolean);

    const { data: row } = await service
      .from("org_coach_removal_requests")
      .select("reason, created_at, org, coach, requested_by")
      .eq("id", requestId)
      .maybeSingle();

    let emailed = false;
    if (from && recipients.length && row) {
      const ids = [row.coach, row.requested_by].filter(Boolean);
      const { data: people } = await service.from("coaches").select("id, name").in("id", ids);
      const nameOf = (id: string) => (people ?? []).find((p: { id: string; name: string | null }) => p.id === id)?.name || "A coach";
      const { data: org } = await service.from("organizations").select("name").eq("id", row.org).maybeSingle();
      const orgName = org?.name || "the organization";
      const coachName = nameOf(row.coach);
      const ownerName = nameOf(row.requested_by);
      const reason = (row.reason as string | null)?.trim();
      const subject = `Removal request: ${coachName} from ${orgName}`;
      const html = emailShell(
        "Removal request",
        [
          `<p>${escapeHtml(ownerName)} asked to remove ${escapeHtml(coachName)} from ${escapeHtml(orgName)}.</p>`,
          reason ? `<p>Reason: ${escapeHtml(reason)}</p>` : "<p>No reason was given.</p>",
          `<p>Until this is settled, ${escapeHtml(coachName)} stays in the organization and splits keep running. Mark the request done in org_coach_removal_requests after you remove them.</p>`,
        ],
        `<p style="color:${EMAIL_MUTED};font-size:13px;margin:24px 0 0;">Request ${escapeHtml(String(requestId))}</p>`,
      );
      const results = await Promise.all(recipients.map((to) => sendEmail(service, to, from, subject, html)));
      emailed = results.some(Boolean);
    }

    return json({ id: requestId, emailed });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Something went wrong" }, 500);
  }
});
