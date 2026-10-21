// "Report an issue" escalation. The family saves the report with report_session_issue() (which
// checks they're on the booking), then calls this with the report id. This emails
// support@athanext.com right away with everything support needs (safety concerns marked URGENT)
// and sends the family a confirmation, then stamps emailed_at so a retry doesn't email twice.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  familyHtml,
  familySubject,
  resolveSiteUrl,
  supportHtml,
  supportSubject,
  supportText,
  type IssueReport,
} from "./email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SUPPORT_EMAIL = Deno.env.get("SUPPORT_EMAIL") || "support@athanext.com";
const DEFAULT_SITE_URL = Deno.env.get("SITE_URL") ?? "https://athanext.com";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Session dates and times are stored as Eastern wall time: "Tue, Oct 21, 5:00 PM ET". */
const easternWhen = (date: string | null, time: string | null) => {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  const weekday = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  let clock = "";
  if (time) {
    const [h, min] = time.split(":").map(Number);
    clock = `, ${((h + 11) % 12) + 1}:${String(min).padStart(2, "0")} ${h < 12 ? "AM" : "PM"} ET`;
  }
  return `${weekday}, ${MONTHS[m - 1]} ${d}${clock}`;
};

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

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

    const body = (await req.json().catch(() => ({}))) as { report_id?: string; origin?: string };
    if (typeof body.report_id !== "string" || !body.report_id) return json({ error: "report_id required" }, 400);

    const admin = createClient(url, serviceRole);
    const { data: report } = await admin
      .from("session_issue_reports")
      .select("id, booking_id, occurrence_id, reporter_id, athlete_id, coach_id, reason, details, created_at, emailed_at")
      .eq("id", body.report_id)
      .maybeSingle();
    const r = report as Row | null;
    if (!r || r.reporter_id !== me.id) return json({ error: "Not found" }, 404);
    if (r.emailed_at) return json({ emailed: true });

    const [bookingRes, occRes, coachRes, athleteRes, reporterRes, cfgRes] = await Promise.all([
      r.booking_id
        ? admin.from("coach_slot_bookings").select("status, payment_status").eq("id", r.booking_id).maybeSingle()
        : Promise.resolve({ data: null }),
      r.occurrence_id
        ? admin
            .from("coach_availability_slot_occurrences")
            .select("occurrence_date, start_time, session_type, session_name, pillar_slot, place, location, price")
            .eq("id", r.occurrence_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      r.coach_id ? admin.from("coaches").select("name, email, slug").eq("id", r.coach_id).maybeSingle() : Promise.resolve({ data: null }),
      r.athlete_id ? admin.from("athlete_profiles").select("full_name").eq("id", r.athlete_id).maybeSingle() : Promise.resolve({ data: null }),
      admin.from("user_profiles").select("name, email").eq("id", me.id).maybeSingle(),
      admin.from("configurations").select("value").eq("key", "smtp_email").maybeSingle(),
    ]);
    const booking = bookingRes.data as Row | null;
    const occ = occRes.data as Row | null;
    const coach = coachRes.data as Row | null;
    const athlete = athleteRes.data as Row | null;
    const reporter = reporterRes.data as Row | null;
    const from = (cfgRes.data?.value as string | undefined) ?? "";
    if (!from) {
      console.error("report-session-issue: smtp_email not configured; report saved", r.id);
      return json({ emailed: false, reason: "smtp_email not configured" });
    }

    const site = resolveSiteUrl(body.origin ?? req.headers.get("origin"), DEFAULT_SITE_URL);
    const sessionTitle = occ
      ? occ.session_type === "group"
        ? occ.session_name || "Group session"
        : `${occ.pillar_slot || "1-on-1"}`
      : null;
    const reporterEmail = (reporter?.email as string | null) || me.email || null;
    const info: IssueReport = {
      id: r.id,
      reason: r.reason,
      details: r.details,
      createdAt: new Date(r.created_at).toISOString(),
      bookingId: r.booking_id,
      occurrenceId: r.occurrence_id,
      bookingStatus: booking?.status ?? null,
      paymentStatus: booking?.payment_status ?? null,
      sessionTitle,
      sessionWhen: occ ? easternWhen(occ.occurrence_date, occ.start_time) : null,
      place: occ ? (occ.location === "online" ? "Video call" : occ.place || occ.location || null) : null,
      price: occ?.price != null ? Number(occ.price) : null,
      coachName: coach?.name || "Unknown coach",
      coachEmail: coach?.email ?? null,
      coachLink: r.coach_id ? `${site}/coach/${coach?.slug || r.coach_id}` : null,
      athleteName: athlete?.full_name || "Unknown athlete",
      reporterName: (reporter?.name as string | null) || reporterEmail || "A family",
      reporterEmail,
      sessionLink: r.occurrence_id ? `${site}/sessions/${r.occurrence_id}` : null,
    };

    const send = (payload: Record<string, unknown>) =>
      fetch(`${url}/functions/v1/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRole}` },
        body: JSON.stringify({ from, ...payload }),
      })
        .then((res) => res.ok)
        .catch((e) => {
          console.error("report-session-issue: send failed", e);
          return false;
        });

    const supportSent = await send({
      to: SUPPORT_EMAIL,
      subject: supportSubject(info),
      html: supportHtml(info),
      message: supportText(info),
    });
    const familySent = reporterEmail
      ? await send({ to: reporterEmail, subject: familySubject, html: familyHtml(info) })
      : false;

    if (supportSent) {
      await admin.from("session_issue_reports").update({ emailed_at: new Date().toISOString() }).eq("id", r.id);
    } else {
      console.error("report-session-issue: support email failed; report saved", r.id);
    }
    return json({ emailed: supportSent, confirmed: familySent });
  } catch (e) {
    console.error(e);
    return json({ error: "That didn't send. Try again" }, 500);
  }
});
