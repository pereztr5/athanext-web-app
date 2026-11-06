import type { Page } from "@playwright/test";
import { test, expect } from "./test";
import { IDS } from "./personas";
import { isPhone } from "./helpers";
import { CHAT, coachContext, embedConversations, handleCreateChannel, safeguard, seedParentInbox } from "./data/chat";

// /chat: the conversation list, a thread, sending, starting chats and channels, and the phone
// layout where the list slides over the thread. Realtime pushes (a new message arriving from the
// other side) aren't simulated by the mock, so incoming messages are only covered as loaded rows.

/** The row for a conversation in the list. */
const listRow = (page: Page, name: string) => page.locator("aside [role=button]").filter({ hasText: name });

/** On phones the list is a drawer: open it before picking a conversation. */
const openList = async (page: Page) => {
  if (isPhone(page)) await page.getByRole("button", { name: "Open conversations" }).click();
  await expect(page.getByRole("heading", { name: "Messages" })).toBeInViewport();
};

const threadInput = (page: Page) => page.getByPlaceholder(/^Write to/);

test.describe("messages as a parent", () => {
  test.beforeEach(async ({ page, backend, as }) => {
    seedParentInbox(backend);
    backend.rpc.get_conversation_safeguard = safeguard(true);
    await embedConversations(page, backend);
    await as(page, "parent");
  });

  test("lists conversations newest first with previews and unread state", async ({ page }) => {
    await page.goto("/chat");
    await openList(page);
    const rows = page.locator("aside [role=button]");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("Casey Coach");
    await expect(rows.nth(0)).toContainText("See you Saturday at 10.");
    await expect(rows.nth(1)).toContainText("Jordan Lee");
    await expect(rows.nth(2)).toContainText("Casey's Keepers");
    // Only Casey's chat has a message newer than Pat's last read.
    await expect(listRow(page, "Jordan Lee").getByLabel("Unread messages")).toHaveCount(0);
  });

  test("opens the newest conversation, shows its thread and marks it read", async ({ page, backend }) => {
    await page.goto("/chat");
    await expect(page.getByText("Great work on first touch today.")).toBeVisible();
    await expect(page.getByText("See you Saturday at 10.").last()).toBeVisible();
    await expect(page.getByText("Ava is under 18, so you're part of every message with coaches about Ava.")).toBeVisible();
    await expect(threadInput(page)).toHaveAttribute("placeholder", "Write to Casey");
    await expect(page.getByRole("button", { name: "View profile" })).toBeVisible();

    await expect.poll(() => backend.writesTo("conversation_participants", "PATCH").length).toBeGreaterThan(0);
    const read = backend.writesTo("conversation_participants", "PATCH")[0];
    expect(read.url).toContain(`conversation_id=eq.${CHAT.direct}`);
    expect(read.url).toContain(`user_id=eq.${IDS.parentUser}`);
    expect(read.body).toEqual({ last_read_at: expect.any(String) });
  });

  test("sends a message: inserts it, updates the preview and emails the coach on the first reply", async ({ page, backend }) => {
    await page.goto("/chat");
    await expect(page.getByText("Great work on first touch today.")).toBeVisible();
    const send = page.getByRole("button", { name: "Send", exact: true });
    await expect(send).toBeDisabled();
    await threadInput(page).fill("   ");
    await expect(send).toBeDisabled();

    await threadInput(page).fill("  Perfect, we'll be there.  ");
    await send.click();

    await expect(threadInput(page)).toHaveValue("");
    await expect(page.getByText("Perfect, we'll be there.").first()).toBeVisible();

    await expect.poll(() => backend.writesTo("messages", "POST").length).toBe(1);
    expect(backend.writesTo("messages", "POST")[0].body).toEqual({ conversation_id: CHAT.direct, sender_id: IDS.parentUser, body: "Perfect, we'll be there." });

    await expect.poll(() => backend.writesTo("conversations", "PATCH").length).toBe(1);
    const preview = backend.writesTo("conversations", "PATCH")[0];
    expect(preview.url).toContain(`id=eq.${CHAT.direct}`);
    expect(preview.body).toEqual({ last_message_text: "Perfect, we'll be there.", last_message_at: expect.any(String) });

    await expect.poll(() => backend.writesTo("send-conversation-email").length).toBe(1);
    expect(backend.writesTo("send-conversation-email")[0].body).toMatchObject({
      conversationId: CHAT.direct,
      actorId: IDS.parentUser,
      messageBody: "Perfect, we'll be there.",
      first_message: false,
      first_reply: true,
    });

    await openList(page);
    await expect(listRow(page, "Casey Coach")).toContainText("Perfect, we'll be there.");
  });

  test("Enter sends too", async ({ page, backend }) => {
    await page.goto("/chat");
    await expect(page.getByText("Great work on first touch today.")).toBeVisible();
    await threadInput(page).fill("On our way");
    await threadInput(page).press("Enter");
    await expect.poll(() => backend.writesTo("messages", "POST").length).toBe(1);
    expect((backend.writesTo("messages", "POST")[0].body as { body: string }).body).toBe("On our way");
  });

  test("switches conversations from the list", async ({ page }) => {
    await page.goto("/chat");
    await expect(page.getByText("Great work on first touch today.")).toBeVisible();
    await openList(page);
    await listRow(page, "Jordan Lee").click();
    await expect(page.getByText("Can we book another keeper session?")).toBeVisible();
    await expect(page.getByText("Great work on first touch today.")).toHaveCount(0);
    await expect(threadInput(page)).toHaveAttribute("placeholder", "Write to Jordan");
    // Jordan's handle is the subline.
    await expect(page.getByText("jordan.keeps")).toBeVisible();
  });

  test("searches conversations by name and message text", async ({ page }) => {
    await page.goto("/chat");
    await openList(page);
    const search = page.getByPlaceholder("Search messages");
    await search.fill("keeper");
    await expect(page.locator("aside [role=button]")).toHaveCount(1);
    await expect(listRow(page, "Casey's Keepers")).toBeVisible();
    await search.fill("jordan");
    await expect(page.locator("aside [role=button]")).toHaveCount(1);
    await expect(listRow(page, "Jordan Lee")).toBeVisible();
    await search.fill("nobody-matches");
    await expect(page.getByText("No matching conversations")).toBeVisible();
    await search.fill("");
    await expect(page.locator("aside [role=button]")).toHaveCount(3);
  });

  test("a ?conversationId= link opens that conversation", async ({ page }) => {
    await page.goto(`/chat?conversationId=${CHAT.other}`);
    await expect(page.getByText("Can we book another keeper session?")).toBeVisible();
    await expect(threadInput(page)).toHaveAttribute("placeholder", "Write to Jordan");
  });

  test("a community channel: group composer, no safeguarding strip, leave and join again", async ({ page, backend }) => {
    backend.rpc.leave_coach_channel = (args, { backend: b, user }) => {
      b.tables.conversation_participants = b.table("conversation_participants").filter((p) => !(p.conversation_id === args.p_conversation_id && p.user_id === user?.id));
      return null;
    };
    backend.rpc.join_coach_channel = (args, { backend: b, user }) => {
      b.table("conversation_participants").push({ id: `join-${Date.now()}`, conversation_id: args.p_conversation_id, user_id: user!.id, role: "member", last_read_at: null });
      return null;
    };
    await page.goto(`/chat?conversationId=${CHAT.channel}`);
    await expect(page.getByText("Bring water on Saturday").last()).toBeVisible();
    await expect(threadInput(page)).toHaveAttribute("placeholder", "Write to the group");
    await expect(page.getByText(/is under 18/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Share session notes" })).toHaveCount(0);

    await page.getByRole("button", { name: "Leave" }).click();
    await expect.poll(() => backend.writesTo("leave_coach_channel").length).toBe(1);
    expect(backend.writesTo("leave_coach_channel")[0].body).toEqual({ p_conversation_id: CHAT.channel });
    // The linked channel stays open, now offering to join again.
    await expect(page.getByText("Join to see this channel.")).toBeVisible();
    await expect(threadInput(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Join channel" }).click();
    await expect.poll(() => backend.writesTo("join_coach_channel").length).toBe(1);
    expect(backend.writesTo("join_coach_channel")[0].body).toEqual({ p_conversation_id: CHAT.channel });
    await expect(threadInput(page)).toHaveAttribute("placeholder", "Write to the group");
  });

  test("a community channel's member count opens the member list", async ({ page, backend }) => {
    backend.rpc.get_community_members = [
      { display_name: "Casey Coach", role: "owner", is_you: false, avatar_url: null },
      { display_name: "Pat P.", role: "member", is_you: true, avatar_url: null },
    ];
    await page.goto(`/chat?conversationId=${CHAT.channel}`);
    const title = page.getByText("Casey's Keepers").last();
    const memberCount = page.getByRole("button", { name: "Community · 1 member" });
    await expect(title).toBeVisible();
    await expect(page.getByRole("button", { name: "Leave" })).toBeVisible();
    // Leave and View profile don't squeeze the name block, on phones too (#4, bug 9).
    for (const el of [title, memberCount]) {
      expect((await el.boundingBox())?.width ?? 0).toBeGreaterThan(80);
    }
    await memberCount.click();
    const members = page.getByRole("dialog", { name: "Community members" });
    await expect(members.getByText("Pat P.")).toBeVisible();
    await expect(members.getByText("Casey Coach")).toBeVisible();
    expect(backend.writesTo("get_community_members")[0].body).toEqual({ p_conversation_id: CHAT.channel });
  });

  // With another thread open, New message (a new ?conversationId= link) opens the picked chat.
  test("New message picks a coach and opens the existing chat", async ({ page, backend }) => {
    backend.rpc.get_athlete_home = { athlete: null, next: null, focus: null, coaches: [{ id: IDS.coach, name: "Casey Coach", slug: IDS.coachSlug, photo: null, next_date: null, credits_left: 0 }] };
    await page.goto(`/chat?conversationId=${CHAT.other}`);
    await expect(page.getByText("Can we book another keeper session?")).toBeVisible();
    await openList(page);
    await page.getByRole("button", { name: "New message" }).click();
    const dialog = page.getByRole("dialog", { name: "New message" });
    await dialog.getByRole("button", { name: "Casey Coach" }).click();
    await expect(page).toHaveURL(new RegExp(`/chat\\?conversationId=${CHAT.direct}$`));
    // An existing chat is reused, not duplicated.
    expect(backend.writesTo("conversations", "POST")).toHaveLength(0);
    await expect(page.getByText("Great work on first touch today.")).toBeVisible();
    await expect(page.getByText("Can we book another keeper session?")).toHaveCount(0);
    await expect(threadInput(page)).toHaveAttribute("placeholder", "Write to Casey");
  });

  test("after a ?conversationId= link, picking another chat from the list keeps it open", async ({ page }) => {
    await page.goto(`/chat?conversationId=${CHAT.other}`);
    await expect(page.getByText("Can we book another keeper session?")).toBeVisible();
    await openList(page);
    await listRow(page, "Casey Coach").click();
    await expect(threadInput(page)).toHaveAttribute("placeholder", "Write to Casey");
    await expect(page.getByText("Great work on first touch today.")).toBeVisible();
    // A later refresh of the list doesn't snap back to the linked conversation.
    await page.waitForTimeout(500);
    await expect(threadInput(page)).toHaveAttribute("placeholder", "Write to Casey");
  });
});

test.describe("messages as a parent with no chats yet", () => {
  test.beforeEach(async ({ page, backend, as }) => {
    await embedConversations(page, backend);
    await as(page, "parent");
  });

  test("New message starts a chat with a coach", async ({ page, backend }) => {
    backend.rpc.get_athlete_home = { athlete: null, next: null, focus: null, coaches: [{ id: IDS.coach, name: "Casey Coach", slug: IDS.coachSlug, photo: null, next_date: null, credits_left: 2 }] };
    await page.goto("/chat");
    await expect(page.getByRole("heading", { name: "No conversations yet" })).toBeVisible();
    await openList(page);
    await page.getByRole("button", { name: "New message" }).click();
    await page.getByRole("dialog", { name: "New message" }).getByRole("button", { name: "Casey Coach" }).click();

    await expect(page).toHaveURL(/\/chat\?conversationId=[0-9a-f-]{36}$/);
    const id = new URL(page.url()).searchParams.get("conversationId");
    expect(backend.writesTo("conversations", "POST")[0].body).toEqual({ id, created_by: IDS.parentUser, title: "Casey Coach", is_group: false });
    expect(backend.writesTo("conversation_participants", "POST")[0].body).toEqual([
      { conversation_id: id, user_id: IDS.parentUser, role: "owner" },
      { conversation_id: id, user_id: IDS.coachUser, role: "member" },
    ]);
    await expect(page.getByText("No messages yet. Send the first one below.")).toBeVisible();
    await expect(threadInput(page)).toHaveAttribute("placeholder", "Write to Casey");

    await threadInput(page).fill("Hi Casey, is Saturday open?");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect.poll(() => backend.writesTo("messages", "POST").length).toBe(1);
    expect(backend.writesTo("messages", "POST")[0].body).toEqual({ conversation_id: id, sender_id: IDS.parentUser, body: "Hi Casey, is Saturday open?" });
    await expect(page.getByText("No messages yet. Send the first one below.")).toHaveCount(0);
  });

  test("the first message in a new chat emails the coach", async ({ page, backend }) => {
    backend.rpc.get_athlete_home = { athlete: null, next: null, focus: null, coaches: [{ id: IDS.coach, name: "Casey Coach", slug: IDS.coachSlug, photo: null, next_date: null, credits_left: 2 }] };
    await page.goto("/chat");
    await openList(page);
    await page.getByRole("button", { name: "New message" }).click();
    await page.getByRole("dialog", { name: "New message" }).getByRole("button", { name: "Casey Coach" }).click();
    await expect(page).toHaveURL(/\/chat\?conversationId=[0-9a-f-]{36}$/);
    const id = new URL(page.url()).searchParams.get("conversationId");
    await threadInput(page).fill("Hi Casey, is Saturday open?");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect.poll(() => backend.writesTo("send-conversation-email").length).toBe(1);
    expect(backend.writesTo("send-conversation-email")[0].body).toMatchObject({
      conversationId: id,
      actorId: IDS.parentUser,
      messageBody: "Hi Casey, is Saturday open?",
      first_message: true,
      first_reply: false,
    });
    // Only the first message emails: a second one doesn't.
    await threadInput(page).fill("Or Sunday?");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect.poll(() => backend.writesTo("messages", "POST").length).toBe(2);
    await page.waitForTimeout(300);
    expect(backend.writesTo("send-conversation-email")).toHaveLength(1);
  });

  test("New message with no coaches points to the directory", async ({ page }) => {
    await page.goto("/chat");
    await openList(page);
    await page.getByRole("button", { name: "New message" }).click();
    const dialog = page.getByRole("dialog", { name: "New message" });
    await expect(dialog.getByText(/Book a session first to message from here/)).toBeVisible();
    await dialog.getByRole("link", { name: "Browse coaches" }).click();
    await expect(page).toHaveURL(/\/coaches$/);
  });
});

test.describe("messages as a coach", () => {
  test.beforeEach(async ({ page, backend, as }) => {
    seedParentInbox(backend);
    backend.rpc.get_conversation_context = (args) => (args.p_conversation_id === CHAT.direct ? coachContext : null);
    backend.rpc.get_conversation_safeguard = (args) => (args.p_conversation_id === CHAT.direct ? safeguard(false) : null);
    await embedConversations(page, backend);
    await as(page, "coach");
  });

  test("a family chat shows who it's about, the shortcuts and the safeguarding note", async ({ page }) => {
    await page.goto(`/chat?conversationId=${CHAT.direct}`);
    await expect(page.getByText("Parent of Ava Patel, 13")).toBeVisible();
    await expect(page.getByText("Ava is under 18. You're messaging Pat Parent, Ava's parent or guardian, who is part of every message about Ava.")).toBeVisible();
    await expect(threadInput(page)).toHaveAttribute("placeholder", "Write to Pat");
    // Casey's own messages are on the right with "Sent".
    await expect(page.getByText("Sent").first()).toBeVisible();

    if (!isPhone(page)) {
      await expect(page.getByRole("link", { name: "Ava's profile" })).toHaveAttribute("href", `/athletes/${IDS.athlete}`);
      await expect(page.getByRole("button", { name: "Book session" })).toBeVisible();
    }

    await page.getByRole("button", { name: "Share session notes" }).click();
    await expect(threadInput(page)).toHaveValue(new RegExp(`^Session notes from .+: Worked on weak-foot passing\\. See them here: .+/sessions/${IDS.appointment}$`));
  });

  test("Suggest times adds picked open times to the message", async ({ page, backend }) => {
    const day = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    backend.rpc.get_roster_open_times = [
      { id: "0000e2e0-0000-4000-8000-00000000aa01", date: day, startTime: "15:00", endTime: "16:00", price: 80, place: null, suggested: true },
      { id: "0000e2e0-0000-4000-8000-00000000aa02", date: day, startTime: "17:00", endTime: "18:00", price: 80, place: null, suggested: false },
    ];
    await page.goto(`/chat?conversationId=${CHAT.direct}`);
    await page.getByRole("button", { name: "Suggest times" }).click();
    const dialog = page.getByRole("dialog", { name: "Suggest times" });
    const add = dialog.getByRole("button", { name: "Add to message" });
    await expect(add).toBeDisabled();
    const times = dialog.locator("button[aria-pressed]");
    // When the open-times contract differs from this fixture the list is empty; say so plainly.
    await expect(times.first(), "open 1-on-1 times listed").toBeVisible();
    await times.first().click();
    await expect(times.first()).toHaveAttribute("aria-pressed", "true");
    await add.click();
    await expect(threadInput(page)).toHaveValue(/^These times work for me: .+\. Book one here: .+\/book$/);
  });

  test("New channel creates a channel and opens it", async ({ page, backend }) => {
    handleCreateChannel(backend);
    await page.goto("/chat");
    await openList(page);
    await page.getByRole("button", { name: "New channel" }).click();
    const dialog = page.getByRole("dialog", { name: "New channel" });
    const create = dialog.getByRole("button", { name: "Create channel" });
    await expect(create).toBeDisabled();
    await dialog.getByLabel("Channel name").fill("Saturday squad");
    await dialog.getByLabel("What it is for (optional)").fill("Weekend group sessions");
    await create.click();

    await expect(page.getByText("#Saturday squad created").first()).toBeVisible();
    expect(backend.writesTo("create_coach_channel")[0].body).toEqual({ p_title: "Saturday squad", p_description: "Weekend group sessions" });
    await expect(threadInput(page)).toHaveAttribute("placeholder", "Write to the group");
    await expect(page.getByRole("button", { name: "Community · 0 members" })).toBeVisible();
    // The owner can't leave their own channel.
    await expect(page.getByRole("button", { name: "Leave" })).toHaveCount(0);
  });
});

test.describe("messages layout", () => {
  test.beforeEach(async ({ page, backend, as }) => {
    seedParentInbox(backend);
    await embedConversations(page, backend);
    await as(page, "parent");
  });

  test("phone: the thread shows first, the list opens as a drawer and closes on pick", async ({ page }) => {
    test.skip(!isPhone(page), "phone layout");
    await page.goto("/chat");
    await expect(page.getByText("Great work on first touch today.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Messages" })).not.toBeInViewport();

    await page.getByRole("button", { name: "Open conversations" }).click();
    await expect(page.getByRole("heading", { name: "Messages" })).toBeInViewport();
    await expect(threadInput(page)).toBeHidden();

    await listRow(page, "Jordan Lee").click();
    await expect(page.getByRole("heading", { name: "Messages" })).not.toBeInViewport();
    await expect(page.getByText("Can we book another keeper session?")).toBeVisible();
    await expect(threadInput(page)).toBeVisible();
  });

  test("phone: back leaves Messages", async ({ page }) => {
    test.skip(!isPhone(page), "phone layout");
    await page.goto("/dashboard");
    await page.goto("/chat");
    await expect(page.getByText("Great work on first touch today.")).toBeVisible();
    await page.getByRole("button", { name: "Go back" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("desktop: list and thread sit side by side", async ({ page }) => {
    test.skip(isPhone(page), "desktop layout");
    await page.goto("/chat");
    await expect(page.getByRole("heading", { name: "Messages" })).toBeInViewport();
    await expect(page.getByText("Great work on first touch today.")).toBeInViewport();
    await expect(page.getByRole("button", { name: "Open conversations" })).toHaveCount(0);
  });
});
