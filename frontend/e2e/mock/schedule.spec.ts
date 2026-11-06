import { test, expect } from "./test";
import { IDS } from "./personas";
import { isPhone } from "./helpers";
import {
  SCH,
  addDays,
  campGroup,
  coachBooking,
  coachCamp,
  coachSession,
  installCamps,
  installCoachSessions,
  installSchedule,
  mondayOf,
  scheduleBooking,
  scheduleSession,
  shortDay,
  today,
  weeklySeries,
} from "./data/schedule";

// The coach's scheduling pages with data in them: My schedule, Create session, Plan next week,
// Schedule settings, Coach setup and Camps. The route matrix (routes.spec.ts) covers that they open.

const rpcArgs = (backend: { writesTo: (name: string) => { body: unknown }[] }, name: string) =>
  backend.writesTo(name).map((w) => w.body as Record<string, unknown>);

/** The phone opens My schedule on Day view for this Monday; pick today there. The web shows the week. */
const showToday = async (page: import("@playwright/test").Page) => {
  if (!isPhone(page)) return;
  await page.getByRole("button", { name: shortDay(today(), { weekday: "long", month: "long", day: "numeric" }), exact: true }).click();
};

test.describe("My schedule", () => {
  const seedWeek = () => {
    const day = today();
    const monday = mondayOf(day);
    return {
      day,
      monday,
      sessions: [
        scheduleSession({
          id: SCH.booked,
          date: day,
          start_time: "10:00:00",
          bookings: [scheduleBooking({ id: SCH.bookingA, athlete_name: "Alex Athlete" })],
        }),
        scheduleSession({
          id: SCH.group,
          date: day,
          start_time: "17:00:00",
          duration_minutes: 90,
          session_type: "group",
          session_name: "U12 finishing",
          price: 40,
          capacity: 8,
          bookings: [
            scheduleBooking({ id: SCH.bookingB, athlete_id: SCH.athleteB, athlete_name: "Blake Baker" }),
            scheduleBooking({ id: SCH.bookingC, athlete_id: SCH.athleteC, athlete_name: "Cam Cole", payment_status: "unpaid", status: "pending_payment" }),
          ],
        }),
        scheduleSession({
          id: SCH.nextWeek,
          date: addDays(monday, 7),
          start_time: "12:00:00",
          bookings: [scheduleBooking({ id: "00000000-0000-4000-8000-0000000052b9", athlete_id: SCH.athleteB, athlete_name: "Blake Baker" })],
        }),
      ],
    };
  };

  test("shows this week's sessions and opens a booked 1-on-1 on its session page", async ({ page, as, backend }) => {
    const week = seedWeek();
    installSchedule(backend, { sessions: week.sessions, series: [weeklySeries(SCH.seriesMon9, 1, "09:00"), weeklySeries(SCH.seriesMon10, 1, "10:00")] });
    installCoachSessions(backend, [
      coachSession({ id: SCH.booked, date: week.day, start_time: "10:00:00", bookings: [coachBooking({ id: SCH.bookingA })] }),
    ]);
    await as(page, "coach");
    await page.goto("/schedule");

    await expect(page.getByRole("heading", { name: "My schedule" })).toBeVisible();
    // The weekly hours line comes from the repeating series.
    await expect(page.getByRole("button", { name: /your weekly hours: mon, 9 to 11 am/i })).toBeVisible();
    await expect(page.getByText(`${shortDay(week.monday)} – ${shortDay(addDays(week.monday, 6))}`)).toBeVisible();

    // Today's sessions: the phone opens on Day view, the web on Week view.
    await showToday(page);
    const booked = page.getByRole("button", { name: /10:00 am\s*Alex Athlete\s*1-on-1/i });
    const group = page.getByRole("button", { name: /5:00 pm\s*U12 finishing\s*2 of 8 booked/i });
    await expect(booked).toBeVisible();
    await expect(group).toBeVisible();

    // Asked for the visible range with a day either side.
    const asked = rpcArgs(backend, "get_coach_schedule")[0];
    expect(String(asked.p_from) <= week.day && String(asked.p_to) >= week.day).toBe(true);

    await booked.click();
    await expect(page).toHaveURL(new RegExp(`/sessions/${SCH.booked}$`));
    await expect(page.getByText("1-on-1 with Alex Athlete")).toBeVisible();
  });

  test("a group session opens its sheet with who is in it", async ({ page, as, backend }) => {
    installSchedule(backend, { sessions: seedWeek().sessions });
    await as(page, "coach");
    await page.goto("/schedule");
    await showToday(page);
    await page.getByRole("button", { name: /U12 finishing/i }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText("U12 finishing").first()).toBeVisible();
    await expect(sheet.getByText("Blake Baker")).toBeVisible();
    await expect(sheet.getByText("Cam Cole")).toBeVisible();
    await expect(sheet.getByText("Awaiting payment")).toBeVisible();
  });

  test("week arrows move a week at a time and Today comes back", async ({ page, as, backend }) => {
    const week = seedWeek();
    installSchedule(backend, { sessions: week.sessions });
    await as(page, "coach");
    await page.goto("/schedule");
    const thisWeek = `${shortDay(week.monday)} – ${shortDay(addDays(week.monday, 6))}`;
    const nextMonday = addDays(week.monday, 7);
    const nextWeek = `${shortDay(nextMonday)} – ${shortDay(addDays(nextMonday, 6))}`;
    await expect(page.getByText(thisWeek)).toBeVisible();

    await page.getByRole("button", { name: "Next week", exact: true }).click();
    await expect(page.getByText(nextWeek)).toBeVisible();
    // Next week's session (on its Monday, which Day view also lands on).
    await expect(page.getByRole("button", { name: /12:00 pm\s*Blake Baker/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /U12 finishing/i })).toHaveCount(0);
    // The new range was asked for.
    await expect.poll(() => rpcArgs(backend, "get_coach_schedule").some((a) => String(a.p_from) <= nextMonday && String(a.p_to) >= nextMonday)).toBe(true);

    await page.getByRole("button", { name: "Previous week", exact: true }).click();
    await page.getByRole("button", { name: "Previous week", exact: true }).click();
    await expect(page.getByText(`${shortDay(addDays(week.monday, -7))} – ${shortDay(addDays(week.monday, -1))}`)).toBeVisible();
    await page.getByRole("button", { name: "Today", exact: true }).click();
    await expect(page.getByText(thisWeek)).toBeVisible();
  });

  test("Month view counts sessions and a day opens Day view", async ({ page, as, backend }) => {
    const week = seedWeek();
    installSchedule(backend, { sessions: week.sessions });
    await as(page, "coach");
    await page.goto("/schedule");
    await page.getByRole("button", { name: "Month", exact: true }).click();
    const dayName = shortDay(week.day, { weekday: "long", month: "long", day: "numeric" });
    const cell = page.getByRole("button", { name: dayName, exact: true });
    if (!isPhone(page)) await expect(cell).toContainText("2 sessions");
    await cell.click();
    await expect(page.getByRole("heading", { name: dayName })).toBeVisible();
    await expect(page.getByRole("button", { name: /Alex Athlete/ })).toBeVisible();
  });

  test("an open slot can be removed from its dialog", async ({ page, as, backend }) => {
    const tomorrow = addDays(today(), 1);
    installSchedule(backend, {
      sessions: [scheduleSession({ id: SCH.open, date: tomorrow, start_time: "15:00:00", price: 80 })],
    });
    await as(page, "coach");
    // ?day= opens that day in Day view, on the phone and the web.
    await page.goto(`/schedule?day=${tomorrow}`);
    const slot = page.getByRole("button", { name: /3:00 pm\s*Open slot\s*1-on-1 · \$80/i });
    await expect(slot).toBeVisible();
    await slot.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Open slot" })).toBeVisible();
    await expect(dialog.getByText("1-on-1 · 60 min · $80", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Remove this open slot" }).click();
    await expect(page.getByText("Session removed").first()).toBeVisible();
    expect(rpcArgs(backend, "schedule_remove_session")).toEqual([{ p_occurrence_id: SCH.open }]);
    await expect(slot).toHaveCount(0);
  });

  test("booking requests show a banner that opens the requests list", async ({ page, as, backend }) => {
    const tomorrow = addDays(today(), 1);
    installSchedule(backend);
    backend.rpc.get_coach_booking_requests = [
      {
        booking_id: SCH.bookingA,
        occurrence_id: SCH.request,
        athlete_id: IDS.athlete,
        athlete_name: "Alex Athlete",
        session_name: "1-on-1 session",
        session_type: "individual",
        location: "in-person",
        place: "Central Park",
        price: 80,
        occurrence_date: tomorrow,
        start_time: "16:00:00",
        end_time: "17:00:00",
        notes: "Working on first touch",
        requested_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        capacity: 1,
        taken: 0,
      },
    ];
    await as(page, "coach");
    await page.goto("/schedule");
    await page.getByRole("button", { name: /1 booking request waiting/i }).click();
    await expect(page).toHaveURL(/requests=1/);
    await expect(page.getByText("Alex Athlete").first()).toBeVisible();
  });
});

test.describe("Create session", () => {
  const openAdd = async (page: import("@playwright/test").Page, nth = 0) => {
    await expect(page.getByRole("heading", { name: "Create session" })).toBeVisible();
    await page.getByRole("button", { name: "Add", exact: true }).nth(nth).click();
    const sheet = page.getByRole("dialog", { name: "Add a session" });
    await expect(sheet).toBeVisible();
    return sheet;
  };

  test("lists the next 7 days with what is on them", async ({ page, as, backend }) => {
    const day = today();
    installSchedule(backend, {
      sessions: [
        scheduleSession({ id: SCH.group, date: addDays(day, 2), start_time: "17:00:00", session_type: "group", session_name: "U12 finishing", capacity: 8 }),
        scheduleSession({ id: SCH.booked, date: addDays(day, 3), start_time: "10:00:00", bookings: [scheduleBooking({ id: SCH.bookingA })] }),
      ],
    });
    await as(page, "coach");
    await page.goto("/schedule/create");
    await expect(page.getByText(/Today and the next 6 days · 2 sessions on 2 days/)).toBeVisible();
    await expect(page.getByRole("button", { name: /U12 finishing/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous 7 days" })).toBeDisabled();
    await page.getByRole("button", { name: "Next 7 days" }).click();
    await expect(page.getByText(`${shortDay(addDays(day, 7))} to ${shortDay(addDays(day, 13))}`).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /U12 finishing/ })).toHaveCount(0);
  });

  test("adds a group session with a name, spots and price", async ({ page, as, backend }) => {
    const day = today();
    installSchedule(backend);
    await as(page, "coach");
    await page.goto("/schedule/create");
    const sheet = await openAdd(page);

    // Validation: a group needs a name and a price above $0.
    const add = sheet.getByRole("button", { name: "Add group session" });
    await expect(add).toBeDisabled();
    await expect(sheet.getByText("Still missing: a name for the group.")).toBeVisible();
    await expect(sheet.getByText("Name the group so families know what it is.")).toBeVisible();
    await sheet.getByPlaceholder("For example, U10 ball mastery").fill("U10 ball mastery");
    await sheet.getByRole("textbox").last().fill("0");
    await expect(sheet.getByText("Enter a price above $0.")).toBeVisible();
    await expect(add).toBeDisabled();
    await sheet.getByRole("textbox").last().fill("45");

    await sheet.getByRole("button", { name: "More spots" }).click();
    await expect(sheet.getByText("9", { exact: true })).toBeVisible();
    await sheet.getByLabel("Ends").selectOption({ label: "5:30 pm (90 min)" });
    await add.click();

    await expect(page.getByText(`U10 ball mastery added on ${shortDay(day, { weekday: "short", month: "short", day: "numeric" })}`).first()).toBeVisible();
    const [args] = rpcArgs(backend, "schedule_create_sessions");
    expect(args.p_session).toMatchObject({
      session_type: "group",
      visibility: "open",
      times: [{ date: day, start: "16:00" }],
      repeat: "none",
      weeks: 1,
      duration_minutes: 90,
      session_name: "U10 ball mastery",
      price: 45,
      capacity: 9,
      location: "in-person",
      place: "Central Park",
      is_draft: false,
    });
    // The new session shows on the week once the schedule reloads.
    await expect(page.getByRole("button", { name: /4:00 pm\s*U10 ball mastery/ })).toBeVisible();
  });

  test("adds a repeating 1-on-1 open slot at the coach's rate, online", async ({ page, as, backend }) => {
    const day = addDays(today(), 1);
    installSchedule(backend);
    await as(page, "coach");
    await page.goto("/schedule/create");
    const sheet = await openAdd(page, 1);
    await sheet.getByRole("button", { name: "1-on-1", exact: true }).click();
    await expect(sheet.getByRole("button", { name: /Open slot/ })).toHaveAttribute("aria-pressed", "true");
    // The price starts at the coach's hourly rate.
    await expect(sheet.getByRole("textbox")).toHaveValue("80");
    await sheet.getByRole("button", { name: "Video call" }).click();
    await sheet.getByRole("switch").click();
    await expect(sheet.getByText("Open every week until you turn it off")).toBeVisible();
    await sheet.getByRole("button", { name: "Add open slot" }).click();

    await expect(page.getByText(`Open slot added every ${shortDay(day, { weekday: "long" })}`).first()).toBeVisible();
    const [args] = rpcArgs(backend, "schedule_create_sessions");
    expect(args.p_session).toMatchObject({
      session_type: "individual",
      visibility: "open",
      times: [{ date: day, start: "16:00" }],
      repeat: "weekly",
      duration_minutes: 60,
      price: 80,
      capacity: 1,
      location: "online",
      place: null,
    });
  });

  test("books a 1-on-1 for one athlete, offered to them", async ({ page, as, backend }) => {
    const day = today();
    installSchedule(backend);
    await as(page, "coach");
    await page.goto("/schedule/create");
    const sheet = await openAdd(page);
    await sheet.getByRole("button", { name: "1-on-1", exact: true }).click();
    await sheet.getByRole("button", { name: /Book an athlete/ }).click();
    const athlete = sheet.getByLabel("Athlete");
    await expect(athlete).toHaveValue(IDS.athlete);
    await athlete.selectOption({ label: "Blake Baker" });
    await sheet.getByRole("button", { name: "Book session" }).click();
    await expect(page.getByText("Session offered. They confirm and pay").first()).toBeVisible();
    const [args] = rpcArgs(backend, "schedule_create_sessions");
    expect(args.p_session).toMatchObject({
      session_type: "individual",
      visibility: "offered",
      times: [{ date: day, start: "16:00" }],
      offered_to: [SCH.athleteB],
      price: 80,
    });
  });

  test("a start time that overlaps another session can't be saved", async ({ page, as, backend }) => {
    const day = addDays(today(), 1);
    installSchedule(backend, {
      sessions: [scheduleSession({ id: SCH.group, date: day, start_time: "17:00:00", session_type: "group", session_name: "U12 finishing", capacity: 8 })],
    });
    await as(page, "coach");
    await page.goto("/schedule/create");
    const sheet = await openAdd(page, 1);
    // The form starts on a free time.
    await expect(sheet.getByLabel("Start time")).toHaveValue(String(16 * 60));
    await sheet.getByPlaceholder("For example, U10 ball mastery").fill("Finishing 2");
    await sheet.getByLabel("Start time").selectOption({ label: "5:00 pm" });
    await expect(sheet.getByText("Overlaps U12 finishing at 5:00 pm")).toBeVisible();
    await expect(sheet.getByText("That time overlaps another session. Pick another start time.")).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Add group session" })).toBeDisabled();
    expect(backend.writesTo("schedule_create_sessions")).toHaveLength(0);
  });
});

test.describe("Plan next week", () => {
  const seedPlan = (backend: Parameters<typeof installSchedule>[0], tagged = true) => {
    const monday = mondayOf(today());
    const next = addDays(monday, 7);
    installSchedule(backend, {
      sessions: [
        // Last week's (this week's) group, not yet on next week: "Copy last week" offers it.
        scheduleSession({ id: SCH.lastWeekGroup, date: monday, start_time: "17:00:00", session_type: "group", session_name: "Monday juniors", capacity: 10, price: 35 }),
        // A draft on next Wednesday.
        scheduleSession({
          id: SCH.draft,
          date: addDays(next, 2),
          start_time: "18:00:00",
          session_type: "group",
          session_name: "U12 finishing",
          capacity: 8,
          price: 40,
          is_draft: true,
          details: tagged ? { tag: "On-field training", ages: "On-field training" } : {},
        }),
      ],
    });
    return { monday, next, sunday: addDays(next, 6) };
  };

  test("shows next week's drafts and copies last week's groups", async ({ page, as, backend }) => {
    const { next, sunday } = seedPlan(backend);
    await as(page, "coach");
    await page.goto("/schedule/plan");
    await expect(page.getByRole("heading", { name: "Plan next week" })).toBeVisible();
    await expect(page.getByText(`${shortDay(next)} to ${shortDay(sunday)}`).first()).toBeVisible();
    await expect(page.getByText("1 session on 1 day · 8 spots")).toBeVisible();
    await expect(page.getByRole("button", { name: "U12 finishing", exact: true })).toBeVisible();
    await expect(page.getByText("New", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "On-field training" })).toBeVisible();

    await page.getByRole("button", { name: "Copy last week" }).click();
    await expect(page.getByText("Copied 1 session").first()).toBeVisible();
    expect(rpcArgs(backend, "schedule_copy_groups")).toEqual([{ p_from: next, p_to: sunday, p_days: 7 }]);
  });

  test("adds a new draft session to a day", async ({ page, as, backend }) => {
    const { next } = seedPlan(backend);
    await as(page, "coach");
    await page.goto("/schedule/plan");
    await expect(page.getByRole("button", { name: "U12 finishing", exact: true })).toBeVisible();
    // The first Add is next Monday.
    await page.getByRole("button", { name: "Add", exact: true }).first().click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("heading", { name: "Add a session" })).toBeVisible();
    await sheet.getByRole("button", { name: "Create a new session" }).click();
    await expect(sheet.getByRole("heading", { name: "New session" })).toBeVisible();
    const addTo = sheet.getByRole("button", { name: `Add to ${shortDay(next, { weekday: "short", month: "short", day: "numeric" })}` });
    await expect(addTo).toBeDisabled();
    await expect(sheet.getByText("Still missing: a name and a tag.")).toBeVisible();
    await sheet.getByPlaceholder("For example, U10 ball mastery").fill("Speed and agility");
    await sheet.getByRole("group", { name: "Tag" }).getByRole("button", { name: "Performance coaching" }).click();
    await sheet.getByLabel("Starts").selectOption({ label: "6:00 pm" });
    await sheet.getByLabel("Length").selectOption({ label: "90 min" });
    await addTo.click();

    await expect(page.getByText(/Speed and agility added to/).first()).toBeVisible();
    const [args] = rpcArgs(backend, "schedule_create_sessions");
    expect(args.p_session).toMatchObject({
      session_type: "group",
      visibility: "open",
      times: [{ date: next, start: "18:00" }],
      repeat: "none",
      duration_minutes: 90,
      session_name: "Speed and agility",
      price: 40,
      capacity: 8,
      pillar: "Performance coaching",
      details: { tag: "Performance coaching", ages: "Performance coaching" },
      is_draft: true,
    });
    await expect(page.getByRole("button", { name: "Speed and agility", exact: true })).toBeVisible();
  });

  test("sends the week to the group chat with a shareable link", async ({ page, as, backend }) => {
    const { next, sunday } = seedPlan(backend);
    await as(page, "coach");
    await page.goto("/schedule/plan");
    await page.getByRole("button", { name: "Continue to sharing" }).click();
    await expect(page.getByText("Families tick the sessions they want and pay once.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Your group chat" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Shareable link" })).toHaveAttribute("aria-pressed", "true");
    // What families see lists the draft with its tag and price.
    await expect(page.getByText("U12 finishing · On-field training")).toBeVisible();

    await page.getByRole("button", { name: "Send 1 session" }).click();
    await expect(page).toHaveURL(/\/schedule$/);
    await expect(page.getByText("1 session sent").first()).toBeVisible();

    const [publish] = rpcArgs(backend, "schedule_publish_groups");
    expect(publish).toMatchObject({
      p_from: next,
      p_to: sunday,
      p_title: `Week of ${shortDay(next)} to ${shortDay(sunday, { day: "numeric" })}`,
      p_post_to_channel: true,
      p_link_base: expect.stringMatching(/\/offers\/$/),
    });
    expect(String(publish.p_message)).toContain("{link}");
    expect(Date.parse(String(publish.p_closes_at))).not.toBeNaN();
  });

  test("sending the week writes each session's tag onto the week card", async ({ page, as, backend }) => {
    seedPlan(backend);
    await as(page, "coach");
    await page.goto("/schedule/plan");
    await page.getByRole("button", { name: "Continue to sharing" }).click();
    await page.getByRole("button", { name: "Send 1 session" }).click();
    await expect(page.getByText("1 session sent").first()).toBeVisible();
    await expect(page.getByText(/The tag didn't save on the week card/)).toHaveCount(0);
    expect(rpcArgs(backend, "schedule_set_offer_session_tags")).toEqual([{ p_offer_id: SCH.offer, p_tags: { [SCH.draft]: "On-field training" } }]);
  });

  test("turning off the group chat and the link leaves nowhere to send", async ({ page, as, backend }) => {
    seedPlan(backend);
    await as(page, "coach");
    await page.goto("/schedule/plan");
    await page.getByRole("button", { name: "Continue to sharing" }).click();
    await page.getByRole("button", { name: "Your group chat" }).click();
    await page.getByRole("button", { name: "Shareable link" }).click();
    await expect(page.getByText("Pick a group chat or the shareable link.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send 1 session" })).toBeDisabled();
  });

  test("a draft without a tag can't be sent until it has one", async ({ page, as, backend }) => {
    seedPlan(backend, false);
    await as(page, "coach");
    await page.goto("/schedule/plan");
    await page.getByRole("button", { name: "Continue to sharing" }).click();
    await expect(page.getByText("Every session needs a name, time, tag and price before you send.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send 1 session" })).toBeDisabled();
    await page.getByRole("button", { name: "Back to the week" }).click();

    // Tag it from the chip.
    await page.getByRole("button", { name: "Add a tag" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Mentorship" }).click();
    await dialog.getByRole("button", { name: /save/i }).click();
    await expect(dialog).toBeHidden();
    const [args] = rpcArgs(backend, "schedule_update_draft");
    expect(args).toMatchObject({ p_occurrence_id: SCH.draft, p_session: { pillar: "Mentorship", details: { tag: "Mentorship", ages: "Mentorship" } } });
  });

  test("removing a draft deletes it", async ({ page, as, backend }) => {
    seedPlan(backend);
    await as(page, "coach");
    await page.goto("/schedule/plan");
    await page.getByRole("button", { name: "Remove U12 finishing" }).click();
    await expect(page.getByRole("button", { name: "U12 finishing", exact: true })).toHaveCount(0);
    expect(rpcArgs(backend, "schedule_remove_session")).toEqual([{ p_occurrence_id: SCH.draft }]);
    await expect(page.getByRole("button", { name: "Continue to sharing" })).toBeDisabled();
  });
});

test.describe("Schedule settings", () => {
  /** The day a weekly series starts on: this week's weekday, or next week's once it has passed. */
  const nextWeekday = (weekday: number) => {
    const d = addDays(mondayOf(today()), weekday - 1);
    return d < today() ? addDays(d, 7) : d;
  };

  test("weekly hours: opening a day and saving replaces the repeating open slots", async ({ page, as, backend }) => {
    installSchedule(backend, { series: [weeklySeries(SCH.seriesMon9, 1, "09:00"), weeklySeries(SCH.seriesMon10, 1, "10:00")] });
    await as(page, "coach");
    await page.goto("/schedule/settings");
    const card = page.locator("#weekly-hours");
    await expect(card.getByRole("heading", { name: "Weekly hours" })).toBeVisible();
    await expect(card.getByText(/· 2 hours a week/)).toBeVisible();
    await expect(card.getByRole("button", { name: /^Monday\s*9:00 am–11:00 am/ })).toBeVisible();

    // Tuesday opens with 4 to 7 pm.
    const tuesday = card.getByRole("button", { name: /^Tuesday\s*Off/ });
    await tuesday.locator("..").getByRole("button", { name: "Open", exact: true }).click();
    await expect(card.getByRole("button", { name: /^Tuesday\s*4:00 pm–7:00 pm/ })).toBeVisible();
    // Monday runs to noon.
    await card.getByRole("button", { name: /^Monday/ }).click();
    await card.getByLabel("Until").selectOption({ label: "12:00 pm" });
    await expect(card.getByText(/· 6 hours a week/)).toBeVisible();

    await card.getByRole("button", { name: "Save weekly hours" }).click();
    await expect(page.getByText("Weekly hours saved").first()).toBeVisible();

    expect(rpcArgs(backend, "schedule_stop_series")).toEqual([{ p_series_id: SCH.seriesMon9 }, { p_series_id: SCH.seriesMon10 }]);
    const created = rpcArgs(backend, "schedule_create_sessions").map((a) => a.p_session as Record<string, unknown>);
    expect(created.map((p) => p.times)).toEqual([
      [{ date: nextWeekday(1), start: "09:00" }],
      [{ date: nextWeekday(1), start: "10:00" }],
      [{ date: nextWeekday(1), start: "11:00" }],
      [{ date: nextWeekday(2), start: "16:00" }],
      [{ date: nextWeekday(2), start: "17:00" }],
      [{ date: nextWeekday(2), start: "18:00" }],
    ]);
    for (const p of created) {
      expect(p).toMatchObject({ session_type: "individual", visibility: "open", repeat: "weekly", duration_minutes: 60, price: 80, capacity: 1, location: "in-person", place: "Central Park" });
    }
  });

  test("weekly hours: clearing every day saves no open slots", async ({ page, as, backend }) => {
    installSchedule(backend, { series: [weeklySeries(SCH.seriesMon9, 1, "09:00")] });
    await as(page, "coach");
    await page.goto("/schedule/settings");
    const card = page.locator("#weekly-hours");
    await card.getByRole("button", { name: /^Monday/ }).locator("..").getByRole("button", { name: "Clear" }).click();
    await expect(card.getByText("No days open · 0 hours a week")).toBeVisible();
    await card.getByRole("button", { name: "Save weekly hours" }).click();
    await expect(page.getByText("Weekly hours saved").first()).toBeVisible();
    expect(rpcArgs(backend, "schedule_stop_series")).toEqual([{ p_series_id: SCH.seriesMon9 }]);
    expect(backend.writesTo("schedule_create_sessions")).toHaveLength(0);
  });

  test("locations: add, rename and remove one with upcoming sessions", async ({ page, as, backend }) => {
    installSchedule(backend, {
      sessions: [scheduleSession({ id: SCH.booked, date: addDays(today(), 2), start_time: "10:00:00", place: "Central Park", bookings: [scheduleBooking({ id: SCH.bookingA })] })],
    });
    await as(page, "coach");
    await page.goto("/schedule/settings");
    const card = page.locator("section").filter({ has: page.getByRole("heading", { name: "Locations" }) });
    await expect(card.getByText("Central Park")).toBeVisible();
    await expect(card.getByText("1 upcoming session")).toBeVisible();
    await expect(card.getByText("Video call is always available")).toBeVisible();

    // Add: an empty name is refused, then a real one saves the list.
    await card.getByRole("button", { name: "Add location" }).click();
    await card.getByRole("button", { name: "Add location" }).click();
    await expect(page.getByText("Name the location").first()).toBeVisible();
    await card.getByPlaceholder("For example, Mueller Park, field 3").fill("Mueller Park, field 3");
    await card.getByRole("button", { name: "Add location" }).click();
    await expect(page.getByText("Mueller Park, field 3 added").first()).toBeVisible();
    expect(backend.writesTo("coaches", "PATCH").at(-1)?.body).toEqual({ locations: ["Central Park", "Mueller Park, field 3"] });
    await expect(card.getByText("Mueller Park, field 3", { exact: true })).toBeVisible();

    // Rename.
    await card.getByRole("button", { name: "Edit Mueller Park, field 3" }).click();
    await card.getByLabel("Location name").fill("Mueller Park");
    await card.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Location updated").first()).toBeVisible();
    expect(backend.writesTo("coaches", "PATCH").at(-1)?.body).toEqual({ locations: ["Central Park", "Mueller Park"] });

    // Removing a place with an upcoming session asks first.
    await card.getByRole("button", { name: "Remove Central Park" }).click();
    const confirm = page.getByRole("alertdialog").or(page.getByRole("dialog"));
    await expect(confirm.getByText("Remove Central Park?")).toBeVisible();
    await expect(confirm.getByText(/Central Park has 1 upcoming session/)).toBeVisible();
    await confirm.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("Central Park removed").first()).toBeVisible();
    expect(backend.writesTo("coaches", "PATCH").at(-1)?.body).toEqual({ locations: ["Mueller Park"] });
    await expect(card.getByText("Central Park")).toHaveCount(0);
  });

  test("booking rules: shows the saved rules and saves an edit", async ({ page, as, backend }) => {
    installSchedule(backend);
    backend.rpc.get_schedule_settings = {
      new_family_booking: "request",
      booking_window_weeks: 8,
      cancel_notice_hours: 24,
      cancellation_policy: null,
      travel_miles: null,
      travel_zip: null,
      group_min: null,
      home_zip: "10001",
      time_off: [],
    };
    await as(page, "coach");
    await page.goto("/schedule/settings");
    const card = page.locator("section").filter({ has: page.getByRole("heading", { name: "Booking rules" }) });
    await expect(card.getByText("24 hours notice for a session credit")).toBeVisible();
    await expect(card.getByText("Up to 8 weeks ahead")).toBeVisible();
    await expect(card.getByText("Request first, you approve within 24 hours")).toBeVisible();

    await card.getByRole("button", { name: "Edit rules" }).click();
    const dialog = page.getByRole("dialog", { name: "Booking rules" });
    await dialog.getByLabel("Free cancellation notice").selectOption({ label: "48 hours" });
    await dialog.getByLabel("Booking window").selectOption({ label: "4 weeks ahead" });
    await dialog.getByLabel("How far you travel").selectOption({ label: "Within 10 miles" });
    await dialog.getByLabel("ZIP code you travel from").fill("123");
    await dialog.getByLabel("Families new to you").selectOption("instant");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByText("Use a 5-digit ZIP code")).toBeVisible();
    expect(backend.writesTo("schedule_set_booking_rules")).toHaveLength(0);

    await dialog.getByLabel("ZIP code you travel from").fill("10001");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Booking rules saved").first()).toBeVisible();
    expect(rpcArgs(backend, "schedule_set_booking_rules")).toEqual([
      {
        p_new_family_booking: "instant",
        p_booking_window_weeks: 4,
        p_cancel_notice_hours: 48,
        p_travel_miles: 10,
        p_travel_zip: "10001",
        p_group_min: null,
      },
    ]);
  });
});

test.describe("Coach setup", () => {
  const status = (over: Record<string, boolean> = {}) => ({
    coach_id: IDS.coach,
    photo: true,
    bio: true,
    instagram: false,
    credentials: false,
    pricing: true,
    availability: false,
    payouts: false,
    ready: false,
    listed: false,
    ...over,
  });

  test("lists the steps, what's done and what's required, and links each to its editor", async ({ page, as, backend }) => {
    backend.rpc.coach_setup_status = status();
    await as(page, "coach");
    await page.goto("/setup");
    await expect(page.getByText("2 of 4 required steps done. Families can book you once they're all done.")).toBeVisible();
    const steps = page.getByRole("region", { name: "Setup steps" });
    await expect(steps.getByRole("listitem")).toHaveCount(7);
    await expect(steps.getByRole("link", { name: /Profile photo\s*\(done\)/ })).toBeVisible();
    await expect(steps.getByRole("link", { name: /Availability\s*Required/ })).toBeVisible();
    await expect(steps.getByRole("link", { name: /Payout details\s*Required/ })).toBeVisible();
    await expect(steps.getByText("Required")).toHaveCount(2);
    // Going live waits for the required steps.
    await expect(page.getByRole("button", { name: "Go live on the marketplace" })).toBeDisabled();

    await steps.getByRole("link", { name: /Availability/ }).click();
    await expect(page).toHaveURL(/\/schedule\/settings#weekly-hours$/);
  });

  test("going live lists the coach and returns home", async ({ page, as, backend }) => {
    backend.rpc.coach_setup_status = status({ availability: true, payouts: true, ready: true });
    await as(page, "coach");
    await page.goto("/setup");
    await expect(page.getByText("4 of 4 required steps done.", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Go live on the marketplace" }).click();
    await expect(page.getByText("You're live").first()).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);
    const [write] = backend.writesTo("coaches", "PATCH");
    expect(write.body).toEqual({ listed: true });
    expect(write.url).toContain(`id=eq.${IDS.coach}`);
  });

  test("a refused go-live says why", async ({ page, as, backend }) => {
    backend.rpc.coach_setup_status = status({ availability: true, payouts: true, ready: true });
    await as(page, "coach");
    // The database refuses listing until the required steps are really done.
    await page.route(/\/rest\/v1\/coaches\?/, (route) =>
      route.request().method() === "PATCH"
        ? route.fulfill({ status: 400, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ code: "P0001", message: "Add your payout details before going live", details: null, hint: null }) })
        : route.fallback()
    );
    await page.goto("/setup");
    await page.getByRole("button", { name: "Go live on the marketplace" }).click();
    await expect(page.getByText("Not live yet").first()).toBeVisible();
    await expect(page.getByText("Add your payout details before going live").first()).toBeVisible();
    await expect(page).toHaveURL(/\/setup$/);
  });

  test("once listed it says so and hides Go live", async ({ page, as, backend }) => {
    backend.rpc.coach_setup_status = status({ availability: true, payouts: true, ready: true, listed: true });
    await as(page, "coach");
    await page.goto("/setup");
    await expect(page.getByText("You're live. Finish the rest whenever you like.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Go live on the marketplace" })).toHaveCount(0);
  });
});

test.describe("Camps", () => {
  const liveCamp = () =>
    coachCamp({
      id: SCH.camp,
      name: "Thanksgiving camp",
      published: true,
      published_at: "2026-10-01T10:00:00Z",
      taken: 5,
      waiting_count: 1,
      starts_on: addDays(today(), 20),
      ends_on: addDays(today(), 22),
      groups: [
        campGroup({ id: SCH.campGroup, name: "Under 12", start_time: "09:00", end_time: "12:00", spots: 10, taken: 3 }),
        campGroup({ id: "00000000-0000-4000-8000-0000000056f3", name: "Over 12", start_time: "13:00", end_time: "16:00", spots: 10, taken: 2, sort_order: 1 }),
      ],
    });

  test("lists the coach's camps with status, dates, price and sign-ups", async ({ page, as, backend }) => {
    const draft = coachCamp({ id: "00000000-0000-4000-8000-0000000056f9", name: "Spring skills", slug: null, starts_on: null, ends_on: null, price_cents: 15000 });
    installCamps(backend, [liveCamp(), draft]);
    await as(page, "coach");
    await page.goto("/camps");
    const list = page.getByRole("region", { name: "Your camps" });
    const live = list.locator("div.relative").filter({ hasText: "Thanksgiving camp" });
    await expect(live.getByText("Live")).toBeVisible();
    await expect(live.getByText(/\$260$/)).toBeVisible();
    await expect(live.getByText("5 registered · of 20 spots · 1 waiting · 2 groups")).toBeVisible();
    await expect(live.getByRole("link", { name: "View as family" })).toHaveAttribute("href", `/${IDS.coachSlug}/thanksgiving-camp`);
    await expect(live.getByRole("button", { name: "Copy link" })).toBeVisible();

    const spring = list.locator("div.relative").filter({ hasText: "Spring skills" });
    await expect(spring.getByText("Draft")).toBeVisible();
    await expect(spring.getByText("Dates not set · $150")).toBeVisible();
    // A draft has no link to share yet.
    await expect(spring.getByRole("button", { name: "Copy link" })).toHaveCount(0);
  });

  test("Add camp: a draft needs a name and a price, then saves", async ({ page, as, backend }) => {
    installCamps(backend, []);
    await as(page, "coach");
    await page.goto("/camps");
    await page.getByRole("button", { name: "Add camp" }).click();
    await expect(page).toHaveURL(/camp=new&view=edit/);
    const dialog = page.getByRole("dialog", { name: "Add camp" });
    await expect(dialog).toBeVisible();

    if (isPhone(page)) {
      // One question per screen: Next stays off until the name is in.
      const next = dialog.getByRole("button", { name: "Next", exact: true });
      await expect(next).toBeDisabled();
      await dialog.getByLabel("Camp name").fill("Winter skills camp");
      await next.click();
      // Dates: the same day twice is a one-day camp.
      await expect(dialog.getByRole("heading", { name: "When is it?" })).toBeVisible();
      await expect(next).toBeDisabled();
      // The calendar uses the browser's day (the tests run in UTC).
      const day = String(new Date().getUTCDate());
      await dialog.getByRole("button", { name: /Starts/ }).click();
      await dialog.getByRole("gridcell", { name: day, exact: true }).first().click();
      await dialog.getByRole("gridcell", { name: day, exact: true }).first().click();
      await expect(dialog.getByText(/a one-day camp/)).toBeVisible();
      await next.click();
      await dialog.getByRole("textbox", { name: /^(Location|Somewhere else)$/ }).fill("Riverside Park");
      await next.click();
      await expect(dialog.getByRole("heading", { name: "Groups and times" })).toBeVisible();
      await next.click();
      await dialog.getByLabel("Price per athlete").fill("180");
      await next.click();
      await dialog.getByRole("button", { name: "Review camp" }).click();
      await expect(dialog.getByRole("heading", { name: "Review" })).toBeVisible();
      await dialog.getByRole("button", { name: "Save draft" }).click();
    } else {
      const saveDraft = dialog.getByRole("button", { name: "Save draft" });
      await expect(saveDraft).toBeDisabled();
      await expect(dialog.getByText(/Still missing: camp name, dates, location, price per athlete/)).toBeVisible();
      await dialog.getByLabel("Camp name").fill("Winter skills camp");
      await dialog.getByLabel("Price per athlete").fill("0");
      await expect(dialog.getByText(/Between \$1 and \$10,000/)).toBeVisible();
      await dialog.getByLabel("Price per athlete").fill("180");
      // The family preview follows what's typed.
      await expect(dialog.getByText("Winter skills camp").last()).toBeVisible();
      await dialog.getByRole("textbox", { name: /^(Location|Somewhere else)$/ }).fill("Riverside Park");
      await expect(dialog.getByRole("button", { name: "Publish camp" })).toBeDisabled();
      await saveDraft.click();
    }

    await expect(page.getByText("Draft saved").first()).toBeVisible();
    const [save] = backend.writesTo("save_camp").map((w) => w.body as Record<string, unknown>);
    expect(save.p_camp_id).toBeNull();
    expect(save.p_expected_updated_at).toBeNull();
    expect(save.p_camp).toMatchObject({ name: "Winter skills camp", price_cents: 18000, location: "Riverside Park", pay_direct: true, included: [] });
    expect(save.p_groups).toEqual([{ name: "", description: null, start_time: "09:00", end_time: "12:00", spots: 12 }]);
    expect(backend.writesTo("publish_camp")).toHaveLength(0);
    await expect(page.getByRole("region", { name: "Your camps" }).getByText("Winter skills camp")).toBeVisible();
  });

  test("editing a live camp saves the change against the version it loaded", async ({ page, as, backend }) => {
    installCamps(backend, [liveCamp()]);
    await as(page, "coach");
    await page.goto("/camps");
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page).toHaveURL(new RegExp(`camp=${SCH.camp}&view=edit`));
    const dialog = page.getByRole("dialog", { name: "Edit camp" });
    await expect.poll(() => backend.writesTo("get_camp_editor").map((w) => w.body)).toContainEqual({ p_camp_id: SCH.camp });

    if (isPhone(page)) {
      // A saved camp opens on Review; each answer has its own Edit.
      await expect(dialog.getByRole("heading", { name: "Review" })).toBeVisible();
      await dialog.getByRole("button", { name: "Edit" }).nth(4).click();
      await dialog.getByLabel("Price per athlete").fill("240");
      await dialog.getByRole("button", { name: "Back to review" }).click();
    } else {
      await expect(dialog.getByLabel("Camp name")).toHaveValue("Thanksgiving camp");
      await expect(dialog.getByLabel("Price per athlete")).toHaveValue("260");
      await dialog.getByLabel("Price per athlete").fill("240");
    }
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Camp updated").first()).toBeVisible();

    const [save] = backend.writesTo("save_camp").map((w) => w.body as Record<string, unknown>);
    expect(save.p_camp_id).toBe(SCH.camp);
    expect(save.p_expected_updated_at).toBe("2026-10-01T10:00:00Z");
    expect(save.p_camp).toMatchObject({ name: "Thanksgiving camp", price_cents: 24000 });
    expect(save.p_groups).toEqual([
      { id: SCH.campGroup, name: "Under 12", description: null, start_time: "09:00", end_time: "12:00", spots: 10 },
      { id: "00000000-0000-4000-8000-0000000056f3", name: "Over 12", description: null, start_time: "13:00", end_time: "16:00", spots: 10 },
    ]);
    // Already published: no second publish.
    expect(backend.writesTo("publish_camp")).toHaveLength(0);
    await expect(page).not.toHaveURL(/view=edit/);
  });

  test("publishing a draft camp saves it, then puts it live", async ({ page, as, backend }) => {
    installCamps(backend, [coachCamp({ id: SCH.camp, name: "Thanksgiving camp" })]);
    await as(page, "coach");
    await page.goto(`/camps?camp=${SCH.camp}&view=edit`);
    const dialog = page.getByRole("dialog", { name: "Edit draft camp" });
    await expect(dialog).toBeVisible();
    if (isPhone(page)) await expect(dialog.getByRole("heading", { name: "Review" })).toBeVisible();
    else await expect(dialog.getByLabel("Camp name")).toHaveValue("Thanksgiving camp");
    await dialog.getByRole("button", { name: "Publish camp" }).click();
    await expect(page.getByText("Camp published").first()).toBeVisible();
    await expect(page.getByText("3 camp sessions on your schedule.").first()).toBeVisible();
    expect(backend.writesTo("save_camp")).toHaveLength(1);
    expect(backend.writesTo("publish_camp").map((w) => w.body)).toEqual([{ p_camp_id: SCH.camp }]);
    await expect(page.getByRole("region", { name: "Your camps" }).getByText("Live")).toBeVisible();
  });

  test("a save refused as stale reloads the camp and says so", async ({ page, as, backend }) => {
    installCamps(backend, [liveCamp()]);
    // The camp RPCs read the machine code from the error hint, which MockError doesn't set.
    await page.route(/\/rest\/v1\/rpc\/save_camp/, (route) =>
      route.fulfill({
        status: 409,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({ code: "P0001", message: "This camp changed since you opened it", details: null, hint: "stale" }),
      })
    );
    await as(page, "coach");
    await page.goto(`/camps?camp=${SCH.camp}&view=edit`);
    const dialog = page.getByRole("dialog", { name: "Edit camp" });
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(dialog.getByText("This camp was changed in another tab. We loaded the latest version: check it and save again.")).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test("unpublishing stops sign-ups", async ({ page, as, backend }) => {
    installCamps(backend, [liveCamp()]);
    await as(page, "coach");
    await page.goto(`/camps?camp=${SCH.camp}&view=edit`);
    const dialog = page.getByRole("dialog", { name: "Edit camp" });
    await dialog.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByText("Camp unpublished").first()).toBeVisible();
    expect(backend.writesTo("unpublish_camp").map((w) => w.body)).toEqual([{ p_camp_id: SCH.camp }]);
    await expect(page.getByRole("region", { name: "Your camps" }).getByText("Draft")).toBeVisible();
  });
});
