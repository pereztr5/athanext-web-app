import nodemailer from "npm:nodemailer@6.9.10";
import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { allowedReplyTo, SUPPORT_EMAIL } from "../_shared/email_sender.ts";
import { clientIp, hashIp, resolveAppOrigin } from "../_shared/camp_signup.ts";
import {
  buildPublicEmails,
  isServiceCaller,
  type OutgoingEmail,
  PUBLIC_EMAIL_RATE_LIMITS,
} from "../_shared/public_email.ts";

// Our own functions call with the service role and send any to/subject/html (booking, camp and
// account emails). Any other caller (the anon key, a signed-in user) can only send one of the
// fixed kinds in _shared/public_email.ts, built here from fields and rate limited per device
// and per email; anything else is 403.

const smtpUser = Deno.env.get("GMAIL_USER") || "";
const smtpPass = Deno.env.get("GMAIL_APP_PASSWORD") || "";

if (!smtpUser || !smtpPass) {
  console.error("SMTP credentials are missing");
}

const transport = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(), "Content-Type": "application/json" } });

const send = (mail: {
  from: string;
  to: string;
  replyTo?: string;
  bcc?: string;
  subject: string;
  text?: string;
  html?: string;
}) =>
  new Promise<void>((resolve, reject) => {
    transport.sendMail(mail, (error: Error | null) => {
      if (error) return reject(error);
      resolve();
    });
  });

/** A fixed kind of message from a caller that isn't the service role. */
const handlePublic = async (req: Request, body: unknown) => {
  const supportEmail = Deno.env.get("SUPPORT_EMAIL") || SUPPORT_EMAIL;
  const built = buildPublicEmails(body, {
    supportEmail,
    from: `AthaNext <${smtpUser || supportEmail}>`,
    origin: resolveAppOrigin(
      req.headers.get("origin"),
      Deno.env.get("APP_ORIGIN") || Deno.env.get("SITE_URL") || "https://athanext.com",
    ),
  });
  if (!built.ok) return json({ error: built.error, fields: built.fields }, built.status);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  if (!serviceKey || !url) return json({ error: "Email isn't available right now." }, 503);
  const salt = serviceKey.slice(-16) || "email";
  const limits = PUBLIC_EMAIL_RATE_LIMITS;
  const { data: limited, error: rateError } = await createClient(url, serviceKey).rpc("email_send_attempt", {
    p_kind: built.kind,
    p_ip_hash: await hashIp(clientIp(req.headers), salt),
    p_email_hash: await hashIp(built.rateEmail, salt),
    p_per_ip: limits.perIp,
    p_ip_window_minutes: limits.ipWindowMinutes,
    p_per_email: limits.perEmail,
    p_email_window_minutes: limits.emailWindowMinutes,
  });
  if (rateError) {
    console.error("Email rate limit check failed:", rateError);
    return json({ error: "Email isn't available right now. Try again later." }, 503);
  }
  if (limited) {
    return json({ error: "Too many messages. Wait a few minutes and try again.", code: limited }, 429);
  }

  // The first email is the one that matters (to support@, or the parent); the visitor's
  // confirmation is best effort.
  const [main, ...rest] = built.emails as OutgoingEmail[];
  await send(main);
  for (const mail of rest) {
    await send(mail).catch((e) => console.error("Confirmation email failed:", e));
  }
  return json({ message: "Email sent successfully!" }, 200);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => null);

    if (!isServiceCaller(req.headers.get("Authorization"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))) {
      return await handlePublic(req, body);
    }

    const { to, from, subject, message, html, replyTo, bcc } = body ?? {};

    if (!to || !from || !subject || (!message && !html)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields." }),
        { status: 400, headers: corsHeaders() },
      );
    }

    // Optional BCC for ops copies (e.g. camp mail → support@). Only a bare email is accepted.
    const bccAddress =
      typeof bcc === "string" && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(bcc.trim()) ? bcc.trim().toLowerCase() : undefined;

    await send({
      from: from,
      to: to,
      // Only support@ or this mailbox; any other Reply-To is ignored.
      replyTo: allowedReplyTo(replyTo, smtpUser),
      ...(bccAddress ? { bcc: bccAddress } : {}),
      subject: subject,
      text: message,
      html: html,
    });

    return new Response(
      JSON.stringify({ message: "Email sent successfully!" }),
      { status: 200, headers: corsHeaders() },
    );
  } catch (error) {
    console.error("Email error:", error);
    return new Response(
      JSON.stringify({
        message: "Failed to send email",
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: corsHeaders() },
    );
  }
});
