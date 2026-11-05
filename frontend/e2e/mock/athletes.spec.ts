import type { Page } from "@playwright/test";
import { test, expect } from "./test";
import { IDS } from "./personas";
import { isPhone } from "./helpers";
import { AVA_SESSIONS, INVITES, OPEN_TIMES, ROSTER, clockOf, seedBooking, seedInvites, seedRoster, shortDayOf } from "./data/athletes";

// My athletes (/athletes) and one athlete's page (/athletes/:id) for Casey Coach: the roster with
// search, pillar filter and sort; the invites view; adding families; the athlete page with the
// sessions list, goal, private note, package in progress, booking from the roster and Message.

/** A roster row (the whole row is a button that opens the athlete). */
const rosterRow = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name}`) });

test.describe("my athletes roster", () => {
  test.beforeEach(async ({ page, backend, as }) => {
    seedRoster(backend);
    await as(page, "coach");
  });

  test("lists the roster with next session, package and camp badge", async ({ page }) => {
    await page.goto("/athletes");
    await expect(page.getByRole("heading", { name: "My athletes" })).toBeVisible();
    await expect(page.getByText("3 athletes", { exact: true })).toBeVisible();
    await expect(rosterRow(page, "Ava Martinez")).toBeVisible();
    await expect(rosterRow(page, "Ben Carter")).toBeVisible();
    await expect(rosterRow(page, "Chloe Diaz")).toBeVisible();
    await expect(page.getByText("Showing 3 of 3 · sorted by name a–z")).toBeVisible();

    const ava = rosterRow(page, "Ava Martinez");
    const next = AVA_SESSIONS.upcoming;
    await expect(ava).toContainText(`${shortDayOf(next.date, next.startTime)}, ${clockOf(next.date, next.startTime)}`);
    await expect(rosterRow(page, "Ben Carter")).toContainText("Not booked");
    await expect(rosterRow(page, "Chloe Diaz").getByText("Camp", { exact: true })).toBeVisible();
    if (isPhone(page)) {
      // Phone shows credits as a pill and the position on the second line.
      await expect(ava.getByText("3 credits")).toBeVisible();
      await expect(ava).toContainText("· Midfield");
    } else {
      await expect(ava.getByText("3 of 8 left")).toBeVisible();
      await expect(ava.getByText("12 · Rovers U13 · parent Maria Martinez")).toBeVisible();
      await expect(rosterRow(page, "Chloe Diaz").getByText("19 · 18+ · Account not set up yet")).toBeVisible();
    }
  });

  test("searches by athlete or parent, filters by pillar and clears filters", async ({ page }) => {
    await page.goto("/athletes");
    const search = page.getByPlaceholder("Search athletes or parents");
    await search.fill("dana");
    await expect(rosterRow(page, "Ben Carter")).toBeVisible();
    await expect(rosterRow(page, "Ava Martinez")).toBeHidden();
    await expect(page.getByText("Showing 1 of 3")).toBeVisible();

    await search.fill("nobody here");
    await expect(page.getByText("No athletes match.")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(search).toHaveValue("");
    await expect(page.getByText("Showing 3 of 3")).toBeVisible();

    // Pillars are the coach's own specialties (Technique).
    const pillar = page.getByRole("combobox", { name: "Pillar" });
    await expect(pillar.locator("option")).toHaveText(["All pillars", "Technique"]);
    await pillar.selectOption("Technique");
    await expect(rosterRow(page, "Ava Martinez")).toBeVisible();
    await expect(rosterRow(page, "Ben Carter")).toBeHidden();
    await expect(rosterRow(page, "Chloe Diaz")).toBeHidden();
  });

  test("sorts by next session and newest", async ({ page }) => {
    await page.goto("/athletes");
    const rows = page.locator("[role=button][tabindex='0']");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("Ava Martinez");
    await page.getByRole("combobox", { name: "Sort by" }).selectOption("newest");
    await expect(rows.nth(0)).toContainText("Chloe Diaz");
    await expect(page.getByText("sorted by newest")).toBeVisible();
    await page.getByRole("combobox", { name: "Sort by" }).selectOption("next");
    await expect(rows.nth(0)).toContainText("Ava Martinez");
    if (!isPhone(page)) {
      // Clicking the sorted column header reverses it.
      await page.getByRole("button", { name: "Next session" }).click();
      await expect(page.getByText("sorted by next session, reversed")).toBeVisible();
      await expect(rows.nth(2)).toContainText("Ava Martinez");
    }
  });

  test("opens an athlete from the roster", async ({ page }) => {
    await page.goto("/athletes");
    await rosterRow(page, "Ava Martinez").click();
    await expect(page).toHaveURL(new RegExp(`/athletes/${ROSTER.ava}$`));
    await expect(page.getByRole("heading", { name: "Ava Martinez", level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/athletes$/);
  });

  test("empty roster offers the invite link and Invite families", async ({ page, backend }) => {
    backend.rpc.get_coach_roster = [];
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/athletes");
    await expect(page.getByText("Bring your athletes to AthaNext")).toBeVisible();
    await expect(page.getByText("Nobody on your roster yet")).toBeVisible();
    await page.getByRole("button", { name: "Copy invite link" }).click();
    await expect(page.getByText("Link copied", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Invite families" }).click();
    await expect(page.getByRole("dialog", { name: "Add athlete" })).toBeVisible();
  });
});

test.describe("add athlete", () => {
  test.beforeEach(async ({ page, backend, as }) => {
    seedRoster(backend);
    seedInvites(backend);
    await as(page, "coach");
  });

  test("invites two families by email and sends both to add-client-referral", async ({ page, backend }) => {
    await page.goto("/athletes");
    await page.getByRole("button", { name: "Add athlete" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Add athlete" });
    const send = dialog.getByRole("button", { name: /^Send/ });
    await expect(send).toBeDisabled();

    await dialog.getByLabel("Name", { exact: true }).fill("Rosa Diaz");
    await dialog.getByLabel("Email", { exact: true }).fill("rosa@");
    // An unfinished email keeps Send off.
    await expect(send).toBeDisabled();
    await dialog.getByLabel("Email", { exact: true }).first().fill("rosa@e2e.test");
    await dialog.getByLabel(/Athlete first name/).first().fill("Lu");
    await expect(send).toHaveText("Send invite");

    await dialog.getByRole("button", { name: "Add another family" }).click();
    await expect(dialog.getByText("Family 2")).toBeVisible();
    await dialog.getByLabel("Name", { exact: true }).nth(1).fill("Omar Haddad");
    await dialog.getByLabel("Email", { exact: true }).nth(1).fill("omar@e2e.test");
    await expect(send).toHaveText("Send 2 invites");
    await send.click();

    await expect(page.getByText("2 invites sent").first()).toBeVisible();
    await expect(dialog).toBeHidden();
    const call = backend.writesTo("add-client-referral").at(-1)!;
    expect(call.body).toEqual({
      clients: [
        { name: "Rosa Diaz", email: "rosa@e2e.test", athlete_first_name: "Lu" },
        { name: "Omar Haddad", email: "omar@e2e.test" },
      ],
    });
  });

  test("imports a pasted list and skips bad rows", async ({ page, backend }) => {
    await page.goto("/athletes");
    await page.getByRole("button", { name: "Add athlete" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Add athlete" });
    await dialog.getByRole("tab", { name: "Import a list" }).click();
    await dialog.getByLabel("Paste from a spreadsheet").fill("Maria Gomez, maria.gomez@e2e.test, Leo\nNo Email Person, not-an-email, Kai");
    await expect(dialog.getByLabel("Ready")).toHaveCount(1);
    await expect(dialog.getByLabel("Skipped")).toHaveCount(1);
    await dialog.getByRole("button", { name: "Send 1 invite" }).click();
    await expect(page.getByText("1 invite sent").first()).toBeVisible();
    expect(backend.writesTo("add-client-referral").at(-1)!.body).toEqual({
      clients: [{ name: "Maria Gomez", email: "maria.gomez@e2e.test", athlete_first_name: "Leo" }],
    });
  });
});

test.describe("invites view", () => {
  test.beforeEach(async ({ page, backend, as }) => {
    seedRoster(backend);
    seedInvites(backend);
    await as(page, "coach");
  });

  test("shows pending invites from the roster and the work list", async ({ page }) => {
    await page.goto("/athletes");
    // Approval, sent and bounced are pending; joined is not.
    await page.getByRole("button", { name: "3 pending invites" }).click();
    await expect(page).toHaveURL(/\/athletes\?tab=invites$/);
    await expect(page.getByText("Bring your clients to AthaNext")).toBeVisible();
    await expect(page.getByText("1 of 4", { exact: true })).toBeVisible();
    await expect(page.getByText("1 invite waiting, 1 needs your approval")).toBeVisible();

    const filters = page.getByRole("group", { name: "Filter invites" });
    await expect(filters.getByRole("button", { name: "Needs approval 1" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("row", { name: /Sam Lee/ })).toContainText("Needs approval");
    await expect(page.getByRole("row", { name: /Sam Lee/ })).toContainText("Mia, 11");

    await filters.getByRole("button", { name: /^Waiting/ }).click();
    await expect(page.getByRole("row", { name: /Olga Novak/ })).toContainText("Invite sent");
    await expect(page.getByRole("row", { name: /Tom Reed/ })).toContainText("Email bounced");
    await expect(page.getByRole("row", { name: /Sam Lee/ })).toHaveCount(0);

    await filters.getByRole("button", { name: "Joined 1" }).click();
    await expect(page.getByRole("row", { name: /Kim Park/ })).toContainText("Joined");

    await page.getByRole("button", { name: "All athletes" }).click();
    await expect(page).toHaveURL(/\/athletes$/);
  });

  test("approves a link sign-up", async ({ page, backend }) => {
    await page.goto("/athletes?tab=invites");
    await page.getByRole("row", { name: /Sam Lee/ }).getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Sam Lee approved").first()).toBeVisible();
    expect(backend.writesTo("acknowledge_coach_referral").at(-1)!.body).toEqual({ _referral_id: INVITES.approval, _accept: true });
  });

  test("declines a link sign-up after confirming", async ({ page, backend }) => {
    await page.goto("/athletes?tab=invites");
    await page.getByRole("row", { name: /Sam Lee/ }).getByRole("button", { name: "Decline" }).click();
    const dialog = page.getByRole("dialog", { name: "Decline this sign-up?" });
    await dialog.getByRole("button", { name: "Decline" }).click();
    await expect(page.getByText("Sign-up declined").first()).toBeVisible();
    expect(backend.writesTo("acknowledge_coach_referral").at(-1)!.body).toEqual({ _referral_id: INVITES.approval, _accept: false });
  });

  test("resends a waiting invite", async ({ page, backend }) => {
    await page.goto("/athletes?tab=invites");
    await page.getByRole("group", { name: "Filter invites" }).getByRole("button", { name: /^Waiting/ }).click();
    await page.getByRole("row", { name: /Olga Novak/ }).getByRole("button", { name: "Resend invite" }).click();
    await expect(page.getByText("Invite resent to Olga Novak").first()).toBeVisible();
    expect(backend.writesTo("add-client-referral").at(-1)!.body).toEqual({ action: "resend", referral_id: INVITES.sent });
  });

  test("fixes a bounced email: validates, saves the address and resends", async ({ page, backend }) => {
    await page.goto("/athletes?tab=invites");
    await page.getByRole("group", { name: "Filter invites" }).getByRole("button", { name: /^Waiting/ }).click();
    await page.getByRole("row", { name: /Tom Reed/ }).getByRole("button", { name: "Fix email" }).click();
    const dialog = page.getByRole("dialog", { name: "Fix email address" });
    await expect(dialog.getByText("The invite to Tom Reed bounced")).toBeVisible();
    const email = dialog.getByLabel("Parent email");
    await expect(email).toHaveValue("tom@typo.test");

    await email.fill("tom@");
    await dialog.getByRole("button", { name: "Save and resend" }).click();
    await expect(dialog.getByText("Enter a valid email")).toBeVisible();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    expect(backend.writesTo("coach_fix_invite_email")).toHaveLength(0);

    await email.fill("tom@e2e.test");
    await dialog.getByRole("button", { name: "Save and resend" }).click();
    await expect(page.getByText("New invite sent").first()).toBeVisible();
    await expect(dialog).toBeHidden();
    expect(backend.writesTo("coach_fix_invite_email")[0].body).toEqual({ p_referral_id: INVITES.bounced, p_email: "tom@e2e.test" });
    expect(backend.writesTo("add-client-referral").at(-1)!.body).toEqual({ action: "resend", referral_id: INVITES.bounced });
  });

  test("/invites redirects to the invites view", async ({ page }) => {
    await page.goto("/invites");
    await expect(page).toHaveURL(/\/athletes\?tab=invites$/);
    await expect(page.getByText("How no-fee clients work")).toBeVisible();
  });
});

test.describe("athlete page", () => {
  test.beforeEach(async ({ page, backend, as }) => {
    seedRoster(backend);
    seedBooking(backend);
    await as(page, "coach");
  });

  test("shows the athlete, stats, sessions, family contact and goal", async ({ page }) => {
    await page.goto(`/athletes/${ROSTER.ava}`);
    await expect(page.getByRole("heading", { name: "Ava Martinez", level: 1 })).toBeVisible();
    await expect(page.getByText("12 · Rovers U13 · Midfield")).toBeVisible();

    // Stats strip: next session, credits, sessions so far.
    await expect(page.getByText("3 left")).toBeVisible();
    await expect(page.getByText(/^Expires /)).toBeVisible();
    await expect(page.getByText("Since Mar 2025")).toBeVisible();
    await expect(page.getByText("Since Mar 2025").locator("..")).toContainText("12");

    // Upcoming links to the session; previous sessions show the summary or Add feedback.
    const upcoming = page.getByRole("link", { name: new RegExp(`Technique ${clockOf(AVA_SESSIONS.upcoming.date, "10:00:00")} · Central Park`) });
    await expect(upcoming).toHaveAttribute("href", `/sessions/${AVA_SESSIONS.upcoming.id}`);
    await expect(page.getByText("Sharp first touch, worked on weak-foot passing.")).toBeVisible();
    await expect(page.getByText("Next: Weak-foot volleys")).toBeVisible();
    await expect(page.getByText("Feedback due")).toBeVisible();
    await expect(page.getByRole("link", { name: "Add feedback" })).toHaveAttribute("href", `/coach-session-feedback?slotId=${AVA_SESSIONS.feedbackDue.id}`);

    // Minor: the parent is the contact.
    await expect(page.getByText("Family", { exact: true })).toBeVisible();
    await expect(page.getByText("Maria Martinez")).toBeVisible();
    await expect(page.getByText("Mother · gets every message about Ava")).toBeVisible();
    await expect(page.getByText("maria@e2e.test")).toBeVisible();
    await expect(page.getByText("+1 555 555 0111")).toBeVisible();

    await expect(page.getByText("Make the regional team")).toBeVisible();
    await expect(page.getByPlaceholder("Anything to remember about Ava")).toHaveValue("Loves the left wing.");
    await expect(page.getByText("No package on file yet.")).toBeVisible();
  });

  test("saves the private note when the field loses focus", async ({ page, backend }) => {
    await page.goto(`/athletes/${ROSTER.ava}`);
    const note = page.getByPlaceholder("Anything to remember about Ava");
    await expect(note).toHaveValue("Loves the left wing.");
    // Leaving it unchanged doesn't save.
    await note.focus();
    await note.blur();
    await note.fill("Prefers morning sessions.");
    await note.blur();
    await expect.poll(() => backend.writesTo("set_coach_athlete_note").length).toBe(1);
    expect(backend.writesTo("set_coach_athlete_note")[0].body).toEqual({ p_athlete_id: ROSTER.ava, p_note: "Prefers morning sessions." });
  });

  test("edits the season goal", async ({ page, backend }) => {
    await page.goto(`/athletes/${ROSTER.ava}`);
    await page.getByRole("button", { name: "Edit goal" }).click();
    const dialog = page.getByRole("dialog", { name: "Goal for Ava" });
    const goal = dialog.getByLabel("Season goal");
    await expect(goal).toHaveValue("Make the regional team");
    await goal.fill("  Start every league game  ");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Goal saved").first()).toBeVisible();
    await expect(dialog).toBeHidden();
    expect(backend.writesTo("set_coach_athlete_goal")[0].body).toEqual({ p_athlete_id: ROSTER.ava, p_goal: "Start every league game" });
    // The page reads the athlete again and shows the new goal.
    await expect(page.getByText("Start every league game")).toBeVisible();
  });

  test("adds a package already in progress", async ({ page, backend }) => {
    await page.goto(`/athletes/${ROSTER.ava}`);
    await page.getByRole("button", { name: "Add a package in progress" }).click();
    const dialog = page.getByRole("dialog", { name: "Add a package in progress" });
    await expect(dialog.getByRole("combobox")).toHaveValue(ROSTER.package);
    await expect(dialog.getByLabel("Sessions in the package")).toHaveValue("8");
    await dialog.getByRole("button", { name: "More used" }).click();
    await dialog.getByRole("button", { name: "More used" }).click();
    await expect(dialog.getByText("6 of 8 sessions left.")).toBeVisible();
    // Ava's family was invited, so Still owed is offered.
    await dialog.getByRole("button", { name: "Still owed", exact: true }).click();
    await dialog.getByRole("button", { name: "Save package" }).click();
    await expect(page.getByText("Package saved").first()).toBeVisible();
    expect(backend.writesTo("upsert_package_in_progress")[0].body).toEqual({
      p_athlete_id: ROSTER.ava,
      p_package_id: ROSTER.package,
      p_custom_name: null,
      p_sessions_total: 8,
      p_prior_used: 2,
      p_price: 560,
      p_outside: "owed",
    });
  });

  test("a custom package needs a name before it saves", async ({ page }) => {
    await page.goto(`/athletes/${ROSTER.ava}`);
    await page.getByRole("button", { name: "Add a package in progress" }).click();
    const dialog = page.getByRole("dialog", { name: "Add a package in progress" });
    await dialog.getByRole("combobox").selectOption({ label: "Something else" });
    const save = dialog.getByRole("button", { name: "Save package" });
    await expect(save).toBeDisabled();
    await dialog.getByLabel("Name", { exact: true }).fill("Summer 5-pack");
    await expect(save).toBeEnabled();
  });

  test("books the usual time with a credit, then undoes it", async ({ page, backend }) => {
    await page.goto(`/athletes/${ROSTER.ava}`);
    await page.getByRole("button", { name: "Book session" }).click();
    const dialog = page.getByRole("dialog", { name: "Book Ava" });
    const usual = OPEN_TIMES[0];
    const when = `${shortDayOf(usual.date, usual.startTime)} at ${clockOf(usual.date, usual.startTime)}`;
    const times = dialog.getByRole("radiogroup", { name: "Suggested times" }).getByRole("radio");
    await expect(times).toHaveCount(3);
    await expect(times.nth(0)).toHaveAttribute("aria-checked", "true");
    await expect(times.nth(0)).toContainText("Usual time · 60 min");
    await expect(dialog.getByText("Individual session · Central Park · Uses 1 of 3 credits")).toBeVisible();

    await dialog.getByRole("button", { name: `Book ${when}` }).click();
    await expect(page.getByText(`Booked Ava for ${when}`).first()).toBeVisible();
    await expect(page.getByText("Paid with 1 credit").first()).toBeVisible();
    expect(backend.writesTo("coach_book_athlete")[0].body).toEqual({ p_athlete_id: ROSTER.ava, p_occurrence_ids: [usual.id], p_payment: "credit" });
    // The confirmation email is queued with the new booking ids.
    await expect
      .poll(() => backend.writesTo("create-booking-payment-v0").map((w) => w.body as { action: string; booking_ids: string[] }).find((b) => b.action === "notify_booked")?.booking_ids.length)
      .toBe(1);

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText("Booking undone").first()).toBeVisible();
    const booked = (backend.writesTo("coach_book_athlete")[0].body as { p_occurrence_ids: string[] }).p_occurrence_ids;
    expect(booked).toHaveLength(1);
    expect((backend.writesTo("coach_undo_booking")[0].body as { p_booking_ids: string[] }).p_booking_ids).toHaveLength(1);
  });

  test("picks another suggested time and pays outside AthaNext", async ({ page, backend }) => {
    await page.goto(`/athletes/${ROSTER.ava}`);
    await page.getByRole("button", { name: "Book session" }).click();
    const dialog = page.getByRole("dialog", { name: "Book Ava" });
    const second = OPEN_TIMES[1];
    await dialog.getByRole("radio").nth(1).click();
    await expect(dialog.getByText(/Video call · Uses 1 of 3 credits/)).toBeVisible();
    // Change cycles credit -> payment link -> paid outside.
    await dialog.getByRole("button", { name: "Change" }).click();
    await expect(dialog.getByText("Payment link to Maria · $80")).toBeVisible();
    await expect(dialog.getByRole("button", { name: /^Send / })).toBeVisible();
    await dialog.getByRole("button", { name: "Change" }).click();
    await expect(dialog.getByText(/Paid outside AthaNext/)).toBeVisible();
    await dialog.getByRole("button", { name: `Book ${shortDayOf(second.date, second.startTime)} at ${clockOf(second.date, second.startTime)}` }).click();
    await expect(page.getByText(/^Booked Ava for /).first()).toBeVisible();
    expect(backend.writesTo("coach_book_athlete")[0].body).toEqual({ p_athlete_id: ROSTER.ava, p_occurrence_ids: [second.id], p_payment: "outside" });
  });

  test("sends a payment link when there are no credits", async ({ page, backend }) => {
    seedBooking(backend, { credits: 0, own_client: false });
    await page.goto(`/athletes/${ROSTER.ava}`);
    await page.getByRole("button", { name: "Book session" }).click();
    const dialog = page.getByRole("dialog", { name: "Book Ava" });
    await expect(dialog.getByText("Individual session · Central Park · Payment link to Maria · $80")).toBeVisible();
    // Only one way to pay: no Change.
    await expect(dialog.getByRole("button", { name: "Change" })).toHaveCount(0);
    await dialog.getByRole("button", { name: /^Send / }).click();
    await expect(page.getByText(/^Sent .* to Maria$/).first()).toBeVisible();
    const offer = backend.writesTo("schedule_offer_session")[0].body as Record<string, unknown>;
    expect(offer).toMatchObject({ p_occurrence_ids: [OPEN_TIMES[0].id], p_athlete_ids: [ROSTER.ava], p_post_to_channel: false });
    expect(String(offer.p_message)).toContain(`?session=${OPEN_TIMES[0].id}`);
    expect(backend.writesTo("coach_book_athlete")).toHaveLength(0);
  });

  test("books several times from the week picker", async ({ page, backend }) => {
    await page.goto(`/athletes/${ROSTER.ava}`);
    await page.getByRole("button", { name: "Book session" }).click();
    await page.getByRole("button", { name: "Pick another time or several" }).click();
    const dialog = page.getByRole("dialog", { name: "Pick times for Ava" });
    const [first, second] = OPEN_TIMES;
    // The first open day is picked; choose its time, then another day's.
    await dialog.getByRole("button", { name: new RegExp(`^${clockOf(first.date, first.startTime)}`) }).click();
    const secondDay = new Date(`${second.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
    await dialog.getByRole("button", { name: secondDay }).click();
    await dialog.getByRole("button", { name: new RegExp(`^${clockOf(second.date, second.startTime)}`) }).click();
    await expect(dialog.getByText("2 sessions · 2 credits")).toBeVisible();
    await dialog.getByRole("button", { name: "Continue" }).click();

    const review = page.getByRole("dialog", { name: "Review and book" });
    await expect(review.getByText("Credit", { exact: true })).toHaveCount(2);
    await review.getByRole("button", { name: "Book 2 sessions for Ava" }).click();
    await expect(page.getByText("2 sessions booked for Ava").first()).toBeVisible();
    expect(backend.writesTo("coach_book_athlete")[0].body).toEqual({ p_athlete_id: ROSTER.ava, p_occurrence_ids: [first.id, second.id], p_payment: "credit" });
  });

  test("books from the roster's Book button", async ({ page, backend }) => {
    await page.goto("/athletes");
    await page.getByRole("button", { name: "Book Ava Martinez", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Book Ava" });
    await expect(dialog.getByText("3 credits left")).toBeVisible();
    await dialog.getByRole("button", { name: /^Book .* at / }).click();
    await expect(page.getByText(/^Booked Ava for /).first()).toBeVisible();
    expect(backend.writesTo("coach_book_athlete")).toHaveLength(1);
  });

  test("Message opens the family's conversation", async ({ page, backend }) => {
    await page.goto(`/athletes/${ROSTER.ava}`);
    await page.getByRole("button", { name: "Message" }).first().click();
    await expect(page).toHaveURL(new RegExp(`/chat\\?conversationId=${ROSTER.conversation}$`));
    expect(backend.writesTo("open_family_conversation")[0].body).toEqual({ p_athlete_id: ROSTER.ava });
  });

  test("an adult athlete is their own contact and shows Pay per session", async ({ page }) => {
    await page.goto(`/athletes/${ROSTER.chloe}`);
    await expect(page.getByRole("heading", { name: "Chloe Diaz", level: 1 })).toBeVisible();
    await expect(page.getByText("Contact", { exact: true })).toBeVisible();
    await expect(page.getByText("Manages their own account")).toBeVisible();
    await expect(page.getByText("Pay per session")).toBeVisible();
    await expect(page.getByText("Nothing booked.")).toBeVisible();
    await expect(page.getByText("No sessions yet.")).toBeVisible();
  });

  test("an athlete who isn't on the roster shows Athlete not found", async ({ page, backend }) => {
    await page.goto(`/athletes/${ROSTER.unknown}`);
    // React Query retries three times before giving up.
    await expect(page.getByText("Athlete not found")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("They may have left your roster.")).toBeVisible();
    await page.getByRole("link", { name: "Back to My athletes" }).click();
    await expect(page).toHaveURL(/\/athletes$/);
    expect(backend.writesTo("get_coach_athlete").some((w) => (w.body as { p_athlete_id: string }).p_athlete_id === ROSTER.unknown)).toBe(true);
  });
});

test("parents are sent to Book from an athlete page", async ({ page, backend, as }) => {
  seedRoster(backend);
  await as(page, "parent");
  await page.goto(`/athletes/${IDS.athlete}`);
  await expect(page).toHaveURL(/\/book$/);
  expect(backend.writesTo("get_coach_athlete")).toHaveLength(0);
});
