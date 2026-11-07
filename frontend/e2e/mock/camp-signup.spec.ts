import type { Page } from "@playwright/test";
import { test, expect } from "./test";
import { MOCK_SUPABASE_URL, type FunctionHandler, type MockBackend } from "./backend";
import { IDS } from "./personas";
import { BOOK_IDS, campPage, campQuote, seedParentChild } from "./data/booking";

// The public camp page at /<coach>/<camp> (get_camp_page) and its sign-up without an account:
// pick a group, the details form with its validation, Review and pay, then Stripe Checkout or
// "Hold my spot" when paying the coach directly (camp-signup edge function).

const CHECKOUT_URL = "https://checkout.stripe.com/c/pay/cs_test_camp";
const CAMP_PATH = `/${IDS.coachSlug}/${BOOK_IDS.campSlug}`;

type Body = Record<string, unknown>;

/** camp-signup answers by action, like the edge function. */
const seedCamp = (backend: MockBackend, signup: (body: Body) => unknown = () => ({ status: "pending_payment", signup_id: BOOK_IDS.signup, url: CHECKOUT_URL, session_id: "cs_test_camp", expires_at: new Date(Date.now() + 1800_000).toISOString(), platform_waived: true, fees: campQuote(1).card })) => {
  backend.rpc.get_camp_page = ({ p_coach_slug, p_camp_slug }: Body) => (p_coach_slug === IDS.coachSlug && p_camp_slug === BOOK_IDS.campSlug ? campPage() : null);
  backend.functions["camp-signup"] = (body: unknown) => {
    const b = body as Body;
    if (b.action === "quote") return campQuote(Number(b.athletes) || 1);
    if (b.action === "signup") return signup(b);
    return null;
  };
};

const campCalls = (backend: MockBackend, action: string) => backend.writesTo("camp-signup").map((w) => w.body as Body).filter((b) => b.action === action);

/** The visible one of the side panel's and the bottom bar's copy of a button. */
const visibleButton = (page: Page, name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" }).filter({ visible: true }).first();

test.describe("camp page", () => {
  test("shows the camp: dates, place, groups with spots, what's included", async ({ page, backend }) => {
    seedCamp(backend);
    await page.goto(CAMP_PATH);

    await expect(page.getByRole("heading", { name: "Summer Skills Camp" })).toBeVisible();
    await expect(page.getByText("Central Park, North Meadow").first()).toBeVisible();
    await expect(page.getByText("$250").first()).toBeVisible();
    const groups = page.getByRole("radiogroup", { name: "Pick a group" });
    await expect(groups.getByRole("radio", { name: /Ages 8 to 10.*7 spots left/ })).toBeEnabled();
    await expect(groups.getByRole("radio", { name: /Ages 11 to 14.*Fully booked/ })).toBeDisabled();
    await expect(page.getByText("Camp T-shirt")).toBeVisible();
    await expect(page.getByText("Daily snack")).toBeVisible();
    expect(backend.writesTo("get_camp_page")[0].body).toEqual({ p_coach_slug: IDS.coachSlug, p_camp_slug: BOOK_IDS.campSlug });

    // Sign up waits for a group.
    await expect(visibleButton(page, "Sign up")).toBeDisabled();
    await groups.getByRole("radio", { name: /Ages 8 to 10/ }).click();
    await expect(groups.getByRole("radio", { name: /Ages 8 to 10/ })).toHaveAttribute("aria-checked", "true");
    await expect(visibleButton(page, "Sign up")).toBeEnabled();
  });

  test("a camp that has started can't be signed up for", async ({ page, backend }) => {
    seedCamp(backend);
    backend.rpc.get_camp_page = campPage({ open: false, started: true });
    await page.goto(CAMP_PATH);
    await page.getByRole("radio", { name: /Ages 8 to 10/ }).click();
    await expect(visibleButton(page, "Sign up")).toBeDisabled();
    await expect(page.getByText(/Sign-ups closed\. The camp has started|The camp has started\. Ask Casey to add your athlete\./).filter({ visible: true }).first()).toBeVisible();
  });

  test("an old /camps/ link opens the camp page with its query", async ({ page, backend }) => {
    seedCamp(backend);
    await page.goto(`/camps${CAMP_PATH}?src=link`);
    await expect(page).toHaveURL(new RegExp(`${CAMP_PATH}\\?src=link$`));
    await expect(page.getByRole("heading", { name: "Summer Skills Camp" })).toBeVisible();
  });
});

test.describe("camp sign-up", () => {
  test("the details form says what's missing, then card payment goes to Stripe", async ({ page, backend }) => {
    seedCamp(backend);
    await page.goto(`${CAMP_PATH}?src=link`);
    await page.getByRole("radio", { name: /Ages 8 to 10/ }).click();
    await visibleButton(page, "Sign up").click();

    await expect(page.getByRole("heading", { name: "About your athlete" })).toBeVisible();
    await visibleButton(page, "Continue to payment").click();
    await expect(page.getByText("Add your name")).toBeVisible();
    await expect(page.getByText("Add an email we can send the receipt to")).toBeVisible();
    await expect(page.getByText("Add a first name")).toBeVisible();
    await expect(page.getByText("Add a birth year, like 2013")).toBeVisible();
    await expect(page.getByText("Tick the box to continue")).toBeVisible();
    await expect(page.getByLabel("Full name")).toHaveAttribute("aria-invalid", "true");

    await page.getByLabel("Full name").fill("Jamie Rivera");
    await expect(page.getByText("Add your name")).toBeHidden();
    await page.getByLabel("Email").fill("jamie@");
    await page.getByLabel("First name").fill("Ava");
    await page.getByLabel("Birth year").pressSequentially("20x15");
    await expect(page.getByLabel("Birth year")).toHaveValue("2015");
    await page.getByLabel("Allergies, injuries, anything else (optional)").fill("Peanut allergy");
    await page.getByRole("checkbox").check();
    await visibleButton(page, "Continue to payment").click();
    await expect(page.getByText("Add an email we can send the receipt to")).toBeVisible();
    await page.getByLabel("Email").fill("jamie@e2e.test");
    await visibleButton(page, "Continue to payment").click();

    await expect(page.getByRole("heading", { name: "Review and pay" })).toBeVisible();
    await expect(page.getByText("Ava Rivera").filter({ visible: true }).first()).toBeVisible();
    const total = `$${(Number((campQuote(1).card as Body).totalCents) / 100).toFixed(2)}`;
    await expect(page.getByText(/\+ \$\d+\.\d\d card processing/)).toBeVisible();
    expect(campCalls(backend, "quote")).toEqual([{ action: "quote", camp_id: BOOK_IDS.camp, src: "link", athletes: 1 }]);
    await visibleButton(page, `Pay ${total}`).click();

    await expect(page).toHaveURL(CHECKOUT_URL);
    expect(campCalls(backend, "signup")).toEqual([
      {
        action: "signup",
        camp_id: BOOK_IDS.camp,
        src: "link",
        pay_method: "card",
        parent: { name: "Jamie Rivera", email: "jamie@e2e.test", phone: "" },
        note: "",
        waiver: true,
        photo_consent: true,
        athletes: [{ first_name: "Ava", last_name: "Rivera", birth_year: 2015, group_id: BOOK_IDS.campGroupYoung, note: "Peanut allergy" }],
      },
    ]);

    // Back from Stripe without paying: the review again, with what they typed.
    await page.goto(`${CAMP_PATH}?canceled=1`);
    await expect(page.getByRole("heading", { name: "Review and pay" })).toBeVisible();
    await expect(page.getByText("Payment was canceled. Nothing was charged.").first()).toBeVisible();
    await expect(page.getByText("Ava Rivera").filter({ visible: true }).first()).toBeVisible();
  });

  test("two athletes, paying the coach directly: Hold my spot, then Your spot is held", async ({ page, backend }) => {
    seedCamp(backend, () => ({
      status: "held",
      signup_id: BOOK_IDS.signup,
      hold_expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
      athletes: [],
    }));
    const status = {
      signup_id: BOOK_IDS.signup,
      pay_method: "direct",
      parent_email: "jamie@e2e.test",
      account_exists: false,
      held_until: new Date(Date.now() + 7 * 86400_000).toISOString(),
      camp: { id: BOOK_IDS.camp, name: "Summer Skills Camp", starts_on: null, ends_on: null, location: "Central Park, North Meadow", slug: BOOK_IDS.campSlug, included: [], coach_name: "Casey Coach", coach_slug: IDS.coachSlug },
      athletes: [
        { id: "a1", first_name: "Ava", status: "held", group_name: "Ages 8 to 10", start_time: "09:00:00", end_time: "12:00:00" },
        { id: "a2", first_name: "Max", status: "held", group_name: "Ages 8 to 10", start_time: "09:00:00", end_time: "12:00:00" },
      ],
      all_paid: false,
      any_pending: false,
    };
    const base = backend.functions["camp-signup"] as FunctionHandler;
    const withStatus: FunctionHandler = (body, ctx) => ((body as Body).action === "status" ? status : base(body, ctx));
    backend.functions["camp-signup"] = withStatus;
    await page.goto(CAMP_PATH);
    await page.getByRole("radio", { name: /Ages 8 to 10/ }).click();
    await visibleButton(page, "Sign up").click();

    await page.getByLabel("Full name").fill("Jamie Rivera");
    await page.getByLabel("Email").fill("jamie@e2e.test");
    await page.getByLabel("First name").fill("Ava");
    await page.getByLabel("Birth year").fill("2015");
    await page.getByRole("button", { name: "Add another athlete" }).click();
    await expect(page.getByRole("heading", { name: "Athlete 2" })).toBeVisible();
    await page.locator("#athletes\\.1\\.first_name").fill("Max");
    await page.locator("#athletes\\.1\\.birth_year").fill("2016");
    // The second athlete's group defaults to the one picked; the full group can't be chosen.
    await expect(page.locator("#athletes\\.1\\.group_id")).toHaveValue(BOOK_IDS.campGroupYoung);
    await expect(page.locator("#athletes\\.1\\.group_id").locator("option", { hasText: "Fully booked" })).toBeDisabled();
    await page.getByRole("checkbox").check();
    await visibleButton(page, "Continue to payment").click();

    await expect(page.getByRole("heading", { name: "Review and pay" })).toBeVisible();
    await page.getByRole("button", { name: "Paying offline?" }).click();
    await expect(page.getByText("Pay Casey directly", { exact: true })).toBeVisible();
    await expect(page.getByText("$500").filter({ visible: true }).first()).toBeVisible();
    await visibleButton(page, "Hold my spot").click();

    await expect(page).toHaveURL(new RegExp(`${CAMP_PATH}\\?signup=${BOOK_IDS.signup}$`));
    await expect(page.getByRole("heading", { name: "Your spot is held" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Finish your account" })).toBeVisible();
    const [signup] = campCalls(backend, "signup");
    expect(signup).toMatchObject({
      pay_method: "direct",
      src: null,
      athletes: [
        { first_name: "Ava", last_name: "Rivera", birth_year: 2015, group_id: BOOK_IDS.campGroupYoung },
        { first_name: "Max", last_name: "Rivera", birth_year: 2016, group_id: BOOK_IDS.campGroupYoung },
      ],
    });
    expect(campCalls(backend, "quote")[0]).toMatchObject({ athletes: 2 });
    expect(campCalls(backend, "status")[0]).toEqual({ action: "status", signup_id: BOOK_IDS.signup });
  });

  test("field errors from the server send the family back to the details", async ({ page, backend }) => {
    seedCamp(backend);
    // The mock's MockError can't carry `fields`, so answer the sign-up here.
    await page.route(`${MOCK_SUPABASE_URL}/functions/v1/camp-signup`, async (route) => {
      const body = route.request().postDataJSON() as Body;
      if (route.request().method() !== "POST" || body.action !== "signup") return route.fallback();
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({ error: "Check the form", code: "invalid", fields: { "parent.email": "This email can't receive mail" } }),
      });
    });
    await page.goto(CAMP_PATH);
    await page.getByRole("radio", { name: /Ages 8 to 10/ }).click();
    await visibleButton(page, "Sign up").click();
    await page.getByLabel("Full name").fill("Jamie Rivera");
    await page.getByLabel("Email").fill("bounce@e2e.test");
    await page.getByLabel("First name").fill("Ava");
    await page.getByLabel("Birth year").fill("2015");
    await page.getByRole("checkbox").check();
    await visibleButton(page, "Continue to payment").click();
    await visibleButton(page, /^Pay \$/).click();

    await expect(page.getByRole("heading", { name: "About your athlete" })).toBeVisible();
    await expect(page.getByText("This email can't receive mail")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
  });

  test("signed in as a parent: the form starts with the family's details", async ({ page, backend, as }) => {
    seedCamp(backend);
    seedParentChild(backend);
    await as(page, "parent");
    await page.goto(CAMP_PATH);
    await page.getByRole("radio", { name: /Ages 8 to 10/ }).click();
    await visibleButton(page, "Sign up").click();

    await expect(page.getByLabel("Full name")).toHaveValue("Pat Parent");
    await expect(page.getByLabel("Email")).toHaveValue("parent@e2e.test");
    await expect(page.getByLabel("First name")).toHaveValue("Riley");
    await expect(page.getByLabel("Birth year")).toHaveValue("2013");
  });

  test("back from Stripe with a paid sign-up: You're in", async ({ page, backend }) => {
    seedCamp(backend);
    const base = backend.functions["camp-signup"] as FunctionHandler;
    const withStatus: FunctionHandler = (body, ctx) =>
      (body as Body).action === "status"
        ? {
            signup_id: BOOK_IDS.signup,
            pay_method: "card",
            parent_email: "jamie@e2e.test",
            account_exists: true,
            camp: { id: BOOK_IDS.camp, name: "Summer Skills Camp", starts_on: null, ends_on: null, location: null, slug: BOOK_IDS.campSlug, included: [], coach_name: "Casey Coach", coach_slug: IDS.coachSlug },
            athletes: [{ id: "a1", first_name: "Ava", status: "paid", group_name: "Ages 8 to 10", start_time: "09:00:00", end_time: "12:00:00" }],
            all_paid: true,
            any_pending: false,
          }
        : base(body, ctx);
    backend.functions["camp-signup"] = withStatus;
    await page.goto(`${CAMP_PATH}?signup=${BOOK_IDS.signup}&session_id=cs_test_camp`);
    await expect(page.getByRole("heading", { name: "You're in" })).toBeVisible();
    await expect(page.getByText("Your spot is confirmed. Your receipt is on its way to jamie@e2e.test.")).toBeVisible();
    expect(campCalls(backend, "status")[0]).toEqual({ action: "status", signup_id: BOOK_IDS.signup, session_id: "cs_test_camp" });
  });
});
