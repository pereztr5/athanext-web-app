/**
 * Notifications bell (ATH-98): built on the server from messages, requests, feedback,
 * reviews, open invoices, camp sign-ups and upcoming sessions. Each item links to the screen it refers to.
 */
import { supabase } from "@/integrations/supabase/client";

type Row = Record<string, any>;

export type NotificationKind = "message" | "request" | "feedback_due" | "review" | "accepted" | "feedback" | "upcoming" | "invoice" | "camp";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  image: string | null;
  at: string;
  startsAt: string | null;
  unread: boolean;
  link: string;
}

export const notificationsAPI = {
  async list(): Promise<AppNotification[]> {
    const { data, error } = await supabase.rpc("get_my_notifications");
    if (error) throw error;
    return ((data as Row[]) ?? []).map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title ?? "",
      body: n.body ?? "",
      image: n.image ?? null,
      at: n.at,
      startsAt: n.starts_at ?? null,
      unread: Boolean(n.unread),
      link: n.link ?? "/dashboard",
    }));
  },

  async markSeen(): Promise<void> {
    const { error } = await supabase.rpc("mark_notifications_seen");
    if (error) throw error;
  },
};
