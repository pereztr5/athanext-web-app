import type { Page } from "@playwright/test";
import { test, expect } from "./test";
import { IDS } from "./personas";
import { MockError, type MockBackend } from "./backend";
import {
  SCH,
  addDays,
  athleteSession,
  bookableSession,
  coachBooking,
  bookingRecord,
  coachSession,
  familyInEastern,
  feedbackAthlete,
  feedbackScreen,
  happeningNow,
  installAthleteSessions,
  installCoachSessions,
  installSchedule,
  scheduleSession,
  shortDay,
  today,
} from "./data/schedule";

// One session's page, /sessions/:id. Coaches get the coach view (CoachSession.tsx); athletes
// and parents get theirs (AthleteSession.tsx) for the same link. Then the coach's feedback
// screen (/coach-session-feedback) and the coach's My sessions, which both lead back here.

const rpcArgs = (backend: MockBackend, name: string) => backend.writesTo(name).map((w) => w.body as Record<string, unknown>);
const weekdayDay = (iso: string) => shortDay(iso, { weekday: "short", month: "short", day: "numeric" });

test.describe("Session page as the coach", () => {
  const upcoming = (over: Record<string, unknown> = {}) =>
    coachSession({
      id: SCH.booked,
      date: addDays(today(), 2),
      start_time: "10:00:00",
      bookings: [coachBooking({ id: SCH.bookingA })],
      last_focus: { date: addDays(today(), -5), text: "Weak foot passing" },
      ...over,
    });

  test("a booked 1-on-1: who, when, where, how it was paid and the focus from last time", async ({ page, as, backend }) => {
    const s = upcoming();
    installCoachSessions(backend, [s]);
    await as(page, "coach");
    await page.goto(`/sessions/${SCH.booked}`);

    const header = page.getByRole("region", { name: "Session" });
    await expect(header.getByText("1-on-1 with Alex Athlete")).toBeVisible();
    await expect(header.getByText("Confirmed")).toBeVisible();
    await expect(header.getByText("On-field training")).toBeVisible();
    await expect(header.getByText(`${weekdayDay(s.date)} · 10:00 to 11:00 am`)).toBeVisible();
    await expect(page.getByText("Paid in app")).toBeVisible();
    await expect(page.getByText("$80.00")).toBeVisible();
    await expect(page.getByRole("link", { name: /Alex Athlete\s*Parent Pat Parent/ })).toHaveAttribute("href", `/athletes/${IDS.athlete}`);
    await expect(page.getByRole("link", { name: "Directions" })).toHaveAttribute("href", /google\.com\/maps\/search\/Central%20Park/);
    await expect(page.getByText("Focus from last time")).toBeVisible();
    await expect(page.getByText("Weak foot passing")).toBeVisible();
    expect(rpcArgs(backend, "get_coach_session")[0]).toEqual({ p_occurrence_id: SCH.booked });

    // Message opens the family's thread.
    await page.getByRole("button", { name: "Message" }).click();
    await expect(page).toHaveURL(/\/chat\?conversationId=00000000-0000-4000-8000-00000000cc01$/);
    expect(rpcArgs(backend, "open_family_conversation")).toEqual([{ p_athlete_id: IDS.athlete }]);
  });

  test("cancelling needs a reason and sends it; paid bookings come back as credits", async ({ page, as, backend }) => {
    installCoachSessions(backend, [upcoming()]);
    await as(page, "coach");
    await page.goto(`/sessions/${SCH.booked}`);
    await page.getByRole("button", { name: "Cancel session" }).click();

    const dialog = page.getByRole("dialog", { name: "Cancel this session?" });
    await expect(dialog.getByText("The family gets a session credit and is notified.")).toBeVisible();
    await expect(dialog.getByText(/1-on-1 with Alex Athlete, .* at 10:00 am/)).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel session" }).click();
    await expect(dialog.getByRole("alert")).toHaveText(/Choose a reason/);
    expect(backend.writesTo("coach_cancel_session")).toHaveLength(0);

    await dialog.getByLabel("Reason").selectOption("Weather");
    await dialog.getByRole("button", { name: "Cancel session" }).click();
    await expect(page.getByText("Session cancelled").first()).toBeVisible();
    await expect(page.getByText("1 credit given back. 1 family told").first()).toBeVisible();
    await expect(page).toHaveURL(/\/my-sessions$/);
    expect(rpcArgs(backend, "coach_cancel_session")).toEqual([{ p_occurrence_id: SCH.booked, p_reason: "Weather", p_message: "" }]);
    // Any Stripe share already sent is reversed for the session's bookings.
    await expect.poll(() => backend.writesTo("stripe-payouts").map((w) => w.body)).toEqual([{ action: "reverse_bookings", booking_ids: [SCH.bookingA] }]);
  });

  test("Keep session closes the cancel dialog without cancelling", async ({ page, as, backend }) => {
    installCoachSessions(backend, [upcoming()]);
    await as(page, "coach");
    await page.goto(`/sessions/${SCH.booked}`);
    await page.getByRole("button", { name: "Cancel session" }).click();
    await page.getByRole("button", { name: "Keep session" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(backend.writesTo("coach_cancel_session")).toHaveLength(0);
  });

  test("rescheduling moves the session to an open time and tells the family", async ({ page, as, backend }) => {
    const s = upcoming();
    const target = addDays(today(), 3);
    installCoachSessions(backend, [s]);
    // The reschedule dialog reads the schedule for open slots in the next two weeks.
    installSchedule(backend, {
      sessions: [
        scheduleSession({ id: SCH.booked, date: s.date, start_time: "10:00:00", bookings: [] }),
        scheduleSession({ id: SCH.open, date: target, start_time: "15:00:00" }),
      ],
    });
    await as(page, "coach");
    await page.goto(`/sessions/${SCH.booked}`);
    await page.getByRole("button", { name: "Reschedule" }).click();

    const dialog = page.getByRole("dialog", { name: "Reschedule" });
    await expect(dialog.getByText(`1-on-1 with Alex Athlete, now ${weekdayDay(s.date)} at 10:00 am`)).toBeVisible();
    await dialog.getByRole("button", { name: "Move session" }).click();
    await expect(dialog.getByText("Pick a new time")).toBeVisible();

    const day = dialog.getByRole("button").filter({ hasText: "1 open" });
    await expect(day).toHaveCount(1);
    await day.click();
    await expect(dialog.getByText(`Open times on ${weekdayDay(target)}`)).toBeVisible();
    await dialog.getByRole("button", { name: "3:00 pm" }).click();
    await dialog.getByLabel(/Message to the family/).fill("Field is booked that morning, sorry!");
    await dialog.getByRole("button", { name: "Move session" }).click();

    await expect(page.getByText(`Moved to ${weekdayDay(target)}, 3:00 pm`).first()).toBeVisible();
    await expect(page.getByText("1 family told").first()).toBeVisible();
    expect(rpcArgs(backend, "coach_move_session")).toEqual([
      { p_occurrence_id: SCH.booked, p_date: target, p_start: "15:00", p_message: "Field is booked that morning, sorry!" },
    ]);
  });

  test("a request: Accept books it", async ({ page, as, backend }) => {
    installCoachSessions(backend, [
      upcoming({ id: SCH.request, bookings: [coachBooking({ id: SCH.bookingA, status: "requested", payment_status: "unpaid", paid_amount: null })], last_focus: null }),
    ]);
    await as(page, "coach");
    await page.goto(`/sessions/${SCH.request}`);
    await expect(page.getByRole("region", { name: "Session" }).getByText("Request")).toBeVisible();
    await expect(page.getByText("Charged when you accept")).toBeVisible();
    await page.getByRole("button", { name: "Accept" }).click();
    await expect(page.getByText("Request accepted").first()).toBeVisible();
    await expect(page.getByText("It's booked.").first()).toBeVisible();
    expect(backend.writesTo("create-booking-payment-v0").map((w) => w.body)).toContainEqual({ action: "respond_request", booking_id: SCH.bookingA, accept: true });
  });

  test("a request: Decline needs a reason and keeps the note", async ({ page, as, backend }) => {
    installCoachSessions(backend, [
      upcoming({ id: SCH.request, bookings: [coachBooking({ id: SCH.bookingA, status: "requested", payment_status: "unpaid", paid_amount: null })], last_focus: null }),
    ]);
    await as(page, "coach");
    await page.goto(`/sessions/${SCH.request}`);
    await page.getByRole("button", { name: "Decline" }).click();
    const dialog = page.getByRole("dialog", { name: "Decline request" });
    await expect(dialog.getByText(/Pat Parent for Alex Athlete/)).toBeVisible();
    await dialog.getByRole("button", { name: "Decline request" }).click();
    await expect(dialog.getByRole("alert")).toHaveText(/Choose a reason/);
    await dialog.getByLabel("Reason").selectOption("Fully booked this season");
    await dialog.getByPlaceholder("Suggest another time or coach").fill("Try Coach Sam on Tuesdays.");
    await dialog.getByRole("button", { name: "Decline request" }).click();
    await expect(page.getByText("Request declined").first()).toBeVisible();
    expect(backend.writesTo("create-booking-payment-v0").map((w) => w.body)).toContainEqual({ action: "respond_request", booking_id: SCH.bookingA, accept: false });
    expect(rpcArgs(backend, "coach_decline_note")).toEqual([{ p_booking_id: SCH.bookingA, p_reason: "Fully booked this season", p_message: "Try Coach Sam on Tuesdays." }]);
  });

  test("a group that ended without feedback: the roster with payments and Add feedback", async ({ page, as, backend }) => {
    installCoachSessions(backend, [
      coachSession({
        id: SCH.pastGroup,
        date: addDays(today(), -1),
        start_time: "17:00:00",
        session_type: "group",
        session_name: "U12 finishing",
        price: 40,
        capacity: 8,
        started: true,
        ended: true,
        bookings: [
          coachBooking({ id: SCH.bookingA, attendance: "present" }),
          coachBooking({ id: SCH.bookingB, athlete_id: SCH.athleteB, name: "Blake Baker", parent_name: null, age: 19, payment_status: "unpaid", attendance: "absent" }),
        ],
      }),
    ]);
    await as(page, "coach");
    await page.goto(`/sessions/${SCH.pastGroup}`);
    const header = page.getByRole("region", { name: "Session" });
    await expect(header.getByText("U12 finishing")).toBeVisible();
    await expect(header.getByText("Completed")).toBeVisible();
    await expect(header.getByText("2 of 8 spots · $40 per athlete")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Athletes" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Alex Athlete\s*Parent Pat Parent\s*Paid/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Blake Baker\s*Athlete, 18\+\s*Absent\s*Not paid/ })).toBeVisible();
    await expect(page.getByText(/Feedback due\. Families see it/)).toBeVisible();
    // No cancelling or moving a session that is over.
    await expect(page.getByRole("button", { name: "Cancel session" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reschedule" })).toHaveCount(0);

    backend.rpc.get_feedback_screen = feedbackScreen({ id: SCH.pastGroup, date: addDays(today(), -1), start_time: "17:00:00", session_type: "group", session_name: "U12 finishing" });
    await page.getByRole("link", { name: "Add feedback" }).click();
    await expect(page).toHaveURL(new RegExp(`/coach-session-feedback\\?slotId=${SCH.pastGroup}$`));
    await expect(page.getByText("Feedback due").first()).toBeVisible();
  });

  test("a group with feedback shows the score, the summary and who it was shared with", async ({ page, as, backend }) => {
    installCoachSessions(backend, [
      coachSession({
        id: SCH.pastGroup,
        date: addDays(today(), -1),
        start_time: "17:00:00",
        session_type: "group",
        session_name: "U12 finishing",
        capacity: 8,
        started: true,
        ended: true,
        bookings: [coachBooking({ id: SCH.bookingA, attendance: "present", note: "Great first touch" })],
        feedback: { summary: "We worked on finishing with both feet.", no_show: false, edit_count: 0, score: 8 },
      }),
    ]);
    await as(page, "coach");
    await page.goto(`/sessions/${SCH.pastGroup}`);
    await expect(page.getByRole("heading", { name: "Feedback" })).toBeVisible();
    await expect(page.getByText("We worked on finishing with both feet.")).toBeVisible();
    await expect(page.getByText(/^8\s*\/10 · /)).toBeVisible();
    await expect(page.getByText("Shared with each family")).toBeVisible();
    await expect(page.getByText("Notes sent for Alex")).toBeVisible();
    await expect(page.getByRole("link", { name: "Note for an athlete" })).toHaveAttribute("href", `/coach-session-feedback?slotId=${SCH.pastGroup}&notes=1`);
    await expect(page.getByRole("link", { name: "Edit feedback" })).toBeVisible();
  });

  test("a session the coach cancelled says when, why and what came back", async ({ page, as, backend }) => {
    const at = new Date(Date.now() - 86_400_000).toISOString();
    installCoachSessions(backend, [
      upcoming({
        is_enabled: false,
        cancel: { at, reason: "Weather", refund: "The family got a session credit" },
        bookings: [coachBooking({ id: SCH.bookingA, status: "canceled", cancellation_reason: "Cancelled by coach. Weather", canceled_at: at, credit_back: true })],
        last_focus: null,
      }),
    ]);
    await as(page, "coach");
    await page.goto(`/sessions/${SCH.booked}`);
    await expect(page.getByRole("region", { name: "Session" }).getByText("Cancelled")).toBeVisible();
    await expect(page.getByText(/^Cancelled by you on .*\. Weather\. The family got a session credit\.$/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel session" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reschedule" })).toHaveCount(0);
  });

  test("a session that isn't the coach's says it wasn't found", async ({ page, as, backend }) => {
    // get_coach_session raises "Session not found" (42501) for a missing or someone else's session.
    installCoachSessions(backend, []);
    await as(page, "coach");
    await page.goto(`/sessions/${SCH.past}`);
    // React Query retries three times first.
    await expect(page.getByText("Session not found. It may have been removed.")).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("Session page as a family", () => {
  const booked = (over: Record<string, unknown> = {}) =>
    athleteSession({ id: SCH.booked, date: addDays(today(), 4), start_time: "10:00:00", ...over });

  const asFamily = async (page: Page, as: (page: Page, persona: "parent" | "athlete") => Promise<void>, backend: MockBackend, who: "parent" | "athlete") => {
    familyInEastern(backend, who === "parent" ? IDS.parentUser : IDS.athleteUser);
    await as(page, who);
  };

  test("a parent sees the coach's session: when, where, paid, and free cancellation", async ({ page, as, backend }) => {
    const s = booked();
    installAthleteSessions(backend, [s]);
    await asFamily(page, as, backend, "parent");
    await page.goto(`/sessions/${SCH.booked}`);
    const header = page.getByRole("region", { name: "Session" });
    await expect(header.getByText("On-field training with Casey Coach")).toBeVisible();
    await expect(header.getByText("Confirmed")).toBeVisible();
    await expect(header.getByText(`${weekdayDay(s.date)} · 10:00 to 11:00 am`)).toBeVisible();
    await expect(page.getByText("Paid $80 by card")).toBeVisible();
    await expect(page.getByText("60 minutes")).toBeVisible();
    await expect(page.getByText(`Free cancellation until 10:00 am on ${weekdayDay(addDays(s.date, -1))}. The session comes back as a credit.`)).toBeVisible();
    await expect(page.getByRole("link", { name: /Casey Coach\s*Coach/ })).toHaveAttribute("href", new RegExp(IDS.coachSlug));
    await expect(page.getByRole("button", { name: "Reschedule" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add to calendar" })).toBeVisible();
    expect(rpcArgs(backend, "get_athlete_session")[0]).toEqual({ p_occurrence_id: SCH.booked });
  });

  test("cancelling my booking needs a reason and comes back as a credit", async ({ page, as, backend }) => {
    installAthleteSessions(backend, [booked()]);
    await asFamily(page, as, backend, "parent");
    await page.goto(`/sessions/${SCH.booked}`);
    await page.getByRole("button", { name: "Cancel session" }).click();
    const dialog = page.getByRole("dialog", { name: "Cancel this session?" });
    await expect(dialog.getByText("You get a session credit with Casey right away.")).toBeVisible();
    const confirm = dialog.getByRole("button", { name: "Cancel session" });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel("Reason").selectOption("Travel");
    await confirm.click();
    await expect(page.getByText("Session cancelled").first()).toBeVisible();
    await expect(page.getByText("It's back as a credit with Casey for 90 days.").first()).toBeVisible();
    expect(rpcArgs(backend, "cancel_my_booking")).toEqual([{ p_booking_id: SCH.bookingA, p_reason: "Travel" }]);
    await expect.poll(() => backend.writesTo("stripe-payouts").map((w) => w.body)).toEqual([{ action: "reverse_bookings", booking_ids: [SCH.bookingA] }]);
  });

  test("less than the notice away, cancelling warns that it isn't refunded and Reschedule is gone", async ({ page, as, backend }) => {
    const soon = new Date(Date.now() + 3 * 3600_000);
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(soon);
    const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(soon));
    // Keep the whole session inside one Eastern day.
    test.skip(hour >= 23, "too close to midnight Eastern for a same-day session");
    installAthleteSessions(backend, [booked({ date, start_time: `${String(hour).padStart(2, "0")}:00:00` })]);
    await asFamily(page, as, backend, "parent");
    await page.goto(`/sessions/${SCH.booked}`);
    await expect(page.getByText("Less than 24 hours away. Cancelling now is not refunded.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reschedule" })).toHaveCount(0);
    await page.getByRole("button", { name: "Cancel session" }).click();
    await expect(page.getByRole("dialog").getByText("This session is less than 24 hours away, so it is not refunded.")).toBeVisible();
  });

  test("reschedule asks for a new time first", async ({ page, as, backend }) => {
    installAthleteSessions(backend, [booked()]);
    backend.rpc.get_bookable_sessions = { coach: null, sessions: [] };
    await asFamily(page, as, backend, "parent");
    await page.goto(`/sessions/${SCH.booked}`);
    await page.getByRole("button", { name: "Reschedule" }).click();
    const dialog = page.getByRole("dialog", { name: "Reschedule" });
    await expect(dialog.getByText("No open times this day")).toBeVisible();
    await dialog.getByRole("button", { name: "Move session" }).click();
    await expect(dialog.getByText("Pick a new time")).toBeVisible();
    expect(backend.writesTo("reschedule_my_booking")).toHaveLength(0);
    const asked = rpcArgs(backend, "get_bookable_sessions")[0];
    expect(asked).toMatchObject({ p_coach_id: IDS.coach });
  });

  test("rescheduling moves my booking to another open time", async ({ page, as, backend }) => {
    const s = booked();
    const target = addDays(today(), 6);
    installAthleteSessions(backend, [s]);
    backend.rpc.get_bookable_sessions = {
      coach: null,
      sessions: [bookableSession({ id: SCH.open, occurrence_date: target, start_time: "15:00:00", pillar: "On-field training" })],
    };
    await asFamily(page, as, backend, "parent");
    await page.goto(`/sessions/${SCH.booked}`);
    await page.getByRole("button", { name: "Reschedule" }).click();
    const dialog = page.getByRole("dialog", { name: "Reschedule" });
    await dialog.getByRole("button").filter({ hasText: "1 open" }).click();
    await dialog.getByRole("button", { name: "3:00 pm" }).click();
    await dialog.getByLabel(/Message to Casey/).fill("Exam week, thanks!");
    await dialog.getByRole("button", { name: "Move session" }).click();
    await expect(page.getByText(`Moved to ${weekdayDay(target)}, 3:00 pm`).first()).toBeVisible();
    expect(rpcArgs(backend, "reschedule_my_booking")).toEqual([{ p_booking_id: SCH.bookingA, p_new_occurrence_id: SCH.open, p_message: "Exam week, thanks!" }]);
    await expect(page).toHaveURL(new RegExp(`/sessions/${SCH.open}$`));
  });

  test("an athlete withdraws a request", async ({ page, as, backend }) => {
    installAthleteSessions(backend, [booked({ booking: { status: "requested", payment_status: "unpaid", paid_amount: null } })]);
    await asFamily(page, as, backend, "athlete");
    await page.goto(`/sessions/${SCH.booked}`);
    await expect(page.getByRole("region", { name: "Session" }).getByText("Request, waiting for Casey")).toBeVisible();
    await expect(page.getByText("Waiting for Casey to accept. You're only charged if they do.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel session" })).toHaveCount(0);
    await page.getByRole("button", { name: "Withdraw request" }).click();
    const dialog = page.getByRole("dialog", { name: "Withdraw this request?" });
    await dialog.getByRole("button", { name: "Withdraw request" }).click();
    await expect(page.getByText("Request withdrawn").first()).toBeVisible();
    expect(rpcArgs(backend, "cancel_my_booking")[0]).toEqual({ p_booking_id: SCH.bookingA, p_reason: "Request withdrawn" });
  });

  test("after the session: the coach's feedback, score and note, with Rate and Book again", async ({ page, as, backend }) => {
    installAthleteSessions(backend, [
      booked({
        date: addDays(today(), -2),
        started: true,
        ended: true,
        attendance: "present",
        summary: "Big step forward on first touch.",
        score: 9,
        note: "Keep doing wall passes at home.",
      }),
    ]);
    await asFamily(page, as, backend, "athlete");
    await page.goto(`/sessions/${SCH.booked}`);
    await expect(page.getByRole("region", { name: "Session" }).getByText("Completed")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Feedback" })).toBeVisible();
    await expect(page.getByText("Big step forward on first touch.")).toBeVisible();
    await expect(page.getByText("Just for you")).toBeVisible();
    await expect(page.getByText("Keep doing wall passes at home.")).toBeVisible();
    await expect(page.getByText(/^9\s*\/10 · /)).toBeVisible();
    await expect(page.getByRole("link", { name: "Book again" })).toHaveAttribute("href", `/book?coach=${IDS.coach}`);
    await expect(page.getByRole("button", { name: "Cancel session" })).toHaveCount(0);
    await page.getByRole("button", { name: "Rate session" }).click();
    await expect(page).toHaveURL(/\/my-sessions(\?rate=.*)?$/);
  });

  test("a missed session says so", async ({ page, as, backend }) => {
    installAthleteSessions(backend, [
      booked({ date: addDays(today(), -2), started: true, ended: true, attendance: "no_show", missed_message: "Alex was marked as missed for this session." }),
    ]);
    await asFamily(page, as, backend, "athlete");
    await page.goto(`/sessions/${SCH.booked}`);
    await expect(page.getByRole("region", { name: "Session" }).getByText("Missed")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Missed session" })).toBeVisible();
    await expect(page.getByText("Alex was marked as missed for this session.")).toBeVisible();
  });

  test("a session that isn't theirs says it wasn't found", async ({ page, as, backend }) => {
    // get_athlete_session raises "Session not found" when the family has no booking on it.
    installAthleteSessions(backend, []);
    await asFamily(page, as, backend, "parent");
    await page.goto(`/sessions/${SCH.past}`);
    await expect(page.getByRole("heading", { name: "Session not found" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("link", { name: "Back to my sessions" })).toHaveAttribute("href", "/my-sessions");
  });
});

test.describe("Session feedback", () => {
  const yesterday = () => addDays(today(), -1);
  const groupScreen = (over: Record<string, unknown> = {}) =>
    feedbackScreen({
      id: SCH.pastGroup,
      date: yesterday(),
      start_time: "17:00:00",
      session_type: "group",
      session_name: "U12 finishing",
      athletes: [
        feedbackAthlete({ booking_id: SCH.bookingA, athlete_id: IDS.athlete, name: "Alex Athlete", parent_name: "Pat Parent" }),
        feedbackAthlete({ booking_id: SCH.bookingB, athlete_id: SCH.athleteB, name: "Blake Baker" }),
        feedbackAthlete({ booking_id: SCH.bookingC, athlete_id: SCH.athleteC, name: "Cam Cole" }),
      ],
      ...over,
    });
  // Sending lands on the session page.
  const sessionPage = (backend: MockBackend, id: string, type: "group" | "individual") =>
    installCoachSessions(backend, [
      coachSession({ id, date: yesterday(), start_time: "17:00:00", session_type: type, session_name: "U12 finishing", capacity: 8, started: true, ended: true, bookings: [coachBooking({ id: SCH.bookingA })] }),
    ]);

  test("a group: roll call, score, summary and a note, sent to the families who came", async ({ page, as, backend }) => {
    backend.rpc.get_feedback_screen = groupScreen();
    backend.rpc.get_feedback_due = [];
    backend.rpc.submit_session_feedback = { no_show: false, present: 2 };
    sessionPage(backend, SCH.pastGroup, "group");
    await as(page, "coach");
    await page.goto(`/coach-session-feedback?slotId=${SCH.pastGroup}`);

    const header = page.getByRole("region", { name: "Session" });
    await expect(header.getByText("U12 finishing")).toBeVisible();
    await expect(header.getByText("Feedback due")).toBeVisible();
    await expect(header.getByText("3 athletes · 3 families")).toBeVisible();
    expect(rpcArgs(backend, "get_feedback_screen")[0]).toEqual({ p_slot_id: SCH.pastGroup });

    // Everyone starts as here; Cam missed it.
    await page.getByRole("group", { name: "Was Cam here?" }).getByRole("button", { name: "Missed" }).click();
    await expect(page.getByText("Marked as missed. No individual note.")).toBeVisible();

    // Nothing sends until the score is above 0.
    const send = page.getByRole("button", { name: "Send to 2 families" });
    await expect(page.getByText("Slide the score above 0 to send")).toBeVisible();
    await expect(send).toBeDisabled();
    const slider = page.getByRole("slider", { name: "Session score from 0 to 10" });
    await slider.focus();
    await page.keyboard.press("ArrowRight", { delay: 10 });
    for (let i = 0; i < 7; i++) await page.keyboard.press("ArrowRight");
    await expect(slider).toHaveValue("8");

    await page.getByRole("textbox", { name: "Summary" }).fill("We worked on finishing with both feet.");
    // A personal note for Alex, sent with the summary.
    await page.getByRole("button", { name: /^Alex Athlete/ }).click();
    await page.getByLabel("Note for Alex Athlete").fill("Great first touch today.");
    await expect(page.getByText("2 families · Cam missed · 1 personal note included")).toBeVisible();
    await send.click();

    await expect(page).toHaveURL(new RegExp(`/sessions/${SCH.pastGroup}$`));
    await expect(page.getByText("Feedback sent to 2 families").first()).toBeVisible();
    expect(rpcArgs(backend, "submit_session_feedback")).toEqual([
      {
        p_slot_id: SCH.pastGroup,
        p_absent: [SCH.athleteC],
        p_score: 8,
        p_summary: "We worked on finishing with both feet.",
        p_notes: { [SCH.bookingA]: "Great first touch today." },
      },
    ]);
  });

  test("a 1-on-1 no-show: no score needed, marked as no-show", async ({ page, as, backend }) => {
    backend.rpc.get_feedback_screen = feedbackScreen({
      id: SCH.past,
      date: yesterday(),
      start_time: "17:00:00",
      athletes: [feedbackAthlete({ booking_id: SCH.bookingA, athlete_id: IDS.athlete, name: "Alex Athlete" })],
    });
    backend.rpc.get_feedback_due = [];
    backend.rpc.submit_session_feedback = { no_show: true, present: 0 };
    sessionPage(backend, SCH.past, "individual");
    await as(page, "coach");
    await page.goto(`/coach-session-feedback?slotId=${SCH.past}`);
    await expect(page.getByRole("region", { name: "Session" }).getByText("1-on-1 with Alex")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send to Alex's family" })).toBeDisabled();

    await page.getByRole("button", { name: "No", exact: true }).click();
    await expect(page.getByText("Alex wasn't present")).toBeVisible();
    await expect(page.getByRole("slider")).toHaveCount(0);
    await page.getByRole("textbox", { name: "Message" }).fill("We missed Alex today. Want to book a make-up session?");
    await page.getByRole("button", { name: "Mark as no-show" }).click();

    await expect(page).toHaveURL(new RegExp(`/sessions/${SCH.past}$`));
    await expect(page.getByText("Marked as no-show. Message sent to Alex's family").first()).toBeVisible();
    expect(rpcArgs(backend, "submit_session_feedback")).toEqual([
      { p_slot_id: SCH.past, p_absent: [IDS.athlete], p_score: 0, p_summary: "We missed Alex today. Want to book a make-up session?" },
    ]);
  });

  test("the feedback-due queue steps to the next session", async ({ page, as, backend }) => {
    backend.rpc.get_feedback_screen = (args) => groupScreen({ id: args.p_slot_id, session_name: args.p_slot_id === SCH.pastGroup ? "U12 finishing" : "U14 passing" });
    backend.rpc.get_feedback_due = [
      { id: SCH.pastGroup, date: yesterday(), start_time: "17:00:00", title: "U12 finishing" },
      { id: SCH.past, date: addDays(today(), -2), start_time: "17:00:00", title: "U14 passing" },
    ];
    await as(page, "coach");
    await page.goto(`/coach-session-feedback?slotId=${SCH.pastGroup}`);
    await expect(page.getByText("1 of 2")).toBeVisible();
    await page.getByRole("button", { name: "Next session" }).click();
    await expect(page).toHaveURL(new RegExp(`slotId=${SCH.past}$`));
    await expect(page.getByText("2 of 2")).toBeVisible();
    await expect(page.getByRole("region", { name: "Session" }).getByText("U14 passing")).toBeVisible();
  });

  test("feedback edited once is locked, but notes for athletes can still be sent", async ({ page, as, backend }) => {
    backend.rpc.get_feedback_screen = groupScreen({
      submitted: true,
      edit_count: 1,
      score: 7,
      summary: "Good session.",
      athletes: [
        feedbackAthlete({ booking_id: SCH.bookingA, athlete_id: IDS.athlete, name: "Alex Athlete", attendance: "present" }),
        feedbackAthlete({ booking_id: SCH.bookingB, athlete_id: SCH.athleteB, name: "Blake Baker", attendance: "present" }),
      ],
    });
    backend.rpc.get_feedback_due = [];
    await as(page, "coach");
    await page.goto(`/coach-session-feedback?slotId=${SCH.pastGroup}`);
    await expect(page.getByText("Feedback was already edited once, so it can't change again. You can still add notes.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Summary" })).toBeDisabled();
    await page.getByRole("button", { name: "Notes for athletes" }).click();
    await expect(page.getByRole("heading", { name: "Add a note for anyone?" })).toBeVisible();
    await page.getByRole("button", { name: /^Blake/ }).click();
    const dialog = page.getByRole("dialog", { name: "Note for Blake" });
    await dialog.getByRole("textbox").fill("Keep working on your weak foot.");
    await dialog.getByRole("button", { name: "Send note" }).click();
    await expect(page.getByText("Note sent to Blake's family").first()).toBeVisible();
    expect(rpcArgs(backend, "set_session_note")).toEqual([{ p_booking_id: SCH.bookingB, p_note: "Keep working on your weak foot." }]);
  });

  test("before the session starts, feedback isn't open yet", async ({ page, as, backend }) => {
    backend.rpc.get_feedback_screen = groupScreen({ date: addDays(today(), 1), started: false, ended: false });
    backend.rpc.get_feedback_due = [];
    await as(page, "coach");
    await page.goto(`/coach-session-feedback?slotId=${SCH.pastGroup}`);
    await expect(page.getByText("Feedback opens once the session starts.")).toBeVisible();
    await expect(page.getByRole("slider")).toHaveCount(0);
  });

  test("a session that isn't the coach's can't be opened", async ({ page, as, backend }) => {
    // get_feedback_screen raises "Session not found" (42501) for someone else's session.
    backend.rpc.get_feedback_screen = () => new MockError("Session not found", 403, "42501");
    backend.rpc.get_feedback_due = [];
    await as(page, "coach");
    await page.goto(`/coach-session-feedback?slotId=${SCH.pastGroup}`);
    await expect(page.getByText("Couldn't open this session. It may not be yours, or it was removed.")).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("My sessions as the coach", () => {
  const seedSessions = (backend: MockBackend) => {
    const now = happeningNow();
    const tomorrow = addDays(today(), 1);
    const yesterday = addDays(today(), -1);
    backend.rpc.get_bookings_by_user_id = [
      bookingRecord({ booking_id: SCH.bookingA, occurrence_id: SCH.live, session_date: now.date, slot_start_time: now.start, slot_end_time: now.end }),
      bookingRecord({
        booking_id: SCH.bookingB,
        occurrence_id: SCH.group,
        session_date: tomorrow,
        slot_start_time: "17:00:00",
        slot_end_time: "18:30:00",
        slot_session_type: "group",
        slot_session_name: "U12 finishing",
        slot_price: 40,
        athlete_count: 2,
        athletes_names: ["Blake Baker", "Cam Cole"],
      }),
      bookingRecord({ booking_id: SCH.bookingC, occurrence_id: SCH.past, session_date: yesterday, slot_start_time: "10:00:00", slot_end_time: "11:00:00" }),
      bookingRecord({
        booking_id: "00000000-0000-4000-8000-0000000052b4",
        occurrence_id: SCH.pastGroup,
        session_date: addDays(today(), -3),
        slot_start_time: "17:00:00",
        slot_end_time: "18:00:00",
        slot_session_type: "group",
        slot_session_name: "U10 ball mastery",
        athlete_count: 1,
        athletes_names: ["Blake Baker"],
        has_session_feedback: true,
      }),
    ];
    backend.seed("coach_availability_slot_occurrences", [
      { id: SCH.group, max_bookings_per_slot: 8, place: "Central Park", pillar_slot: null, camp_id: null },
    ]);
    familyInEastern(backend, IDS.coachUser);
    return { now, tomorrow, yesterday };
  };
  const section = (page: Page, title: string) => page.locator("section").filter({ has: page.getByRole("heading", { name: title }) });

  test("sorts sessions into in progress, upcoming and previous", async ({ page, as, backend }) => {
    const { tomorrow, yesterday } = seedSessions(backend);
    await as(page, "coach");
    await page.goto("/my-sessions");
    await expect(page.getByRole("heading", { name: "My sessions" })).toBeVisible();
    expect(rpcArgs(backend, "get_bookings_by_user_id")[0]).toEqual({ athlete_id_param: null, coach_id_param: IDS.coach });

    const live = section(page, "In progress sessions");
    await expect(live.getByRole("link", { name: /^1-on-1 with Alex, .*Open session$/ })).toBeVisible();
    await expect(live.getByText("In progress", { exact: true })).toBeVisible();
    await expect(live.getByRole("button", { name: "Check in" })).toBeVisible();

    const upcoming = section(page, "Upcoming sessions");
    const group = upcoming.getByRole("link", { name: new RegExp(`^U12 finishing, ${weekdayDay(tomorrow)} · 5:00 to 6:30 pm`) });
    await expect(group).toBeVisible();
    await expect(group.getByText("2 of 8 athletes")).toBeVisible();
    await expect(group.getByText("Central Park")).toBeVisible();

    const previous = section(page, "Previous sessions");
    const due = previous.getByRole("link", { name: new RegExp(`^1-on-1 with Alex, ${weekdayDay(yesterday)}`) });
    await expect(due.getByText("Feedback due")).toBeVisible();
    await expect(due.getByRole("button", { name: "Add feedback" })).toBeVisible();
    const sent = previous.getByRole("link", { name: /^U10 ball mastery/ });
    await expect(sent.getByText("Feedback sent")).toBeVisible();
    await expect(sent.getByRole("button", { name: "Edit feedback" })).toBeVisible();
    // Feedback due comes first.
    await expect(previous.getByRole("link").first()).toHaveAccessibleName(/^1-on-1 with Alex/);
  });

  test("Check in and Add feedback open the feedback screen for that session", async ({ page, as, backend }) => {
    seedSessions(backend);
    backend.rpc.get_feedback_screen = (args) =>
      feedbackScreen({ id: args.p_slot_id, date: today(), start_time: "10:00:00", athletes: [feedbackAthlete({ booking_id: SCH.bookingA, athlete_id: IDS.athlete, name: "Alex Athlete" })] });
    backend.rpc.get_feedback_due = [];
    await as(page, "coach");
    await page.goto("/my-sessions");
    await section(page, "In progress sessions").getByRole("button", { name: "Check in" }).click();
    await expect(page).toHaveURL(new RegExp(`/coach-session-feedback\\?slotId=${SCH.live}$`));
    await page.goBack();
    await section(page, "Previous sessions").getByRole("button", { name: "Add feedback" }).click();
    await expect(page).toHaveURL(new RegExp(`/coach-session-feedback\\?slotId=${SCH.past}$`));
  });

  test("a card opens its session page", async ({ page, as, backend }) => {
    const { tomorrow } = seedSessions(backend);
    installCoachSessions(backend, [
      coachSession({ id: SCH.group, date: tomorrow, start_time: "17:00:00", duration_minutes: 90, session_type: "group", session_name: "U12 finishing", capacity: 8 }),
    ]);
    await as(page, "coach");
    await page.goto("/my-sessions");
    await section(page, "Upcoming sessions").getByRole("button", { name: "View details" }).click();
    await expect(page).toHaveURL(new RegExp(`/sessions/${SCH.group}$`));
    await expect(page.getByRole("region", { name: "Session" }).getByText("U12 finishing")).toBeVisible();
  });
});
