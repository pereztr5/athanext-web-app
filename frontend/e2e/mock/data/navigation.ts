import type { MockBackend } from "../backend";

// The app shell: get_my_notifications (shaped like the jsonb rows in
// 20261103120000_camp_signups_in_the_bell.sql) with mark_notifications_seen clearing the unread
// dots, and conversation_participants rows with their conversations embed for the Messages count.

type Row = Record<string, unknown>;

export const NAV = {
  conversationA: "0000c0c0-0000-4000-8000-000000000001",
  conversationB: "0000c0c0-0000-4000-8000-000000000002",
  requestBooking: "0000c0c0-0000-4000-8000-0000000000b1",
} as const;

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

/** A coach's bell: an unread message, an unread booking request and a review they've seen. */
export const coachNotifications = (): Row[] => [
  { id: `message-${NAV.conversationA}`, kind: "message", title: "Pat Parent", body: "Can we move Thursday to 5pm?", image: null, at: minutesAgo(5), starts_at: null, unread: true, link: `/chat?conversationId=${NAV.conversationA}` },
  { id: `request-${NAV.requestBooking}`, kind: "request", title: "Blake", body: "asked for Thu, Nov 5. Accept or decline within 24 hours.", image: null, at: minutesAgo(30), starts_at: null, unread: true, link: "/schedule?requests=1" },
  { id: "review-1", kind: "review", title: "New review", body: '5 stars: "Great first session"', image: null, at: daysAgo(3), starts_at: null, unread: false, link: "/profile" },
];

/** get_my_notifications from `rows`; mark_notifications_seen turns every dot off. */
export const seedNotifications = (backend: MockBackend, rows: Row[]) => {
  let seen = false;
  backend.rpc.get_my_notifications = () => rows.map((r) => ({ ...r, unread: seen ? false : r.unread }));
  backend.rpc.mark_notifications_seen = () => {
    seen = true;
    return null;
  };
};

/** Two conversations with messages the user hasn't read, and one they have. */
export const seedUnreadConversations = (backend: MockBackend, userId: string) => {
  backend.seed("conversation_participants", [
    { id: "0000c0c0-0000-4000-8000-0000000000p1", conversation_id: NAV.conversationA, user_id: userId, last_read_at: daysAgo(1), conversations: { last_message_at: minutesAgo(5) } },
    { id: "0000c0c0-0000-4000-8000-0000000000p2", conversation_id: NAV.conversationB, user_id: userId, last_read_at: null, conversations: { last_message_at: minutesAgo(60) } },
    { id: "0000c0c0-0000-4000-8000-0000000000p3", conversation_id: "0000c0c0-0000-4000-8000-000000000003", user_id: userId, last_read_at: minutesAgo(1), conversations: { last_message_at: daysAgo(2) } },
  ]);
};
