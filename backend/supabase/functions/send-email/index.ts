import nodemailer from "npm:nodemailer@6.9.10";
import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { allowedReplyTo } from "../_shared/email_sender.ts";

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
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  try {
    const { to, from, subject, message, html, replyTo } = await req.json();

    if (!to || !from || !subject || (!message && !html)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields." }),
        { status: 400, headers: corsHeaders() },
      );
    }

    await new Promise<void>((resolve, reject) => {
      transport.sendMail(
        {
          from: from,
          to: to,
          // Only support@ or this mailbox; any other Reply-To is ignored.
          replyTo: allowedReplyTo(replyTo, smtpUser),
          subject: subject,
          text: message,
          html: html,
        },
        (error: Error | null) => {
          if (error) return reject(error);
          resolve();
        },
      );
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
