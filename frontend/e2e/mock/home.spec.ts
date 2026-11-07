import { test, expect } from "./test";
import { IDS } from "./personas";
import { HOME, seedAthleteHome, seedCoachHome } from "./data/home";
import { BILLING, MONEY, seedCoachBilling, seedPayments } from "./data/business";
import { seedBookable } from "./data/booking";
import { addDays, etDate } from "./data/schedule";
import { expectNoSidewaysScroll } from "./helpers";

// Home (/dashboard): Coach Home for coaches, Athlete Home for athletes and parents.
// Realtime isn't pushed by the mock, so every card is tested from what it loads.

const rpcArgs = (backend: { writesTo: (n: string) => { body: unknown }[] }, name: string) =>
  backend.writesTo(name).map((w) => w.body as Record<string, unknown>);

test.describe("coach home", () => {
  test.beforeEach(async ({ page, as, backend }) => {
    seedCoachHome(backend);
    await as(page, "coach");
  });

  test("shows today's sessions with who is booked and what they paid", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1, name: /good (morning|afternoon|evening), casey/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "2 sessions", exact: true })).toBeVisible();

    const privateSession = page.getByRole("link", { name: /alex athlete central park/i });
    await expect(privateSession).toHaveAttribute("href", `/sessions/${HOME.privateToday}`);
    await expect(page.getByText("Paid in app")).toBeVisible();
    await expect(page.getByRole("link", { name: "Message Alex" })).toHaveAttribute("href", "/chat");
    await expect(page.getByRole("link", { name: "Details" })).toHaveAttribute("href", `/sessions/${HOME.privateToday}`);

    await expect(page.getByRole("link", { name: /finishing group central park/i })).toBeVisible();
    await expect(page.getByText("Group · 2 of 6")).toBeVisible();
    await expect(page.getByText("1 of 2 paid")).toBeVisible();
    await expect(page.getByRole("link", { name: "View session" })).toHaveAttribute("href", `/sessions/${HOME.groupToday}`);
    // Both are on now.
    await expect(page.getByText("Now", { exact: true })).toHaveCount(2);
    await expectNoSidewaysScroll(page, "coach home");
  });

  test("This week counts sessions and opens a day or the requests on My schedule", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "2 sessions booked, 0 slots open" })).toBeVisible();
    const tomorrow = addDays(etDate(), 1);
    const tomorrowLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${tomorrow}T12:00:00Z`));
    // My schedule reads ?day= and then drops it from the address.
    const toDay = page.waitForURL(new RegExp(`/schedule\\?day=${tomorrow}$`));
    await page.getByRole("button", { name: `${tomorrowLabel}: 0 sessions booked, 0 open` }).click();
    await toDay;

    await page.goBack();
    const toRequests = page.waitForURL(/\/schedule\?requests=1$/);
    await page.getByRole("link", { name: "1 request" }).click();
    await toRequests;
  });

  test("the money strip switches period and reloads earnings", async ({ page, backend }) => {
    await page.goto("/dashboard");
    const money = page.getByRole("region", { name: "Money" });
    await expect(money.getByText("Earned last 7 days")).toBeVisible();
    await expect(money.getByText("$280")).toBeVisible();
    await expect(money.getByText("100%")).toBeVisible();
    await expect(money.getByText("$240")).toBeVisible();
    await expect(money.getByRole("button", { name: "7 days" })).toHaveAttribute("aria-pressed", "true");

    await money.getByRole("button", { name: "30 days" }).click();
    await expect(money.getByText("Earned last 30 days")).toBeVisible();
    await expect(money.getByText("$1,200")).toBeVisible();
    await expect(money.getByRole("button", { name: "30 days" })).toHaveAttribute("aria-pressed", "true");
    expect(rpcArgs(backend, "get_coach_earnings").map((a) => a.p_days)).toEqual(expect.arrayContaining([7, 30]));

    await money.getByRole("button", { name: "Today" }).click();
    await expect(money.getByText("Earned today")).toBeVisible();
    await expect(money.getByText("$40", { exact: true })).toBeVisible();
    await expect(money.getByRole("link", { name: "My Business" })).toHaveAttribute("href", "/payments");
  });

  test("remind sends one reminder to each overdue family", async ({ page, backend }) => {
    seedPayments(backend);
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "1 overdue · remind" }).click();
    await expect(page.getByText("Reminders sent to 1 family", { exact: true })).toBeVisible();
    const reminders = backend.writesTo("coach-invoices").map((w) => w.body as Record<string, unknown>);
    // Only the open invoice that is past due; the one due in five days and the paid one are left alone.
    expect(reminders).toEqual([expect.objectContaining({ action: "remind", invoice_id: MONEY.overdueInvoice })]);
  });

  test("feedback due links to the feedback form for that session", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("1 session needs feedback.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Add feedback" })).toHaveAttribute("href", `/coach-session-feedback?slotId=${HOME.feedbackSlot}`);
  });

  test("Payments to confirm marks an offline payment as received", async ({ page, backend }) => {
    await page.goto("/dashboard");
    const card = page.getByRole("region", { name: "Payments to confirm" });
    await expect(card.getByText("1 payment pending, 1 from a session that already happened")).toBeVisible();
    await expect(card.getByRole("link", { name: /dana baker for blake/i })).toHaveAttribute("href", `/sessions/${HOME.offlineOccurrence}`);
    await card.getByRole("button", { name: "Confirm received" }).click();
    await expect(page.getByText("Marked paid", { exact: true })).toBeVisible();
    await expect(page.getByText("Dana sees it as paid", { exact: true })).toBeVisible();
    expect(rpcArgs(backend, "confirm_offline_payment")).toEqual([{ p_booking_id: HOME.offlineBooking }]);
  });

  test("Coming up camps shows sign-ups and money to collect", async ({ page }) => {
    await page.goto("/dashboard");
    const camps = page.getByRole("region", { name: "Coming up camps" });
    await expect(camps.getByRole("heading", { name: "1 camp" })).toBeVisible();
    await expect(camps.getByRole("link", { name: "Open Winter skills camp" })).toHaveAttribute("href", `/${IDS.coachSlug}/winter-skills`);
    await expect(camps.getByText(/5 of 12 signed up/)).toBeVisible();
    await expect(camps.getByText(/\$400 to collect/)).toBeVisible();
    await expect(camps.getByRole("link", { name: "Registrations" })).toHaveAttribute("href", `/camps?camp=${HOME.camp}&view=registrations`);
    await camps.getByRole("link", { name: "All camps" }).click();
    await expect(page).toHaveURL(/\/camps$/);
  });

  test("Create session opens the sheet and Edit profile opens the profile editor", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Create session" }).click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Create session" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.getByRole("link", { name: "Edit profile" }).click();
    await expect(page).toHaveURL(/\/profile\?mode=edit$/);
    await expect(page.getByText("Editing your profile.")).toBeVisible();
  });

  test("a coach in their free trial sees the plan card and its steps", async ({ page, backend }) => {
    seedCoachBilling(backend, BILLING.trial);
    await page.goto("/dashboard");
    const plan = page.getByRole("region", { name: "Coach plan" });
    await expect(plan.getByText("12 days left free")).toBeVisible();
    await expect(plan.getByRole("link", { name: "Plan details" })).toHaveAttribute("href", "/settings?tab=plan");
    await expect(plan.getByRole("link", { name: /complete your profile/i })).toHaveAttribute("href", "/profile?mode=edit");
    await expect(plan.getByRole("link", { name: /subscribe when ready · \$29\/mo/i })).toBeVisible();
  });

  test("a locked coach is asked to subscribe", async ({ page, backend }) => {
    seedCoachBilling(backend, BILLING.locked);
    await page.goto("/dashboard");
    await expect(page.getByText("Subscribe to keep coaching")).toBeVisible();
    await expect(page.getByRole("link", { name: /open plan · \$29\/mo/i })).toHaveAttribute("href", "/settings?tab=plan");
    await expect(page.getByRole("region", { name: "Payments to confirm" })).toBeHidden();
  });
});

test("a new coach with no athletes or sessions gets the first-booking checklist", async ({ page, as, backend }) => {
  seedCoachHome(backend);
  backend.rpc.get_coach_roster = [];
  backend.rpc.get_coach_schedule = { sessions: [], busy: [], time_off: [], series: [], rules: { new_family_booking: "request", booking_window_weeks: 8, locations: [], hourly_rate: 80, slug: IDS.coachSlug }, calendar: null };
  await as(page, "coach");
  await page.goto("/dashboard");
  await expect(page.getByText("Let's get your first booking")).toBeVisible();
  await expect(page.getByRole("link", { name: /invite the families you already coach/i })).toHaveAttribute("href", "/athletes?tab=invites");
  await page.getByRole("link", { name: /set your weekly availability/i }).click();
  await expect(page).toHaveURL(/\/schedule$/);
});

test.describe("family home", () => {
  test("a parent sees the athlete card, next session, focus, coaches and invoices", async ({ page, as, backend }) => {
    seedAthleteHome(backend);
    await as(page, "parent");
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1, name: "Alex Athlete" })).toBeVisible();
    await expect(page.getByText("U17 · Forward · Rovers FC · Class of 2028")).toBeVisible();
    await expect(page.getByText("Finish Alex's profile")).toBeVisible();
    await expect(page.getByText("4 of 7")).toBeVisible();
    await expect(page.getByText("About Alex")).toBeVisible();

    const next = page.getByRole("link", { name: /finishing with casey coach/i });
    await expect(next).toHaveAttribute("href", `/sessions/${HOME.nextSession}`);
    // 10:00 Eastern, shown in the viewer's zone (UTC).
    await expect(next).toContainText("3:00 to 4:00 pm · Central Park");
    await expect(page.getByText("Weak-foot finishing")).toBeVisible();

    await expect(page.getByRole("link", { name: /casey coach next: .* · 3 sessions left/i })).toHaveAttribute("href", `/coach/${IDS.coachSlug}`);
    await expect(page.getByRole("link", { name: /jordan lee no session booked/i })).toBeVisible();

    const invoices = page.getByRole("region", { name: "Invoices" });
    await expect(invoices.getByText("1 to pay")).toBeVisible();
    await expect(invoices.getByRole("link", { name: /private session · \$80 from casey coach/i })).toHaveAttribute("href", `/invoices/${HOME.invoice}`);
    await expectNoSidewaysScroll(page, "family home");
  });

  test("Edit profile saves the athlete and keeps the account sport in step", async ({ page, as, backend }) => {
    seedAthleteHome(backend);
    await as(page, "parent");
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Season goal" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit profile" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Season goal (optional)")).toBeFocused();
    await dialog.getByLabel("Season goal (optional)").fill("Make the regional team");
    await dialog.getByLabel("Pathway level").selectOption("Youth Development");
    await dialog.getByLabel("Highlight video link (optional)").fill("youtube.com/watch?v=e2e");
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("Profile saved", { exact: true })).toBeVisible();
    await expect(dialog).toBeHidden();
    const athlete = backend.writesTo("athlete_profiles", "PATCH");
    expect(athlete).toHaveLength(1);
    expect(athlete[0].url).toContain(`id=eq.${IDS.athlete}`);
    expect(athlete[0].body).toMatchObject({
      full_name: "Alex Athlete",
      date_of_birth: "2010-05-01",
      sport: "soccer",
      position: "Forward",
      high_school: "Rovers FC",
      pathway_tags: ["Youth Development"],
      graduation_year: "2028",
      season_goal: "Make the regional team",
      highlight_video_url: "youtube.com/watch?v=e2e",
    });
    const account = backend.writesTo("user_profiles", "PATCH").find((w) => (w.body as Record<string, unknown>).sport !== undefined);
    expect(account?.body).toMatchObject({ sport: "Soccer" });
    expect(account?.url).toContain(`athlete_id=eq.${IDS.athlete}`);
  });

  test("Edit profile checks the name, birth date and video link before saving", async ({ page, as, backend }) => {
    seedAthleteHome(backend);
    await as(page, "parent");
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Edit profile" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit profile" });
    // Clearing the first name moves the last name up (see the fixme below), so clear it twice.
    await dialog.getByLabel("First name").fill("");
    await dialog.getByLabel("First name").fill("");
    await expect(dialog.getByLabel("Last name")).toHaveValue("");
    await dialog.getByLabel("Date of birth").fill(addDays(etDate(), 1));
    await dialog.getByLabel("Highlight video link (optional)").fill("not a link");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByText("Required").first()).toBeVisible();
    await expect(dialog.getByText("Enter a date of birth")).toBeVisible();
    await expect(dialog.getByText("Paste the full link")).toBeVisible();
    expect(backend.writesTo("athlete_profiles")).toHaveLength(0);

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  });

  // Bug: the first and last name boxes are one full_name string split on the first space
  // (AthleteHome.tsx EditProfileDialog, splitName). Clearing the first name to retype it leaves
  // "Athlete", which then shows as the first name with an empty last name.
  test.fixme("clearing the first name keeps the last name where it is", async ({ page, as, backend }) => {
    seedAthleteHome(backend);
    await as(page, "parent");
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Edit profile" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit profile" });
    await dialog.getByLabel("First name").fill("");
    await expect(dialog.getByLabel("Last name")).toHaveValue("Athlete");
    await expect(dialog.getByLabel("First name")).toHaveValue("");
  });

  test("removing a coach hides them, and Undo brings them back", async ({ page, as, backend }) => {
    seedAthleteHome(backend);
    await as(page, "parent");
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "More for Jordan Lee" }).click();
    await page.getByRole("menuitem", { name: "Remove from my coaches" }).click();
    const confirm = page.getByRole("dialog");
    await expect(confirm.getByRole("heading")).toContainText("Jordan");
    await confirm.getByRole("button", { name: "Remove" }).click();

    await expect(page.getByText("Jordan removed from your coaches", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /jordan lee/i })).toBeHidden();
    expect(rpcArgs(backend, "hide_coach")).toEqual([{ p_coach_id: HOME.coachJordan }]);

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("link", { name: /jordan lee/i })).toBeVisible();
    expect(rpcArgs(backend, "unhide_coach")).toEqual([{ p_coach_id: HOME.coachJordan }]);
  });

  test("Book on a coach opens their open times", async ({ page, as, backend }) => {
    seedAthleteHome(backend);
    seedBookable(backend);
    await as(page, "parent");
    await page.goto("/dashboard");
    await page.getByRole("listitem").filter({ hasText: "Casey Coach" }).getByRole("button", { name: "Book" }).click();
    const dialog = page.getByRole("dialog", { name: "Book with Casey" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Review and pay" })).toBeDisabled();
    expect(rpcArgs(backend, "get_bookable_sessions")[0]).toMatchObject({ p_coach_id: IDS.coach });
    await expect(dialog.getByRole("link", { name: "Open full booking page" })).toHaveAttribute("href", `/book?coach=${IDS.coach}`);
  });

  test("an athlete with nothing booked is offered Book a session", async ({ page, as, backend }) => {
    seedAthleteHome(backend, { next: null, focus: null, coaches: [] });
    backend.rpc.get_my_invoices = [];
    await as(page, "athlete");
    await page.goto("/dashboard");
    await expect(page.getByText("Finish your profile")).toBeVisible();
    await expect(page.getByText("About you")).toBeVisible();
    await expect(page.getByText("Nothing booked yet.")).toBeVisible();
    await expect(page.getByText(/no coaches yet/i)).toBeVisible();
    await expect(page.getByRole("region", { name: "Invoices" })).toBeHidden();
    await page.getByRole("link", { name: "Book a session" }).last().click();
    await expect(page).toHaveURL(/\/book$/);
  });

  test("with no athlete yet, Create profile opens the athlete form", async ({ page, as }) => {
    await as(page, "parent");
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Set up your athlete profile" })).toBeVisible();
    await page.getByRole("link", { name: "Create profile" }).click();
    await expect(page).toHaveURL(/\/athlete-profile\/create$/);
    await expect(page.getByRole("heading", { name: "Create your profile" })).toBeVisible();
  });
});
