import type { Page } from "@playwright/test";
import { test, expect } from "./test";
import { MockError } from "./backend";
import { IDS } from "./personas";
import { isPhone } from "./helpers";
import {
  BOOK_IDS,
  bookableSession,
  bookingCoach,
  groupOffer,
  isoDay,
  mySessionRow,
  offerSession,
  receipt,
  receiptBooking,
  seedBookable,
  seedCoachProfile,
  seedDirectory,
  seedFees,
  seedParentChild,
  utcClock,
} from "./data/booking";

// Discovery and booking as a family: the coach directory, a coach's public profile and pricing
// page, Book a Session through checkout, the receipts Stripe returns to, group offers, intro
// calls, My coaches and My sessions. Camps are in camp-signup.spec.ts.

const CHECKOUT_URL = "https://checkout.stripe.com/c/pay/cs_test_e2e";

/** The body of the only call to an edge function. */
const onlyCall = (backend: { writesTo: (name: string) => { body: unknown }[] }, name: string) => {
  const calls = backend.writesTo(name);
  expect(calls, `${name} calls`).toHaveLength(1);
  return calls[0].body as Record<string, unknown>;
};

/** "Continue" from the time picker: the in-card footer on wide screens, the pick bar on phones. */
const continueToReview = async (page: Page) => {
  await page.getByRole("button", { name: "Continue", exact: true }).filter({ visible: true }).first().click();
};

// ---------------------------------------------------------------------------------------------
// Directory
// ---------------------------------------------------------------------------------------------

test.describe("coach directory", () => {
  test("signed out: every listed coach shows, search and sport narrow it, a card opens the profile", async ({ page, backend }) => {
    seedDirectory(backend);
    seedCoachProfile(backend);
    await page.goto("/coaches");

    await expect(page.getByRole("heading", { name: "Discover your coach in our growing directory" })).toBeVisible();
    await expect(page.getByText(/^3 coaches\b/)).toBeVisible();
    for (const name of ["Casey Coach", "Robin Rower", "Gale Keeper"]) await expect(page.getByRole("button", { name: `View ${name} profile` })).toBeVisible();
    await expect(page.getByText("Sports: Soccer & Rowing")).toBeVisible();

    await page.getByPlaceholder("Search coaches, pillars").fill("goalkeeping");
    await expect(page.getByText(/^1 coach\b/)).toBeVisible();
    await expect(page.getByRole("button", { name: "View Gale Keeper profile" })).toBeVisible();
    await expect(page.getByRole("button", { name: "View Casey Coach profile" })).toHaveCount(0);

    await page.getByRole("button", { name: "Clear filters" }).first().click();
    await expect(page.getByText(/^3 coaches\b/)).toBeVisible();

    await page.getByRole("combobox", { name: "Sport" }).selectOption("Rowing");
    await expect(page.getByText(/^1 coach\b/)).toBeVisible();
    await expect(page.getByRole("button", { name: "View Robin Rower profile" })).toBeVisible();

    await page.getByPlaceholder("Search coaches, pillars").fill("nobody like this");
    await expect(page.getByText("No coaches match")).toBeVisible();

    await page.getByRole("combobox", { name: "Sport" }).selectOption("All Sports");
    await page.getByPlaceholder("Search coaches, pillars").fill("");
    await page.getByRole("button", { name: "View Casey Coach profile" }).getByRole("button", { name: "View full profile" }).click();
    // Opened by id, then moved to the coach's slug.
    await expect(page).toHaveURL(/\/coach\/casey-coach$/);
    await expect(page.getByText("Casey Coach").first()).toBeVisible();
  });

  test("as a parent: browse cards, filters, sort and a card opening the profile", async ({ page, backend, as }) => {
    seedDirectory(backend);
    seedCoachProfile(backend);
    await as(page, "parent");
    await page.goto("/coaches");

    await expect(page.getByRole("heading", { name: "View All Coaches" })).toBeVisible();
    // The parent's sport (soccer) is picked for them, so the rowing coach isn't listed.
    const cards = page.getByRole("link", { name: /^View .+'s profile$/ });
    await expect(cards).toHaveCount(2);
    await expect(page.getByRole("link", { name: "View Robin Rower's profile" })).toHaveCount(0);
    const casey = page.getByRole("link", { name: "View Casey Coach's profile" });
    await expect(casey).toContainText("From $80");
    await expect(casey).toContainText("Technique");
    await expect(casey).toContainText("Independent coach");
    // Recommended: higher rating first.
    await expect(cards.first()).toHaveAccessibleName("View Gale Keeper's profile");

    await page.getByRole("combobox", { name: "Session type" }).selectOption("virtual");
    await expect(cards).toHaveCount(1);
    await expect(casey).toBeVisible();
    await page.getByRole("combobox", { name: "Session type" }).selectOption("any");

    // Ages 8-18 overlap U16 to U18; 6-12 doesn't.
    await page.getByRole("combobox", { name: "Age group" }).selectOption("U16 to U18");
    await expect(cards).toHaveCount(1);
    await expect(casey).toBeVisible();
    await page.getByRole("combobox", { name: "Age group" }).selectOption("Any age");
    await expect(cards).toHaveCount(2);

    await page.getByRole("combobox", { name: "Sort" }).selectOption("price-asc");
    await expect(cards.first()).toHaveAccessibleName("View Casey Coach's profile");
    await expect(cards.last()).toHaveAccessibleName("View Gale Keeper's profile");

    await page.getByRole("link", { name: "View Gale Keeper's profile" }).getByRole("button", { name: "View profile" }).click();
    await expect(page).toHaveURL(/\/coach\/gale-keeper$/);
    await expect(page.getByText("Gale Keeper").first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------------------------
// Public profile and pricing
// ---------------------------------------------------------------------------------------------

test.describe("coach profile", () => {
  test("signed out: packages, about, credentials, FAQ and availability; Book asks to sign in", async ({ page, backend }) => {
    seedDirectory(backend);
    seedCoachProfile(backend);
    await page.goto(`/coach/${IDS.coachSlug}`);

    await expect(page.getByText("Casey Coach").first()).toBeVisible();
    await expect(page.getByText("Coaching packages")).toBeVisible();
    await expect(page.getByText("5-session pack").first()).toBeVisible();
    await expect(page.getByText("$375").first()).toBeVisible();
    await expect(page.getByText("10-session pack").first()).toBeVisible();
    await expect(page.getByText("About Casey")).toBeVisible();
    await expect(page.getByText("USSF C License")).toBeVisible();
    await expect(page.getByText("What should we bring?")).toBeVisible();
    await expect(page.getByText("2 slots open")).toBeVisible();

    await page.getByRole("button", { name: "Book a session" }).first().click();
    await expect(page).toHaveURL(/\/auth\?mode=signin$/);
    await expect(page.getByText(/welcome back/i).first()).toBeVisible();
  });

  test("by id opens the same profile at its slug", async ({ page, backend }) => {
    seedDirectory(backend);
    seedCoachProfile(backend);
    await page.goto(`/coach/${IDS.coach}`);
    await expect(page).toHaveURL(/\/coach\/casey-coach$/);
    await expect(page.getByText("About Casey")).toBeVisible();
  });

  // An unknown slug (resolve_coach_by_slug_or_id returns null, as the SQL does) shows the page's
  // "Coach not found" state, on the profile and on its pricing link: no react-query retries on a
  // skeleton, no toast + navigate during render that ends on sign-in.
  for (const signedIn of [false, true]) {
    test(`an unknown coach shows Coach not found${signedIn ? " when signed in" : ""}`, async ({ page, backend, as }) => {
      seedDirectory(backend);
      seedCoachProfile(backend);
      if (signedIn) await as(page, "parent");
      const lookups = () =>
        backend.writes.filter((w) => w.kind === "rpc" && w.name === "resolve_coach_by_slug_or_id" && (w.body as { p_key?: string })?.p_key === "no-such-coach").length;
      for (const path of ["/coach/no-such-coach", "/coach/no-such-coach/pricing"]) {
        const before = lookups();
        await page.goto(path);
        await expect(page.getByRole("heading", { name: "Coach not found" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Browse coaches" })).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`${path}$`));
        // One lookup: not retried, and not repeated when the app shell remounts the page.
        expect(lookups() - before).toBe(1);
      }
    });
  }

  test("as a parent: who card, pricing, reviews with replies and FAQ; Book opens Book a Session", async ({ page, backend, as }) => {
    seedDirectory(backend);
    seedCoachProfile(backend);
    await as(page, "parent");
    await page.goto(`/coach/${IDS.coachSlug}`);

    const who = page.getByRole("region", { name: "Coach" });
    await expect(who).toContainText("Casey Coach");
    await expect(who).toContainText("Head coach");
    await expect(who).toContainText("$80");
    const pricing = page.getByRole("region", { name: "Sessions and pricing" });
    await expect(pricing).toContainText("5-session pack");
    await expect(pricing).toContainText("$75 a session · Valid 90 days");
    await expect(pricing).toContainText("Most booked");
    await expect(pricing).toContainText("Small group");
    await expect(pricing).toContainText("per athlete");
    await expect(page.getByText("Jordan P.")).toBeVisible();
    await expect(page.getByText("Parent of a U14 athlete", { exact: false })).toBeVisible();
    await expect(page.getByText("Thanks Jordan, she worked hard!")).toBeVisible();
    await expect(page.getByText("Sam S.")).toBeVisible();

    await who.getByRole("button", { name: "Book a session" }).click();
    await expect(page).toHaveURL(new RegExp(`/book\\?coach=${IDS.coach}$`));
    await expect(page.getByRole("heading", { name: "Book a session" })).toBeVisible();
  });

  test("as a parent: Buy on a package opens its checkout", async ({ page, backend, as }) => {
    seedDirectory(backend);
    seedCoachProfile(backend);
    seedParentChild(backend);
    seedFees(backend);
    backend.functions["create-package-payment"] = { url: CHECKOUT_URL };
    await as(page, "parent");
    await page.goto(`/coach/${IDS.coachSlug}`);

    const pricing = page.getByRole("region", { name: "Sessions and pricing" });
    await pricing.getByRole("button", { name: "Buy" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Buy 5-session pack" })).toBeVisible();
    // $375 + 10% platform fee + card processing.
    await dialog.getByRole("button", { name: /^Pay \$4\d\d\.\d\d$/ }).click();
    await expect(page).toHaveURL(CHECKOUT_URL);
    expect(onlyCall(backend, "create-package-payment")).toEqual({ package_id: BOOK_IDS.package5, coach_id: IDS.coach });
  });

  test("a coach that approves new families first: Request a session sends a time request", async ({ page, backend, as }) => {
    seedDirectory(backend);
    seedCoachProfile(backend, { new_family_booking: "request" });
    seedParentChild(backend);
    backend.rpc.get_athlete_home = { athlete: null, next: null, focus: null, coaches: [] };
    backend.rpc.request_session_time = null;
    await as(page, "parent");
    await page.goto(`/coach/${IDS.coachSlug}`);

    await page.getByRole("region", { name: "Coach" }).getByRole("button", { name: "Request a session" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Request another time with Casey" })).toBeVisible();
    await dialog.getByLabel("Start time").selectOption({ label: "6:00 pm" });
    await dialog.getByLabel("Note to Casey (optional)").fill("Any weekday after school works");
    await dialog.getByRole("button", { name: "Send request" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(/^Request sent for /)).toBeVisible();

    // 6:00 pm UTC two days out, sent as the Eastern wall time.
    const [call] = backend.writesTo("request_session_time");
    expect(call.body).toMatchObject({ p_coach_id: IDS.coach, p_date: isoDay(2), p_note: "Any weekday after school works" });
    expect(String((call.body as Record<string, unknown>).p_start)).toMatch(/^1[34]:00$/);
  });

  test("pricing page shows the packages and records the view", async ({ page, backend }) => {
    seedDirectory(backend);
    seedCoachProfile(backend);
    await page.goto(`/coach/${IDS.coachSlug}/pricing`);

    await expect(page).toHaveURL(/\/coach\/casey-coach\/pricing$/);
    await expect(page.getByText("Coaching packages")).toBeVisible();
    await expect(page.getByText("$700").first()).toBeVisible();
    await expect(page.getByText("$70 per session").first()).toBeVisible();
    await expect.poll(() => backend.writesTo("record_coach_share_event").map((w) => w.body)).toContainEqual({ p_coach_id: IDS.coach, p_event_type: "pricing_view" });
  });

  test("pricing page by id moves to the slug and keeps /pricing", async ({ page, backend, as }) => {
    seedDirectory(backend);
    seedCoachProfile(backend);
    await as(page, "parent");
    await page.goto(`/coach/${IDS.coach}/pricing`);
    await expect(page).toHaveURL(/\/coach\/casey-coach\/pricing$/);
    await expect(page.getByRole("region", { name: "Sessions and pricing" })).toContainText("10-session pack");
  });

  test("free intro call: pick a time, answer the questions and book it", async ({ page, backend, as }) => {
    seedDirectory(backend);
    seedCoachProfile(backend);
    seedParentChild(backend);
    const day = isoDay(3);
    const times = [`${day}T15:00:00.000Z`, `${day}T15:30:00.000Z`];
    backend.rpc.get_coach_intro = {
      enabled: true,
      minutes: 15,
      format: "video",
      questions: ["Athlete's name and age", "What do you want to work on?"],
      canBook: true,
      reason: null,
      athlete: { id: BOOK_IDS.child, name: "Riley Parent", birthDate: "2013-03-03" },
      booked: null,
      times,
    };
    backend.rpc.book_intro_call = null;
    await as(page, "parent");
    await page.goto(`/coach/${IDS.coachSlug}`);

    await expect(page.getByText("Free 15-min intro call")).toBeVisible();
    await page.getByRole("button", { name: "Pick a time" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Free intro call with Casey" })).toBeVisible();
    await dialog.getByRole("button", { name: "3:30 pm", exact: true }).click();
    await expect(dialog.getByLabel("Athlete's name and age")).toHaveValue(/^Riley, \d+$/);
    await dialog.getByLabel("What do you want to work on?").fill("Weak foot");
    await dialog.getByRole("button", { name: "Book free intro call" }).click();
    await expect(dialog.getByRole("heading", { name: "Intro call booked" })).toBeVisible();

    const [call] = backend.writesTo("book_intro_call");
    expect(call.body).toEqual({ p_coach_id: IDS.coach, p_starts_at: times[1], p_answers: [expect.stringMatching(/^Riley, \d+$/), "Weak foot"] });
  });
});

// ---------------------------------------------------------------------------------------------
// Book a Session
// ---------------------------------------------------------------------------------------------

/** Card total for sessions of `prices` dollars: 10% platform fee, then 2.9% + $0.30 grossed up. */
const cardTotal = (...prices: number[]) => {
  const list = prices.reduce((n, p) => n + p * 100, 0);
  return `$${(Math.round((list + Math.round(list / 10) + 30) / (1 - 0.029)) / 100).toFixed(2)}`;
};

/** A time tile ("3:00 pm …") for an Eastern wall time on `date`. */
const timeTile = (page: Page, date: string, time: string) =>
  page.getByRole("button", { name: new RegExp(`^${utcClock(date, time).replace(" ", "\\s*")}`, "i") });

test.describe("book a session", () => {
  test("parent picks two times with their coach and pays by card", async ({ page, backend, as }) => {
    seedParentChild(backend);
    seedFees(backend);
    seedBookable(backend);
    backend.functions["create-booking-payment-v0"] = { url: CHECKOUT_URL };
    await as(page, "parent");
    await page.goto("/book");

    await expect(page.getByRole("heading", { name: "Book a session" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Casey/, pressed: true })).toBeVisible();
    await expect(page.getByText("1-on-1 from $80").first()).toBeVisible();

    const day = isoDay(2);
    await timeTile(page, day, "10:00").click();
    await timeTile(page, day, "16:00").click();
    await expect(timeTile(page, day, "10:00")).toHaveAttribute("aria-pressed", "true");
    await continueToReview(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Review your booking" })).toBeVisible();
    await expect(dialog.getByText(/with Casey/)).toHaveCount(2);
    await dialog.getByRole("button", { name: `Pay ${cardTotal(80, 80)}` }).click();

    await expect(page).toHaveURL(CHECKOUT_URL);
    expect(onlyCall(backend, "create-booking-payment-v0")).toEqual({
      occurrence_ids: [BOOK_IDS.session1, BOOK_IDS.session2],
      athlete_id: BOOK_IDS.child,
      use_credits: true,
    });
  });

  test("athlete books with a package credit: no checkout, straight to the receipt", async ({ page, backend, as }) => {
    seedFees(backend);
    seedBookable(backend, { coach: { credits: 2 } });
    backend.functions["create-booking-payment-v0"] = { booked: true, credits_used: 1, booking_ids: [BOOK_IDS.booking1] };
    backend.rpc.get_booking_receipt = receipt([receiptBooking({ athlete_id: IDS.athleteProfile, charged: 0, platform_fee: 0, processing_fee: 0 })]);
    await as(page, "athlete");
    await page.goto(`/book?coach=${IDS.coach}`);

    await expect(page.getByText("2 credits left").first()).toBeVisible();
    await timeTile(page, isoDay(2), "10:00").click();
    await continueToReview(page);
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Credit", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Confirm with 1 credit" }).click();

    await expect(page).toHaveURL(new RegExp(`/booking-confirmation\\?bookings=${BOOK_IDS.booking1}$`));
    await expect(page.getByRole("heading", { name: "You're booked" })).toBeVisible();
    expect(onlyCall(backend, "create-booking-payment-v0")).toEqual({ occurrence_ids: [BOOK_IDS.session1], athlete_id: IDS.athleteProfile, use_credits: true });
    expect(backend.writesTo("get_booking_receipt")[0].body).toEqual({ p_stripe_session_id: null, p_booking_ids: [BOOK_IDS.booking1] });
  });

  test("paying the coach directly: offline pay sends pay_offline and books without Stripe", async ({ page, backend, as }) => {
    seedParentChild(backend);
    seedFees(backend);
    seedBookable(backend, { coach: { offline_pay_available: true } });
    backend.functions["create-booking-payment-v0"] = { direct: true, offline: true, booking_ids: [BOOK_IDS.booking1] };
    backend.rpc.get_booking_receipt = receipt([receiptBooking({ athlete_id: BOOK_IDS.child, payment_status: "unpaid", charged: null, coach: { id: IDS.coach, name: "Casey Coach", slug: IDS.coachSlug, pay_mode: "self", pay_note: null } })]);
    await as(page, "parent");
    await page.goto("/book");

    await timeTile(page, isoDay(2), "10:00").click();
    await continueToReview(page);
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Pay Casey directly instead" }).click();
    await expect(dialog.getByText("Pay Casey directly", { exact: true })).toBeVisible();
    await expect(dialog.getByText(/Nothing is charged in AthaNext/)).toBeVisible();
    await dialog.getByRole("button", { name: "Confirm booking" }).click();

    await expect(page).toHaveURL(/\/booking-confirmation\?bookings=/);
    expect(onlyCall(backend, "create-booking-payment-v0")).toEqual({
      occurrence_ids: [BOOK_IDS.session1],
      athlete_id: BOOK_IDS.child,
      use_credits: true,
      pay_offline: true,
    });
  });

  test("new family with a coach who approves first: request a listed time and hold the card", async ({ page, backend, as }) => {
    seedParentChild(backend);
    seedFees(backend);
    seedBookable(backend, { coach: { is_client: false, needs_request: true } });
    backend.functions["create-booking-payment-v0"] = { url: CHECKOUT_URL, requested: true };
    await as(page, "parent");
    await page.goto(`/book?coach=${IDS.coach}`);

    await expect(page.getByText(/Casey approves new families first/)).toBeVisible();
    await timeTile(page, isoDay(2), "10:00").click();
    const details = page.getByRole("region", { name: "Session details" });
    await expect(details).toContainText("Just Riley and Casey");
    await expect(details).toContainText("Charged only if Casey accepts");
    await details.getByRole("button", { name: "Request" }).click();
    await continueToReview(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Review your request" })).toBeVisible();
    await expect(dialog.getByText(/you're only charged .* if accepted/)).toBeVisible();
    await dialog.getByRole("button", { name: "Send request" }).click();

    await expect(page).toHaveURL(CHECKOUT_URL);
    expect(onlyCall(backend, "create-booking-payment-v0")).toEqual({ occurrence_ids: [BOOK_IDS.session1], athlete_id: BOOK_IDS.child, use_credits: true });
  });

  test("a failed checkout shows the function's message and stays on the review", async ({ page, backend, as }) => {
    seedParentChild(backend);
    seedFees(backend);
    seedBookable(backend);
    backend.functions["create-booking-payment-v0"] = new MockError("That session is fully booked", 409);
    await as(page, "parent");
    await page.goto("/book");

    await timeTile(page, isoDay(2), "10:00").click();
    await continueToReview(page);
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: `Pay ${cardTotal(80)}` }).click();
    await expect(dialog.getByRole("alert")).toHaveText("That time just filled up. Pick another time.");
    await expect(page).toHaveURL(/\/book$/);
  });

  test("Request a time asks for an unlisted time", async ({ page, backend, as }) => {
    seedParentChild(backend);
    seedFees(backend);
    seedBookable(backend);
    backend.rpc.request_session_time = null;
    await as(page, "parent");
    await page.goto("/book");

    await page.getByRole("button", { name: isPhone(page) ? "Request a different time" : "Request a time" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Request another time with Casey" })).toBeVisible();
    await expect(dialog).toContainText("60 min · $80");
    await dialog.getByLabel("Day").fill(isoDay(5));
    await dialog.getByLabel("Start time").selectOption({ label: "8:00 am" });
    await dialog.getByRole("button", { name: "Send request" }).click();
    await expect(dialog).toBeHidden();

    // 8:00 am UTC is 3:00 or 4:00 am Eastern, the same day.
    const [call] = backend.writesTo("request_session_time");
    expect(call.body).toEqual({ p_coach_id: IDS.coach, p_date: isoDay(5), p_start: expect.stringMatching(/^0[34]:00$/), p_note: "" });
  });

  test("book by pillar: pick a pillar, a coach, a time and pay", async ({ page, backend, as }) => {
    seedParentChild(backend);
    seedFees(backend);
    seedBookable(backend);
    backend.rpc.get_my_coaches = [];
    const newCoach = bookingCoach({ is_client: false, next_open: { date: isoDay(2), start_time: "10:00:00" } });
    backend.rpc.get_pillar_coaches = [newCoach];
    backend.functions["create-booking-payment-v0"] = { url: CHECKOUT_URL };
    await as(page, "parent");
    await page.goto("/book");

    // No coaches yet: the page starts on Book by pillar.
    await expect(page.getByRole("button", { name: "Book by pillar", pressed: true })).toBeVisible();
    await page.getByRole("button", { name: /^Mentorship/ }).click();
    await expect(page.getByRole("heading", { name: "Mentorship coaches" })).toBeVisible();
    await expect(page.getByText("Instant booking")).toBeVisible();
    await expect(page.getByText(/Next open/)).toBeVisible();
    await page.getByRole("button", { name: "Pick a time" }).click();

    await timeTile(page, isoDay(2), "10:00").click();
    await page.getByRole("region", { name: "Session details" }).getByRole("button", { name: "Add" }).click();
    await continueToReview(page);
    await page.getByRole("dialog").getByRole("button", { name: `Pay ${cardTotal(80)}` }).click();

    await expect(page).toHaveURL(CHECKOUT_URL);
    expect(backend.writesTo("get_pillar_coaches")[0].body).toEqual({ p_pillar: "Mentorship" });
    expect(onlyCall(backend, "create-booking-payment-v0")).toMatchObject({ occurrence_ids: [BOOK_IDS.session1], athlete_id: BOOK_IDS.child });
  });

  test("a shared session link opens that session ready to pay", async ({ page, backend, as }) => {
    seedDirectory(backend);
    seedCoachProfile(backend);
    seedParentChild(backend);
    seedFees(backend);
    seedBookable(backend);
    const shared = { ...bookableSession({ id: BOOK_IDS.session2, start_time: "16:00:00", end_time: "17:00:00" }), max_bookings_per_slot: 1, pillar_slot: "Technique" };
    backend.rpc.get_session_for_booking = shared;
    backend.functions["create-booking-payment-v0"] = { url: CHECKOUT_URL };
    await as(page, "parent");
    await page.goto(`/coach/${IDS.coachSlug}?session=${BOOK_IDS.session2}`);

    await expect(page).toHaveURL(new RegExp(`/book\\?coach=${IDS.coach}&session=${BOOK_IDS.session2}$`));
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Review your booking" })).toBeVisible();
    await expect(dialog.getByText("Technique with Casey")).toBeVisible();
    await dialog.getByRole("button", { name: `Pay ${cardTotal(80)}` }).click();
    await expect(page).toHaveURL(CHECKOUT_URL);
    expect(onlyCall(backend, "create-booking-payment-v0")).toMatchObject({ occurrence_ids: [BOOK_IDS.session2] });
  });

  test("signed out, a shared session link asks to sign in first", async ({ page, backend }) => {
    seedDirectory(backend);
    seedCoachProfile(backend);
    await page.goto(`/coach/${IDS.coachSlug}?session=${BOOK_IDS.session2}`);
    await expect(page).toHaveURL(/\/auth\?mode=signin$/);
  });
});

// ---------------------------------------------------------------------------------------------
// Back from Stripe: booking and package confirmations
// ---------------------------------------------------------------------------------------------

test.describe("booking confirmation", () => {
  test("back from Stripe with a session id: the paid receipt", async ({ page, backend, as }) => {
    seedFees(backend);
    backend.rpc.get_booking_receipt = receipt([
      receiptBooking({ athlete_id: IDS.athleteProfile }),
      receiptBooking({ id: BOOK_IDS.booking2, athlete_id: IDS.athleteProfile, occurrence_date: isoDay(3), start_time: "16:00:00", end_time: "17:00:00" }),
    ]);
    backend.functions["send-booking-notifications"] = { email: "athlete@e2e.test" };
    await as(page, "athlete");
    await page.goto("/booking-confirmation?session_id=cs_test_e2e");

    await expect(page.getByRole("heading", { name: "You're booked" })).toBeVisible();
    await expect(page.getByText(/^2 sessions confirmed\. Your coaches have been notified and a copy goes to athlete@e2e\.test\.$/)).toBeVisible();
    await expect(page.getByText("Total paid")).toBeVisible();
    await expect(page.getByText("Card, through Stripe")).toBeVisible();
    await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible();
    // Paid and charged rows need no second verification call.
    expect(backend.writesTo("verify-payment-status")).toHaveLength(0);
    expect(backend.writesTo("get_booking_receipt")[0].body).toEqual({ p_stripe_session_id: "cs_test_e2e", p_booking_ids: null });

    await page.getByRole("button", { name: "Resend receipt" }).click();
    await expect(page.getByText("Receipt sent to athlete@e2e.test", { exact: true })).toBeVisible();
    expect(backend.writesTo("send-booking-notifications")[0].body).toEqual({ action: "resend_receipt", stripe_session_id: "cs_test_e2e" });

    await page.getByRole("link", { name: "View in My sessions" }).first().click();
    await expect(page).toHaveURL(/\/my-sessions$/);
  });

  test("a receipt that can't be read shows the error and a way to My sessions", async ({ page, backend, as }) => {
    backend.rpc.get_booking_receipt = new MockError("These bookings aren't on your account", 403);
    await as(page, "parent");
    await page.goto(`/booking-confirmation?bookings=${BOOK_IDS.booking1}`);
    // react-query retries three times before showing the error.
    await expect(page.getByRole("heading", { name: "Couldn't load this receipt" })).toBeVisible({ timeout: 20_000 });
    // PostgREST errors aren't Error instances, so the page shows its own fallback.
    await expect(page.getByText("Try again in a moment.")).toBeVisible();
    await expect(page.getByRole("link", { name: "View in My sessions" })).toBeVisible();
  });

  test("a request back from Stripe's card hold: Request sent, or the time filled up", async ({ page, backend, as }) => {
    let full = false;
    backend.functions["create-booking-payment-v0"] = () => (full ? { full: true } : { held: true });
    await as(page, "parent");
    await page.goto("/booking-confirmation?request=1&session_id=cs_test_hold");
    await expect(page.getByRole("heading", { name: "Request sent" })).toBeVisible();
    expect(backend.writesTo("create-booking-payment-v0")[0].body).toEqual({ session_id: "cs_test_hold" });

    full = true;
    await page.reload();
    await expect(page.getByRole("heading", { name: "That time just filled up" })).toBeVisible();
    await page.getByRole("button", { name: "Pick another time" }).click();
    await expect(page).toHaveURL(/\/book$/);
  });
});

test.describe("package confirmation", () => {
  test("reconciled: the package, its sessions and what was paid", async ({ page, backend, as }) => {
    seedDirectory(backend);
    seedCoachProfile(backend);
    seedFees(backend);
    let checks = 0;
    // Still processing on the first check, reconciled on the next.
    backend.functions["reconcile-package-payment"] = () => (++checks === 1 ? { state: "pending" } : { state: "reconciled" });
    await as(page, "athlete");
    await page.goto(`/package-confirmation?session_id=cs_test_pkg&package_id=${BOOK_IDS.package5}&coach_id=${IDS.coach}`);

    await expect(page.getByRole("heading", { name: "Package confirmed" })).toBeVisible();
    await expect(page.getByText("Payment confirmed. Your package is ready.")).toBeVisible();
    await expect(page.getByText("5-session pack with Casey Coach")).toBeVisible();
    await expect(page.getByText("Video review after each session")).toBeVisible();
    await expect(page.getByText(/^\$4\d\d\.\d\d$/)).toBeVisible();
    expect(checks).toBe(2);
    expect(backend.writesTo("reconcile-package-payment")[0].body).toEqual({ session_id: "cs_test_pkg" });
  });

  test("a payment that can't be verified shows the error", async ({ page, backend, as }) => {
    backend.functions["reconcile-package-payment"] = new MockError("Checkout session not found", 404);
    await as(page, "parent");
    await page.goto(`/package-confirmation?session_id=cs_bad&package_id=${BOOK_IDS.package5}`);
    await expect(page.getByRole("heading", { name: "We couldn’t confirm your package" })).toBeVisible();
    await expect(page.getByText("5-session pack")).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------------------------
// Group offer link
// ---------------------------------------------------------------------------------------------

test.describe("group offer", () => {
  test("signed out: the sessions with spots left, and Sign in to pick", async ({ page, backend }) => {
    backend.rpc.get_group_offer = groupOffer();
    await page.goto(`/offers/${IDS.offer}`);
    await expect(page.getByText(/^Casey's sessions, /)).toBeVisible();
    await expect(page.getByText("Finishing clinic")).toBeVisible();
    await expect(page.getByText("6 spots left")).toBeVisible();
    await expect(page.getByText("1 spot left")).toBeVisible();
    await expect(page.getByText("Full", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Sign in to pick sessions" }).click();
    await expect(page).toHaveURL(/\/auth\?mode=signin$/);
  });

  test("parent ticks two sessions and pays once", async ({ page, backend, as }) => {
    seedParentChild(backend);
    seedFees(backend);
    backend.rpc.get_group_offer = groupOffer();
    backend.rpc.booking_coach_card = bookingCoach();
    backend.functions["create-booking-payment-v0"] = { url: CHECKOUT_URL };
    await as(page, "parent");
    await page.goto(`/offers/${IDS.offer}`);

    await expect(page.getByText("Tick the ones you want and pay once.")).toBeVisible();
    // The full session can't be picked.
    await expect(page.getByRole("button", { name: /Full clinic/ })).toHaveCount(0);
    await page.getByRole("button", { name: /Finishing clinic/ }).click();
    await page.getByRole("button", { name: /Passing clinic/ }).click();
    await page.getByRole("button", { name: "Continue with 2 sessions · $55" }).click();

    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("heading", { name: "Review and pay" })).toBeVisible();
    await expect(sheet.getByText("For Riley Parent")).toBeVisible();
    await sheet.getByRole("button", { name: `Pay ${cardTotal(30, 25)}` }).click();
    await expect(page).toHaveURL(CHECKOUT_URL);
    expect(onlyCall(backend, "create-booking-payment-v0")).toEqual({
      occurrence_ids: [BOOK_IDS.offerSession1, BOOK_IDS.offerSession2],
      athlete_id: BOOK_IDS.child,
      use_credits: true,
    });
  });

  test("an offer the family is already in shows their spot", async ({ page, backend, as }) => {
    seedParentChild(backend);
    seedFees(backend);
    backend.rpc.get_group_offer = groupOffer({
      sessions: [offerSession({ my_status: "booked", my_booking_id: BOOK_IDS.booking1, my_paid_amount: 30 }), offerSession({ id: BOOK_IDS.offerSession2, session_name: "Passing clinic" })],
    });
    await as(page, "parent");
    await page.goto(`/offers/${IDS.offer}`);
    await expect(page.getByText("Riley in 1 session. Change anything from My sessions.")).toBeVisible();
    await expect(page.getByText("Riley in", { exact: true })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------------------------
// My coaches and My sessions
// ---------------------------------------------------------------------------------------------

const referral = (overrides: Record<string, unknown>) => ({
  id: "00000000-0000-4000-8000-0000000ef001",
  coach_id: IDS.coach,
  athlete_id: BOOK_IDS.child,
  status: "confirmed",
  initiated_by: "coach",
  created_at: "2026-10-01T00:00:00Z",
  expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
  ...overrides,
});

test.describe("my coaches", () => {
  test("parent: confirmed, pending and booked coaches; confirming an invite", async ({ page, backend, as }) => {
    seedDirectory(backend);
    seedParentChild(backend);
    backend.seed("coach_client_referrals", [
      referral({}),
      referral({ id: "00000000-0000-4000-8000-0000000ef002", coach_id: BOOK_IDS.goalieCoach, status: "pending_confirmation", initiated_by: "coach" }),
    ]);
    backend.rpc.get_bookings_by_user_id = [mySessionRow({ coach_id: BOOK_IDS.rowingCoach, coach_name: "Robin Rower" })];
    backend.rpc.attest_coach_referral = null;
    await as(page, "parent");
    await page.goto("/my-coaches");

    const confirmed = page.locator("section", { has: page.getByRole("heading", { name: "Confirmed coaches" }) });
    await expect(confirmed).toContainText("Casey Coach");
    await expect(confirmed).toContainText("No platform fee on sessions with this coach");
    const booked = page.locator("section", { has: page.getByRole("heading", { name: "Coaches you've booked" }) });
    await expect(booked).toContainText("Robin Rower");

    const pending = page.locator("section", { has: page.getByRole("heading", { name: "Pending confirmations" }) });
    await expect(pending).toContainText("Gale Keeper added you as an existing client");
    const confirm = pending.getByRole("button", { name: "Confirm" });
    await expect(confirm).toBeDisabled();
    await pending.getByLabel("We worked together before or outside of AthaNext").click();
    await confirm.click();
    await expect.poll(() => backend.writesTo("attest_coach_referral").map((w) => w.body)).toEqual([
      { _referral_id: "00000000-0000-4000-8000-0000000ef002", _answer: "offline" },
    ]);
    expect(backend.writesTo("get_bookings_by_user_id")[0].body).toEqual({ athlete_id_param: BOOK_IDS.child, coach_id_param: null });
  });
});

test.describe("my sessions", () => {
  const sessions = () => [
    mySessionRow(),
    mySessionRow({
      booking_id: BOOK_IDS.booking2,
      occurrence_id: BOOK_IDS.session2,
      session_date: isoDay(-5),
      slot_session_name: "Finishing",
      slot_session_type: "group",
      pillar_slot: null,
      athlete_count: 4,
      has_slot_feedback: true,
    }),
  ];

  for (const persona of ["athlete", "parent"] as const) {
    test(`${persona}: upcoming and past tabs, and a session opens its details`, async ({ page, backend, as }) => {
      seedFees(backend);
      if (persona === "parent") seedParentChild(backend);
      backend.rpc.get_bookings_by_user_id = sessions();
      backend.rpc.get_athlete_session = {
        id: BOOK_IDS.session1,
        date: isoDay(2),
        start_time: "10:00:00",
        end_time: "11:00:00",
        duration_minutes: 60,
        session_type: "individual",
        session_name: "Ball mastery",
        pillar: "Technique",
        price: 80,
        location: "in-person",
        place: "Central Park",
        coach: { id: IDS.coach, name: "Casey Coach", slug: IDS.coachSlug, photo: null, pay_mode: "app", pay_note: null },
        booking: { id: BOOK_IDS.booking1, status: "booked", payment_status: "paid", paid_amount: 90.94 },
      };
      await as(page, persona);
      await page.goto("/my-sessions");

      await expect(page.getByRole("heading", { name: "My sessions" })).toBeVisible();
      await expect(page.getByText(persona === "parent" ? "Everything booked on Pat's account." : "Everything booked on your account.")).toBeVisible();
      const upcoming = page.getByRole("tab", { name: /^Upcoming 1/ });
      await expect(upcoming).toHaveAttribute("aria-selected", "true");
      // 1-on-1s are titled by their pillar, groups by their name.
      const next = page.getByRole("button", { name: /Technique .*Casey Coach/ });
      await expect(next).toBeVisible();
      await expect(next).toContainText(utcClock(isoDay(2), "10:00").replace(":00 PM", ":00").replace(":00 AM", ":00"));
      await expect(page.getByText("Finishing", { exact: true })).toHaveCount(0);

      await page.getByRole("tab", { name: /^Past 1/ }).click();
      await expect(page.getByText("Finishing", { exact: true })).toBeVisible();
      await expect(page.getByText("Feedback ready")).toBeVisible();

      await page.getByRole("tab", { name: /^Upcoming/ }).click();
      // A session opens its own page (covered in sessions.spec.ts).
      await next.click();
      await expect(page).toHaveURL(new RegExp(`/sessions/${BOOK_IDS.session1}$`));
      await expect(page.getByText("Paid $90.94 by card")).toBeVisible();
      expect(backend.writesTo("get_bookings_by_user_id")[0].body).toEqual({
        athlete_id_param: persona === "parent" ? BOOK_IDS.child : IDS.athlete,
        coach_id_param: null,
      });
    });
  }
});
