// deno-lint-ignore-file no-explicit-any
import nodemailer from "npm:nodemailer@6.9.10";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

type SupabaseClient = ReturnType<typeof createClient>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getSupabaseClient = (): SupabaseClient =>
  createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

// The message body is user text that ends up inside an HTML email.
const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Only the signed-in sender may trigger a notification for their own message.
const getCallerId = async (req: Request): Promise<string | null> => {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const { data, error } = await getSupabaseClient().auth.getUser(authHeader.slice(7));
  if (error || !data?.user) return null;
  return data.user.id;
};

type ParticipantProfile = {
  id: string;
  name: string | null;
  email: string | null;
  persona_type: string | null;
};

type Participant = {
  user_id: string;
  role: string | null;
  profile: ParticipantProfile;
};

type MessageInfo = {
  sender_id: string;
  created_at: string;
  sender_persona: string | null;
};

const buildTransporter = async () => {
  const smtpUser = Deno.env.get("GMAIL_USER") || "";
  const smtpPass = Deno.env.get("GMAIL_APP_PASSWORD") || "";
  const fromEmail = smtpUser || "";
  if (!smtpUser || !smtpPass || !fromEmail) throw new Error("Email credentials not configured");

  return {
    transporter: nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    }),
    fromEmail,
  };
};

const fetchParticipants = async (
  client: SupabaseClient,
  conversationId: string
): Promise<Participant[]> => {
  const { data, error } = await client
    .from("conversation_participants" as any)
    .select(
      `
        user_id,
        role,
        user_profiles!conversation_participants_user_id_fkey (
          id,
          name,
          email,
          persona_type
        )
      `
    )
    .eq("conversation_id", conversationId);

  if (error) {
    console.error("Failed to load participants", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    user_id: row.user_id,
    role: row.role,
    profile: {
      id: row.user_profiles?.id ?? row.user_id,
      name: row.user_profiles?.name ?? null,
      email: row.user_profiles?.email ?? null,
      persona_type: row.user_profiles?.persona_type ?? null,
    },
  }));
};

const fetchMessageHistory = async (
  client: SupabaseClient,
  conversationId: string,
  beforeIso: string
): Promise<MessageInfo[]> => {
  const { data, error } = await client
    .from("messages" as any)
    .select(
      `
        sender_id,
        created_at,
        user_profiles!messages_sender_id_fkey (
          persona_type
        )
      `
    )
    .eq("conversation_id", conversationId)
    .lt("created_at", beforeIso)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Failed to fetch prior messages", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    sender_id: row.sender_id,
    created_at: row.created_at,
    sender_persona: row.user_profiles?.persona_type ?? null,
  }));
};

const shouldSendNotification = (
  actorId: string,
  actorPersona: string | null,
  priorMessages: MessageInfo[],
  firstMessageFlag?: boolean,
  firstReplyFlag?: boolean
) => {
  if (firstMessageFlag || firstReplyFlag) {
    return {
      firstMessage: Boolean(firstMessageFlag),
      firstReply: Boolean(firstReplyFlag),
    };
  }

  if (!actorPersona) return { firstMessage: false, firstReply: false };

  const isFirstMessage = priorMessages.length === 0;
  if (isFirstMessage) {
    return { firstMessage: actorPersona === "athlete", firstReply: false };
  }

  const last = priorMessages[0];
  const lastOpposite = last && last.sender_id !== actorId && last.sender_persona !== actorPersona;
  if (!lastOpposite) return { firstMessage: false, firstReply: false };

  const actorRespondedAfter = priorMessages.some(
    (msg) =>
      msg.sender_id === actorId &&
      msg.sender_persona === actorPersona &&
      Date.parse(msg.created_at) > Date.parse(last.created_at)
  );

  const firstReply = !actorRespondedAfter;
  return { firstMessage: false, firstReply };
};

const fetchTemplates = async (client: SupabaseClient) => {
  const keys = [
    "conversation_notification_template",
    "smtp_email",
    "contact_admin_email",
  ];
  const { data, error } = await client
    .from("configurations")
    .select("key,value")
    .in("key", keys);

  if (error) {
    console.warn("Failed to load templates from configurations:", error);
    return {};
  }

  const map: Record<string, string> = {};
  (data || []).forEach((row: any) => {
    map[row.key] = row.value;
  });
  return map;
};

const renderEmail = ({
  actorName,
  recipientName,
  messageBody,
}: {
  actorName: string;
  recipientName: string;
  messageBody: string;
}) => {
  return `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <h2 style="color:#0d7ff2;">New message from ${actorName}</h2>
      <p>Hi ${recipientName},</p>
      <p>You have a new message in AthaNext:</p>
      <blockquote style="border-left: 3px solid #0d7ff2; padding-left: 12px; color:#334155;">
        ${messageBody}
      </blockquote>
      <p>
        <a href="${(Deno.env.get("APP_ORIGIN") || "https://athanext.com") +
          `/chat`}" style="display:inline-block;padding:10px 16px;background:#0d7ff2;color:white;text-decoration:none;border-radius:8px;">
          View Conversation
        </a>
      </p>
      <p style="font-size: 12px; color: #64748b;">If the button doesn't work, copy and paste this link in your browser.</p>
    </div>
  `;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    const conversationId = body?.conversationId || body?.conversation_id;
    const actorId = body?.actorId || body?.actor_id;
    const messageBody = escapeHtml(String(body?.messageBody || ""));
    const messageTimestamp = body?.messageTimestamp || new Date().toISOString();
    const firstMessageFlag = body?.first_message ?? body?.firstMessage;
    const firstReplyFlag = body?.first_reply ?? body?.firstReply;

    if (!conversationId || !actorId) {
      return new Response(JSON.stringify({ error: "conversationId and actorId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = await getCallerId(req);
    if (!callerId || callerId !== actorId) {
      return new Response(JSON.stringify({ error: "Not allowed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabaseClient();
    const participants = await fetchParticipants(supabase, conversationId);
    const actor = participants.find((p) => p.user_id === actorId);
    const recipient = participants.find((p) => p.user_id !== actorId);

    if (!actor || !recipient) {
      return new Response(JSON.stringify({ error: "Participants not found for conversation" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const priorMessages = await fetchMessageHistory(supabase, conversationId, messageTimestamp);
    const { firstMessage, firstReply } = shouldSendNotification(
      actorId,
      actor.profile.persona_type,
      priorMessages,
      firstMessageFlag,
      firstReplyFlag
    );

    const shouldNotify =
      (actor.profile.persona_type === "athlete" && (firstMessage || firstReply)) ||
      (actor.profile.persona_type === "coach" && firstReply);

    if (!shouldNotify) {
      return new Response(JSON.stringify({ success: true, notified: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const templates = await fetchTemplates(supabase);
    const configuredTemplate = templates["conversation_notification_template"];
    const { transporter, fromEmail } = await buildTransporter();
    const recipientEmail = recipient.profile.email;
    if (!recipientEmail) {
      console.warn("No recipient email; skipping notification");
      return new Response(JSON.stringify({ success: true, notified: false, reason: "no email" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const actorName = actor.profile.name || "User";
    const recipientName = recipient.profile.name || "there";
    const subject = firstMessage
      ? `New chat started by ${actorName}`
      : `New reply from ${actorName}`;

    const rendered =
      configuredTemplate && typeof configuredTemplate === "string"
        ? configuredTemplate
            .replace(/{{actor_name}}/g, actorName)
            .replace(/{{actor_role}}/g, actor.profile.persona_type === "coach" ? "Coach" : "Athlete")
            .replace(/{{message_timestamp}}/g, new Date(messageTimestamp).toLocaleString())
            .replace(/{{message_body}}/g, messageBody)
        : renderEmail({ actorName, recipientName, messageBody });

    await transporter.sendMail({
      from: fromEmail,
      to: recipientEmail,
      subject,
      html: rendered,
    });

    return new Response(
      JSON.stringify({
        success: true,
        notified: true,
        recipient: recipientEmail,
        firstMessage,
        firstReply,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Error in send-conversation-email:", err);
    return new Response(JSON.stringify({ error: (err as Error)?.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
