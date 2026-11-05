import type { Page, Route } from "@playwright/test";
import { MOCK_SUPABASE_URL, mockId, type MockBackend } from "../backend";
import { IDS } from "../personas";

// Messages fixtures: a parent's direct chat with Casey Coach, a second direct chat with another
// coach, and Casey's community channel. Rows are stored flat (conversations,
// conversation_participants, messages) and `embedConversations` answers the conversations
// select with participants and their profiles embedded, the way PostgREST does, so rows the app
// inserts (a new chat, a new channel) come back with their participants too.

export const CHAT = {
  direct: "0000c4a7-0000-4000-8000-000000000001",
  other: "0000c4a7-0000-4000-8000-000000000002",
  channel: "0000c4a7-0000-4000-8000-000000000003",
  otherCoachUser: "0000c4a7-0000-4000-8000-0000000000c2",
  otherCoach: "0000c4a7-0000-4000-8000-0000000000c3",
} as const;

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

type Row = Record<string, unknown>;

const message = (conversationId: string, senderId: string, senderName: string, body: string, minutesAgo: number): Row => ({
  id: mockId(),
  conversation_id: conversationId,
  sender_id: senderId,
  body,
  created_at: ago(minutesAgo),
  edited_at: null,
  status: "sent",
  offer_id: null,
  sender: { name: senderName },
});

/** Pat Parent's inbox: Casey (unread, newest), Jordan, and Casey's community channel. */
export const seedParentInbox = (backend: MockBackend) => {
  backend.seed("user_profiles", [
    {
      id: CHAT.otherCoachUser,
      email: "jordan@e2e.test",
      name: "Jordan Lee",
      persona_type: "coach",
      coach_id: CHAT.otherCoach,
      image_url: null,
      instagram_handle: "@jordan.keeps",
    },
  ]);
  backend.seed("conversations", [
    { id: CHAT.direct, title: "Casey Coach", is_group: false, created_by: IDS.parentUser, created_at: ago(60 * 24 * 7), last_message_text: "See you Saturday at 10.", last_message_at: ago(30) },
    { id: CHAT.other, title: "Jordan Lee", is_group: false, created_by: IDS.parentUser, created_at: ago(60 * 24 * 14), last_message_text: "Thanks for the great session", last_message_at: ago(60 * 24 * 2) },
    { id: CHAT.channel, title: "Casey's Keepers", is_group: true, created_by: IDS.coachUser, created_at: ago(60 * 24 * 30), last_message_text: "Bring water on Saturday", last_message_at: ago(60 * 24 * 3) },
  ]);
  backend.seed("conversation_participants", [
    // Pat read Casey's chat before the last message, so it shows as unread.
    { id: mockId(), conversation_id: CHAT.direct, user_id: IDS.parentUser, role: "owner", last_read_at: ago(120) },
    { id: mockId(), conversation_id: CHAT.direct, user_id: IDS.coachUser, role: "member", last_read_at: ago(30) },
    { id: mockId(), conversation_id: CHAT.other, user_id: IDS.parentUser, role: "owner", last_read_at: ago(60) },
    { id: mockId(), conversation_id: CHAT.other, user_id: CHAT.otherCoachUser, role: "member", last_read_at: ago(60) },
    { id: mockId(), conversation_id: CHAT.channel, user_id: IDS.coachUser, role: "owner", last_read_at: ago(60) },
    { id: mockId(), conversation_id: CHAT.channel, user_id: IDS.parentUser, role: "member", last_read_at: ago(60) },
  ]);
  backend.seed("messages", [
    // Two from Casey in a row, so Pat's next message is the first reply (and emails Casey).
    message(CHAT.direct, IDS.coachUser, "Casey Coach", "Great work on first touch today.", 90),
    message(CHAT.direct, IDS.coachUser, "Casey Coach", "See you Saturday at 10.", 30),
    message(CHAT.other, IDS.parentUser, "Pat Parent", "Can we book another keeper session?", 60 * 24 * 2 + 10),
    message(CHAT.other, CHAT.otherCoachUser, "Jordan Lee", "Thanks for the great session", 60 * 24 * 2),
    message(CHAT.channel, IDS.coachUser, "Casey Coach", "Bring water on Saturday", 60 * 24 * 3),
  ]);
};

/** What get_conversation_context returns to Casey for the chat with Pat: Pat is Ava's parent. */
export const coachContext = {
  athlete_id: IDS.athlete,
  athlete_name: "Ava Patel",
  age: 13,
  holder_name: "Pat Parent",
  holder_is_parent: true,
  latest_notes: { slot_id: IDS.appointment, date: new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10), summary: "Worked on weak-foot passing" },
};

/** get_conversation_safeguard for a chat about an under-18 athlete held by a parent. */
export const safeguard = (viewerIsFamily: boolean) => ({
  athlete_first: "Ava",
  holder_name: "Pat Parent",
  viewer_is_family: viewerIsFamily,
  held_by_parent: true,
});

// ---- conversations with embedded participants ----

const parseFilter = (raw: string): ((cell: unknown) => boolean) => {
  const dot = raw.indexOf(".");
  const op = raw.slice(0, dot);
  const value = decodeURIComponent(raw.slice(dot + 1));
  if (op === "in") {
    const list = value.replace(/^\(|\)$/g, "").split(",").map((v) => v.replace(/^"|"$/g, ""));
    return (cell) => list.includes(String(cell));
  }
  if (op === "eq") return (cell) => String(cell) === value;
  return () => true;
};

const withParticipants = (backend: MockBackend, conversation: Row): Row => ({
  ...conversation,
  conversation_participants: backend
    .table("conversation_participants")
    .filter((p) => p.conversation_id === conversation.id)
    .map((p) => {
      const profile = backend.table("user_profiles").find((u) => u.id === p.user_id);
      return {
        user_id: p.user_id,
        role: p.role,
        last_read_at: p.last_read_at ?? null,
        user_profiles: profile
          ? { name: profile.name ?? null, coach_id: profile.coach_id ?? null, image_url: profile.image_url ?? null, instagram_handle: profile.instagram_handle ?? null }
          : null,
      };
    }),
});

/** Answers GET /conversations with conversation_participants(user_profiles) embedded. Writes fall through to the mock. */
export const embedConversations = async (page: Page, backend: MockBackend) => {
  await page.route(`${MOCK_SUPABASE_URL}/rest/v1/conversations?*`, async (route: Route) => {
    const request = route.request();
    if (request.method() !== "GET") return route.fallback();
    const url = new URL(request.url());
    const filters = [...url.searchParams.entries()].filter(([k]) => !["select", "order", "limit", "offset"].includes(k));
    let rows = backend.table("conversations").filter((row) => filters.every(([k, v]) => parseFilter(v)(row[k])));
    rows = [...rows].sort((a, b) => String(b.last_message_at ?? "").localeCompare(String(a.last_message_at ?? "")));
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = url.searchParams.get("limit");
    rows = rows.slice(offset, limit ? offset + Number(limit) : undefined);
    const body = rows.map((row) => withParticipants(backend, row));
    const single = (request.headers()["accept"] ?? "").includes("vnd.pgrst.object");
    return route.fulfill({
      status: single && body.length !== 1 ? 406 : 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(single ? (body[0] ?? { code: "PGRST116", message: "no rows" }) : body),
    });
  });
};

/** create_coach_channel: stores the channel with Casey as owner and returns its id. */
export const handleCreateChannel = (backend: MockBackend) => {
  backend.rpc.create_coach_channel = (args) => {
    const id = mockId();
    backend.table("conversations").push({ id, title: args.p_title, is_group: true, created_by: IDS.coachUser, created_at: new Date().toISOString(), last_message_text: null, last_message_at: null });
    backend.table("conversation_participants").push({ id: mockId(), conversation_id: id, user_id: IDS.coachUser, role: "owner", last_read_at: null });
    return id;
  };
};
