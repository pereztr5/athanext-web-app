export const buildId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const getInitials = (name?: unknown): string => {
  const safeName = typeof name === "string" ? name.trim() : "";
  if (!safeName) return "U";
  const parts = safeName.split(/\s+/);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const formatDisplayName = (name?: unknown): string => {
  const safeName = typeof name === "string" ? name.trim() : "";
  if (!safeName) return "Unknown User";
  return safeName
    .trim()
    .split(/\s+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

type ConversationNotificationPayload = {
  conversationId: string;
  actorId: string;
  messageBody: string;
  messageTimestamp: string;
  firstMessage?: boolean;
  firstReply?: boolean;
};

import { apiClient } from "@/api";

/**
 * Sends a conversation notification email via the send-conversation-email Supabase function.
 */
export const sendConversationNotificationEmail = async (
  payload: ConversationNotificationPayload
) => {
  try {
    await apiClient.invoke("send-conversation-email", {
      conversationId: payload.conversationId,
      actorId: payload.actorId,
      messageBody: payload.messageBody,
      messageTimestamp: payload.messageTimestamp,
      first_message: Boolean(payload.firstMessage),
      first_reply: Boolean(payload.firstReply),
    });
  } catch (err) {
    console.error("Failed to send conversation notification email", err);
  }
};
