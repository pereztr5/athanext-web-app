import type { Page } from "@playwright/test";
import { test, expect } from "./test";
import { MOCK_SUPABASE_URL, type MockBackend } from "./backend";
import { IDS, PASSWORD, coachRow, users, type Persona } from "./personas";
import { isPhone } from "./helpers";
import {
  DEAD_TOKEN,
  INVITED_EMAIL,
  INVITE_TOKEN,
  PRIVACY_VERSION,
  SOCCER_PILLARS,
  STRONG_PASSWORD,
  TERMS_VERSION,
  failSignInUnconfirmed,
  installSignupAuth,
  recoveryHash,
  seedInvite,
  seedSignup,
} from "./data/auth";

// Signing in and out, the sign-up questions, password reset and change, the sign-up
// confirmation page and coach invite links.

const signInForm = async (page: Page, email: string, password: string) => {
  await page.getByRole("textbox", { name: /^Email/ }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  // Wait for the sign-in request, so a click that went nowhere fails here.
  await Promise.all([
    page.waitForRequest((r) => r.url().includes("/auth/v1/token?grant_type=password") && r.method() === "POST"),
    page.getByRole("button", { name: "Sign in", exact: true }).click(),
  ]);
};

/** A toast's title or description (the live region repeats it, so match the toast itself). */
const toast = (page: Page, text: string) => page.getByText(text, { exact: true }).first();

const accountMenu = (page: Page) => page.getByRole("button", { name: "Account menu" }).filter({ visible: true });

test.describe("sign in", () => {
  for (const persona of ["coach", "parent", "athlete"] as Persona[]) {
    test(`${persona} signs in with email and password and lands on Home`, async ({ page, backend }) => {
      await page.goto("/auth?mode=signin");
      await expect(page.getByText("Welcome back", { exact: true }).first()).toBeVisible();
      await signInForm(page, users[persona].email, PASSWORD);
      await expect(page).toHaveURL(/\/dashboard$/);
      const grant = backend.writesTo("token").at(-1);
      expect(grant?.url).toContain("grant_type=password");
      expect(grant?.body).toMatchObject({ email: users[persona].email, password: "***" });
      await expect(accountMenu(page).first()).toBeVisible();
    });
  }

  test("a wrong password shows the error and stays on sign in", async ({ page, backend }) => {
    await page.goto("/auth?mode=signin");
    await signInForm(page, users.parent.email, "Wrong-Password-1");
    await expect(toast(page, "Sign in failed")).toBeVisible();
    await expect(toast(page, "Invalid login credentials")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\?mode=signin$/);
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
    expect(backend.writesTo("token")).toHaveLength(1);
  });

  test("the form checks the email and password before sending", async ({ page, backend }) => {
    await page.goto("/auth?mode=signin");
    await page.getByRole("textbox", { name: /^Email/ }).fill("not-an-email@x");
    await page.getByLabel("Password", { exact: true }).fill("short");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText("Please enter a valid email address")).toBeVisible();
    await expect(page.getByText("Password must be at least 8 characters")).toBeVisible();
    expect(backend.writesTo("token")).toHaveLength(0);
  });

  test("an unconfirmed email goes to the confirmation page", async ({ page, backend }) => {
    await failSignInUnconfirmed(page);
    await page.goto("/auth?mode=signin");
    await signInForm(page, users.parent.email, PASSWORD);
    await expect(page).toHaveURL(`/signupconfirmation?email=${encodeURIComponent(users.parent.email)}`);
    await expect(toast(page, "Confirm your email")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await expect(page.getByText(users.parent.email, { exact: true })).toBeVisible();
  });

  test("a protected page opened signed out comes back after sign in", async ({ page, backend }) => {
    await page.goto("/my-sessions?x=1");
    await expect(page).toHaveURL(/\/auth\?mode=signin$/);
    await signInForm(page, users.parent.email, PASSWORD);
    await expect(page).toHaveURL(/\/my-sessions\?x=1$/);
  });

  test("Forgot password? opens the reset request", async ({ page, backend }) => {
    await page.goto("/auth?mode=signin");
    await page.getByRole("button", { name: "Forgot password?" }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(page.getByText("Forgot password?").first()).toBeVisible();
  });
});

test.describe("sign out", () => {
  for (const persona of ["coach", "parent"] as Persona[]) {
    test(`${persona} signs out from the account menu and stays signed out after a reload`, async ({ page, as, backend }) => {
      await as(page, persona);
      await page.goto("/dashboard");
      // Phone: only the avatar in the top bar. Desktop: the name at the foot of the sidebar
      // (the top bar has an avatar too).
      const firstName = persona === "coach" ? "Casey" : "Pat";
      const menus = accountMenu(page);
      await expect(menus.first()).toBeVisible();
      if (isPhone(page)) {
        await expect(menus).toHaveCount(1);
        await expect(menus).not.toContainText(firstName);
        await menus.click();
      } else {
        await expect(menus).toHaveCount(2);
        await menus.filter({ hasText: firstName }).click();
      }
      await expect(page.getByRole("menu")).toContainText(users[persona].email);
      await page.getByRole("menuitem", { name: "Sign out" }).click();
      // Signed out on a signed-in page: the sign-in screen.
      await expect(page).toHaveURL(/\/(auth\?mode=signin)?$/);
      await expect(page.getByText("Welcome back").first()).toBeVisible();
      await expect(accountMenu(page)).toHaveCount(0);
      // Signing out is local: the stored session is gone.
      expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("sb-")))).toEqual([]);
      expect(backend.writesTo("token", "POST")).toHaveLength(0);
      await page.reload();
      await expect(page.getByText("Welcome back").first()).toBeVisible();
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/auth\?mode=signin$/);
    });
  }
});

// ---------- Sign up ----------

const tile = (page: Page, name: string | RegExp) => page.getByRole("radio", { name: typeof name === "string" ? new RegExp(`^${name}`) : name });
const toggle = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name}`) });
const continueButton = (page: Page) => page.getByRole("button", { name: "Continue", exact: true });
const heading = (page: Page, name: string | RegExp) => page.getByRole("heading", { name });

/** The ZIP and session-type question (families and coaches). */
const answerWhere = async (page: Page) => {
  await expect(continueButton(page)).toBeDisabled();
  await page.getByLabel("ZIP code").fill("10001");
  // In person is on by default; a format is still needed.
  await expect(continueButton(page)).toBeDisabled();
  await toggle(page, "1-on-1").click();
  await expect(toggle(page, "1-on-1")).toHaveAttribute("aria-pressed", "true");
  await continueButton(page).click();
};

type AccountDetails = { first: string; last: string; email: string; athlete?: string };

/** The email account step: names, email, phone, password and the terms box. */
const fillAccount = async (page: Page, d: AccountDetails) => {
  if (d.athlete) await page.getByLabel("Your athlete's first name").fill(d.athlete);
  await page.getByLabel(/^(Your )?first name/i).fill(d.first);
  await page.getByLabel(/^(Your )?last name/i).fill(d.last);
  await page.getByRole("textbox", { name: /^Email/ }).fill(d.email);
  await page.getByPlaceholder("Phone number").fill("2025550143");
  await page.locator('input[autocomplete="new-password"]').fill(STRONG_PASSWORD);
};

const completeSignup = (page: Page) => page.getByRole("button", { name: "Complete signup" });

/** The 6-digit code that confirms the email, last in the email sign-up. */
const enterCode = async (page: Page, email: string) => {
  await expect(heading(page, "Check your email")).toBeVisible();
  await expect(page.getByText(`We sent a 6-digit code to ${email}.`)).toBeVisible();
  const verify = page.getByRole("button", { name: "Verify and finish" });
  await expect(verify).toBeDisabled();
  await page.getByLabel("Verification code").fill("123456");
  await verify.click();
};

const lastBody = (backend: MockBackend, name: string, method?: string) => backend.writesTo(name, method).at(-1)?.body as Record<string, unknown>;

test.describe("sign up", () => {
  test.beforeEach(async ({ page, backend }) => {
    seedSignup(backend);
    backend.rpc.get_coaches_public = [coachRow];
    await installSignupAuth(page, backend);
  });

  test("a coach answers the questions, creates the account and sees the draft profile", async ({ page, backend }) => {
    await page.goto("/auth?mode=signup");
    await expect(heading(page, "Who's signing up?")).toBeVisible();
    await tile(page, "I'm a coach").click();

    await expect(heading(page, "Which sport do you coach?")).toBeVisible();
    await tile(page, "Soccer").click();
    await expect(page.getByRole("heading", { name: "Which players do you coach?" })).toBeVisible();
    await expect(continueButton(page)).toBeDisabled();
    await toggle(page, "Field players").click();
    await continueButton(page).click();

    await expect(heading(page, "Which pillars do you coach?")).toBeVisible();
    await expect(continueButton(page)).toBeDisabled();
    await toggle(page, "On-field training").click();
    await toggle(page, "Mentorship").click();
    await continueButton(page).click();

    await expect(heading(page, "What levels do you coach?")).toBeVisible();
    await expect(continueButton(page)).toBeDisabled();
    await toggle(page, "Elite pathway").click();
    await continueButton(page).click();

    await expect(heading(page, "Where and how do you coach?")).toBeVisible();
    await answerWhere(page);

    await expect(heading(page, "Create your coach account")).toBeVisible();
    await fillAccount(page, { first: "Robin", last: "Hart", email: "Robin@Coach.test" });
    // The terms box gates the button.
    await expect(completeSignup(page)).toBeDisabled();
    await page.getByRole("checkbox").check();
    await completeSignup(page).click();

    await enterCode(page, "robin@coach.test");
    await expect(heading(page, "Your profile is started")).toBeVisible();
    await expect(page.getByText("Robin Hart")).toBeVisible();
    await expect(page.getByText("Draft, only you can see this")).toBeVisible();
    await expect(page.getByText("Based in 10001")).toBeVisible();

    const signup = lastBody(backend, "signup");
    expect(signup).toMatchObject({
      email: "robin@coach.test",
      password: STRONG_PASSWORD,
      data: { name: "Robin Hart", persona_type: "coach", phone_number: "+12025550143", password_pending: false },
    });
    expect(backend.writesTo("signup")[0].url).toContain(encodeURIComponent("/auth?mode=signup"));
    expect(lastBody(backend, "verify")).toMatchObject({ email: "robin@coach.test", token: "123456", type: "signup" });

    const coach = lastBody(backend, "coaches", "POST");
    expect(coach).toMatchObject({
      name: "Robin Hart",
      email: "robin@coach.test",
      specialties: ["On-field training", "Mentorship"],
      locations: ["10001"],
      positions: ["Field Player"],
      pathway_tags: expect.any(Array),
      session_formats: expect.any(Array),
      listed: false,
      is_verified: false,
    });
    const coachId = backend.table("coaches").find((c) => c.email === "robin@coach.test")?.id;
    expect(lastBody(backend, "coach_sport_pillars", "POST")).toEqual([
      { coach_id: coachId, sport_pillar_id: SOCCER_PILLARS[0].id, sport: "soccer" },
      { coach_id: coachId, sport_pillar_id: SOCCER_PILLARS[2].id, sport: "soccer" },
    ]);
    expect(lastBody(backend, "user_profiles", "POST")).toMatchObject({
      email: "robin@coach.test",
      name: "Robin Hart",
      persona_type: "coach",
      sport: "soccer",
      phone_number: "+12025550143",
      zip_code: "10001",
      coach_id: coachId,
      is_profile_completed: true,
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
      terms_accepted_at: expect.any(String),
    });
    expect(backend.writesTo("user", "PUT").at(-1)?.body).toMatchObject({ data: { persona_type: "coach", coach_id: coachId } });

    await page.getByRole("button", { name: "Set up my profile" }).click();
    await expect(page).toHaveURL(/\/setup$/);
  });

  test("an athlete 18 or over answers the questions, creates the account and sees matches", async ({ page, backend }) => {
    await page.goto("/auth?mode=signup");
    await tile(page, "I'm an athlete").click();
    await expect(heading(page, "Which sport?")).toBeVisible();
    await tile(page, "Soccer").click();
    await expect(heading(page, "What position do you play?")).toBeVisible();
    await tile(page, "Field player").click();

    await expect(heading(page, "What do you want to work on?")).toBeVisible();
    await expect(continueButton(page)).toBeDisabled();
    await toggle(page, "Video analysis").click();
    await continueButton(page).click();

    await expect(heading(page, "Which best describes you?")).toBeVisible();
    await tile(page, "College or pro").click();

    await expect(heading(page, "When were you born?")).toBeVisible();
    await expect(continueButton(page)).toBeDisabled();
    await page.getByLabel("Birth date").fill("2004-03-09");
    await continueButton(page).click();

    await expect(heading(page, "Where and how do you want to train?")).toBeVisible();
    await answerWhere(page);

    await expect(heading(page, "Save your matches")).toBeVisible();
    // The answers so far, as pills.
    for (const pill of ["Soccer", "Field player", "College or pro", "Video analysis"]) await expect(page.getByText(pill, { exact: true })).toBeVisible();

    // A weak password is refused before anything is sent.
    await fillAccount(page, { first: "Morgan", last: "Lee", email: "morgan@athlete.test" });
    await page.locator('input[autocomplete="new-password"]').fill("weakpass");
    await expect(page.getByText("At least one uppercase letter (A-Z)")).toBeVisible();
    await page.getByRole("checkbox").check();
    await completeSignup(page).click();
    await expect(toast(page, "Choose a stronger password")).toBeVisible();
    expect(backend.writesTo("signup")).toHaveLength(0);

    await page.locator('input[autocomplete="new-password"]').fill(STRONG_PASSWORD);
    await completeSignup(page).click();
    await enterCode(page, "morgan@athlete.test");

    await expect(heading(page, "A bit more about you")).toBeVisible();
    await page.getByLabel("Club or team").fill("Austin FC Academy");
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(page.getByRole("heading", { name: /coach(es)? fits? you/ })).toBeVisible();
    await expect(page.getByText("Casey Coach")).toBeVisible();

    expect(lastBody(backend, "signup")).toMatchObject({ email: "morgan@athlete.test", data: { name: "Morgan Lee", persona_type: "athlete" } });
    const athlete = lastBody(backend, "athlete_profiles", "POST");
    expect(athlete).toMatchObject({
      full_name: "Morgan Lee",
      date_of_birth: "2004-03-09",
      sport: "soccer",
      position: "Field player",
      tags: ["Video analysis"],
      phone_number: "+12025550143",
    });
    const athleteId = backend.table("athlete_profiles").find((a) => a.full_name === "Morgan Lee")?.id;
    expect(lastBody(backend, "user_profiles", "POST")).toMatchObject({
      name: "Morgan Lee",
      persona_type: "athlete",
      athlete_id: athleteId,
      date_of_birth: "2004-03-09",
      guardian_relationship: null,
      is_profile_completed: true,
      terms_version: TERMS_VERSION,
    });
    expect(lastBody(backend, "athlete_profiles", "PATCH")).toMatchObject({ high_school: "Austin FC Academy" });
    expect(backend.writesTo("athlete_profiles", "PATCH").at(-1)?.url).toContain(`id=eq.${athleteId}`);

    await page.getByRole("button", { name: /See all \d+ coach/ }).click();
    await expect(page).toHaveURL(/\/coaches$/);
  });

  test("an athlete under 18 emails a parent instead of creating an account", async ({ page, backend }) => {
    await page.goto("/auth?mode=signup");
    await tile(page, "I'm an athlete").click();
    await tile(page, "Soccer").click();
    await tile(page, "Goalkeeper").click();
    await toggle(page, "Mentorship").click();
    await continueButton(page).click();
    await tile(page, "Elite pathway").click();
    const year = new Date().getUTCFullYear() - 15;
    await page.getByLabel("Birth date").fill(`${year}-06-01`);
    await continueButton(page).click();

    await expect(heading(page, "Last step: add a parent")).toBeVisible();
    const send = page.getByRole("button", { name: "Send to my parent" });
    await expect(send).toBeDisabled();
    await page.getByLabel("Parent or guardian's email").fill("Mum@Family.test");
    await send.click();
    await expect(heading(page, "We emailed your parent")).toBeVisible();
    expect(lastBody(backend, "send-email")).toMatchObject({ kind: "parent_invite", email: "mum@family.test", sport: "Soccer", position: "Goalkeeper", pillars: ["Mentorship"] });
    expect(backend.writesTo("signup")).toHaveLength(0);
  });

  test("a parent answers for their athlete, creates the account and skips the extras", async ({ page, backend }) => {
    await page.goto("/auth?mode=signup");
    await tile(page, "I'm a parent or guardian").click();
    await tile(page, "Soccer").click();
    await expect(heading(page, "What position does your athlete play?")).toBeVisible();
    await tile(page, "Field player").click();
    await expect(heading(page, "What do you want your athlete to work on?")).toBeVisible();
    await toggle(page, "On-field training").click();
    await continueButton(page).click();
    await tile(page, "Youth development").click();
    await expect(heading(page, "When was your athlete born?")).toBeVisible();
    const year = new Date().getUTCFullYear() - 11;
    await page.getByLabel("Birth date").fill(`${year}-02-20`);
    await continueButton(page).click();
    await expect(heading(page, "Where and how does your athlete want to train?")).toBeVisible();
    await answerWhere(page);

    await expect(heading(page, "Save your matches")).toBeVisible();
    await expect(page.getByText("Age 11")).toBeVisible();
    await fillAccount(page, { first: "Sam", last: "Rivera", email: "sam@parent.test", athlete: "Ava" });
    await page.getByRole("checkbox").check();
    await completeSignup(page).click();
    await enterCode(page, "sam@parent.test");

    await expect(heading(page, "A bit more about Ava")).toBeVisible();
    await continueButton(page).click();
    await expect(page.getByRole("heading", { name: /fits? Ava/ })).toBeVisible();

    expect(lastBody(backend, "signup")).toMatchObject({ email: "sam@parent.test", data: { name: "Sam Rivera", persona_type: "parent" } });
    expect(lastBody(backend, "athlete_profiles", "POST")).toMatchObject({ full_name: "Ava Rivera", date_of_birth: `${year}-02-20`, position: "Field player" });
    expect(lastBody(backend, "user_profiles", "POST")).toMatchObject({
      name: "Sam Rivera",
      persona_type: "parent",
      guardian_relationship: "Parent",
      is_profile_completed: true,
    });
    // Nothing optional was filled in, so nothing more was saved.
    expect(backend.writesTo("athlete_profiles", "PATCH")).toHaveLength(0);
    expect(backend.writesTo("user", "PUT").at(-1)?.body).toMatchObject({ data: { persona_type: "parent" } });
  });

  test("the back arrow and progress bar return to earlier questions with the answers kept", async ({ page }) => {
    await page.goto("/auth?mode=signup");
    await tile(page, "I'm a parent or guardian").click();
    await tile(page, "Soccer").click();
    await tile(page, "Goalkeeper").click();
    await expect(heading(page, "What do you want your athlete to work on?")).toBeVisible();
    await expect(page.getByRole("group", { name: "Question 3 of 6" })).toBeVisible();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(heading(page, "Which sport?")).toBeVisible();
    await expect(tile(page, "Goalkeeper")).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: "Back to question 1" }).click();
    await expect(heading(page, "Who's signing up?")).toBeVisible();
    await expect(tile(page, "I'm a parent or guardian")).toHaveAttribute("aria-checked", "true");
  });

  test("a wrong code is refused and a new one can be sent", async ({ page, backend }) => {
    await page.goto("/auth?mode=signup&persona=coach");
    // ?persona=coach skips "who".
    await expect(heading(page, "Which sport do you coach?")).toBeVisible();
    await tile(page, "Soccer").click();
    await toggle(page, "Goalkeepers").click();
    await continueButton(page).click();
    await toggle(page, "Video analysis").click();
    await continueButton(page).click();
    await toggle(page, "Recreational").click();
    await continueButton(page).click();
    await answerWhere(page);
    await fillAccount(page, { first: "Kai", last: "Moss", email: "kai@coach.test" });
    await page.getByRole("checkbox").check();
    await completeSignup(page).click();

    await expect(heading(page, "Check your email")).toBeVisible();
    await page.getByLabel("Verification code").fill("000000");
    await page.getByRole("button", { name: "Verify and finish" }).click();
    await expect(page.getByText("That code has expired. Send a new one.")).toBeVisible();
    expect(backend.writesTo("coaches", "POST")).toHaveLength(0);

    await page.getByRole("button", { name: "Resend code" }).click();
    await expect(toast(page, "New code sent")).toBeVisible();
    expect(lastBody(backend, "resend")).toMatchObject({ type: "signup", email: "kai@coach.test" });
  });

  test("an email that already has an account is refused at the account step", async ({ page }) => {
    await page.goto("/auth?mode=signup&persona=athlete");
    await tile(page, "Soccer").click();
    await tile(page, "Field player").click();
    await toggle(page, "Mentorship").click();
    await continueButton(page).click();
    await tile(page, "College or pro").click();
    await page.getByLabel("Birth date").fill("2001-01-01");
    await continueButton(page).click();
    await answerWhere(page);
    await fillAccount(page, { first: "Alex", last: "Athlete", email: users.athlete.email });
    await page.getByRole("checkbox").check();
    await completeSignup(page).click();
    await expect(toast(page, "User already registered")).toBeVisible();
    await expect(heading(page, "Save your matches")).toBeVisible();
  });

  test("Continue with Google at the account step goes to Google sign-in", async ({ page, baseURL }) => {
    await page.goto("/auth?mode=signup&persona=coach");
    await tile(page, "Soccer").click();
    await toggle(page, "Goalkeepers").click();
    await continueButton(page).click();
    await toggle(page, "Mentorship").click();
    await continueButton(page).click();
    await toggle(page, "Recreational").click();
    await continueButton(page).click();
    await answerWhere(page);
    const authorize = page.waitForRequest((r) => r.url().includes("/auth/v1/authorize"));
    await page.getByRole("button", { name: "Continue with Google" }).click();
    const url = new URL((await authorize).url());
    expect(url.origin).toBe(MOCK_SUPABASE_URL);
    expect(url.searchParams.get("provider")).toBe("google");
    expect(url.searchParams.get("redirect_to")).toBe(`${new URL(baseURL!).origin}/auth?mode=signup`);
  });

  test("Continue with Google on the sign-in tab goes to Google sign-in", async ({ page }) => {
    await page.goto("/auth?mode=signin");
    const authorize = page.waitForRequest((r) => r.url().includes("/auth/v1/authorize"));
    await page.getByRole("button", { name: "Continue with Google" }).click();
    const url = new URL((await authorize).url());
    expect(url.searchParams.get("provider")).toBe("google");
    expect(url.searchParams.get("redirect_to")).toMatch(/^http:\/\/localhost:\d+\/$/);
  });
});

test.describe("unfinished account", () => {
  test.beforeEach(async ({ backend }) => {
    seedSignup(backend);
    backend.rpc.get_coaches_public = [coachRow];
  });

  test("signing in with an unfinished account goes to sign-up and finishes it", async ({ page, backend }) => {
    await page.goto("/auth?mode=signin");
    await signInForm(page, users.incomplete.email, PASSWORD);
    await expect(page).toHaveURL(/\/auth\?mode=signup$/);
    await expect(toast(page, "Finish signing up")).toBeVisible();
    await expect(heading(page, "Who's signing up?")).toBeVisible();
    await expect(page.getByText(`Signed in as ${users.incomplete.email}.`)).toBeVisible();

    await tile(page, "I'm an athlete").click();
    await tile(page, "Soccer").click();
    await tile(page, "Field player").click();
    await toggle(page, "Mentorship").click();
    await continueButton(page).click();
    await tile(page, "College or pro").click();
    await page.getByLabel("Birth date").fill("2003-07-04");
    await continueButton(page).click();
    await answerWhere(page);

    // Signed in already: only the details the account lacks.
    await expect(heading(page, "Almost done")).toBeVisible();
    await expect(page.getByRole("textbox", { name: /^Email/ })).toHaveCount(0);
    await page.getByRole("checkbox").check();
    await completeSignup(page).click();
    await expect(toast(page, "Add your mobile number to finish")).toBeVisible();
    await page.getByPlaceholder("Phone number").fill("2025550199");
    await completeSignup(page).click();

    await expect(heading(page, "A bit more about you")).toBeVisible();
    expect(backend.writesTo("signup")).toHaveLength(0);
    const profile = backend.table("user_profiles").find((p) => p.id === IDS.newUser)!;
    expect(profile).toMatchObject({ persona_type: "athlete", is_profile_completed: true, phone_number: "+12025550199", zip_code: "10001", terms_version: TERMS_VERSION });
    expect(lastBody(backend, "user_profiles", "POST")).toMatchObject({ id: IDS.newUser, email: users.incomplete.email, is_profile_completed: true });
    expect(profile.athlete_id).toBe(backend.table("athlete_profiles").find((a) => a.user_id === IDS.newUser)?.id);
  });

  test("an unfinished account opening the app is sent to sign-up", async ({ page, as }) => {
    await as(page, "incomplete");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\?mode=signup$/);
    await expect(heading(page, "Who's signing up?")).toBeVisible();
  });
});

// ---------- Passwords ----------

test.describe("forgot password", () => {
  test("sends a reset link and shows where it went, with a resend cooldown", async ({ page, backend }) => {
    await page.goto("/forgot-password");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("Email is required").or(page.getByText(/enter (your|an) email/i))).toBeVisible();
    expect(backend.writesTo("recover")).toHaveLength(0);

    await page.getByLabel("Email").fill(users.parent.email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("Check your email")).toBeVisible();
    await expect(page.getByText(users.parent.email, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Resend link in \d+s/ })).toBeDisabled();
    expect(lastBody(backend, "recover")).toMatchObject({ email: users.parent.email });
    expect(backend.writesTo("recover")[0].url).toContain(encodeURIComponent("/reset-password"));

    await page.getByRole("button", { name: "Use a different email" }).click();
    await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();
    await page.getByRole("button", { name: "Back to sign in" }).click();
    await expect(page).toHaveURL(/\/auth\?mode=signin$/);
  });

  test("the resend button works again once the cooldown ends", async ({ page, backend }) => {
    await page.clock.install();
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(users.coach.email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("button", { name: "Resend link in 60s" })).toBeDisabled();
    await page.clock.runFor(61_000);
    await page.getByRole("button", { name: "Resend link", exact: true }).click();
    await expect(page.getByRole("button", { name: /Resend link in \d+s/ })).toBeVisible();
    expect(backend.writesTo("recover")).toHaveLength(2);
  });
});

test.describe("reset password", () => {
  test("a recovery link opens the form, checks the rules and saves the new password", async ({ page, backend }) => {
    const parent = backend.users.find((u) => u.id === IDS.parentUser)!;
    await page.goto(`/reset-password${recoveryHash(backend, parent)}`);
    await expect(page.getByLabel("New password")).toBeVisible();
    // The tokens leave the address bar.
    await expect(page).toHaveURL(/\/reset-password$/);

    await page.getByLabel("New password").fill("lowercase1!");
    await expect(page.getByText("At least one uppercase letter (A-Z)")).toBeVisible();
    await page.getByLabel("Confirm password").fill("lowercase1!");
    await page.getByRole("button", { name: "Reset password" }).click();
    await expect(page.getByText(/New password must be at least 8 characters/)).toBeVisible();

    await page.getByLabel("New password").fill(STRONG_PASSWORD);
    await page.getByLabel("Confirm password").fill(`${STRONG_PASSWORD}x`);
    await page.getByRole("button", { name: "Reset password" }).click();
    await expect(page.getByText(/passwords (do not|don't) match/i)).toBeVisible();
    expect(backend.writesTo("user", "PUT")).toHaveLength(0);

    await page.getByLabel("Confirm password").fill(STRONG_PASSWORD);
    await page.getByRole("button", { name: "Reset password" }).click();
    await expect(page).toHaveURL(/\/auth\?mode=signin&message=password-updated$/);
    await expect(page.getByText("Password updated. Sign in with your new password.")).toBeVisible();
    expect(lastBody(backend, "user", "PUT")).toMatchObject({ password: STRONG_PASSWORD });
    expect(backend.writesTo("logout")).toHaveLength(1);

    // The old password no longer works; the new one does.
    await signInForm(page, users.parent.email, PASSWORD);
    await expect(toast(page, "Sign in failed")).toBeVisible();
    await page.getByLabel("Password", { exact: true }).fill(STRONG_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("an expired link says so and offers a new one", async ({ page, backend }) => {
    await page.goto("/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
    await expect(page.getByText("This reset link has expired. Request a new one.")).toBeVisible();
    await page.getByRole("button", { name: "Request a new link" }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
  });
});

test.describe("change password in settings", () => {
  for (const persona of ["coach", "parent"] as Persona[]) {
    test(`${persona} changes their password from Password and account`, async ({ page, as, backend }) => {
      await as(page, persona);
      await page.goto("/settings?tab=security");
      await expect(page.getByText(`Signed in as ${users[persona].email}`)).toBeVisible();
      await page.getByRole("button", { name: "Change password" }).click();

      const update = page.getByRole("button", { name: "Update password" });
      await update.click();
      await expect(page.getByRole("alert")).toHaveText("Enter your current password");

      await page.getByLabel("Current password").fill("Not-My-Password-1");
      await page.getByLabel("New password", { exact: true }).fill("short");
      await update.click();
      await expect(page.getByRole("alert")).toContainText("Your new password must be at least 8 characters");

      await page.getByLabel("New password", { exact: true }).fill(STRONG_PASSWORD);
      await expect(page.getByText("Strong.")).toBeVisible();
      await page.getByLabel("Confirm new password").fill("Something-Else-1");
      await update.click();
      await expect(page.getByRole("alert")).toHaveText("Passwords don't match");

      // A wrong current password is checked with a sign-in and nothing is changed.
      await page.getByLabel("Confirm new password").fill(STRONG_PASSWORD);
      await update.click();
      await expect(page.getByRole("alert")).toHaveText("That password isn't right.");
      expect(lastBody(backend, "token")).toMatchObject({ email: users[persona].email });
      expect(backend.writesTo("user", "PUT")).toHaveLength(0);

      await page.getByLabel("Current password").fill(PASSWORD);
      await update.click();
      await expect(toast(page, "Password updated")).toBeVisible();
      expect(lastBody(backend, "user", "PUT")).toMatchObject({ password: STRONG_PASSWORD });
      expect(backend.users.find((u) => u.email === users[persona].email)?.password).toBe(STRONG_PASSWORD);
      // Then signed out to sign in with it.
      await expect(page).toHaveURL(/\/auth(\?mode=signin)?$/, { timeout: 15_000 });
      await expect(page.getByText("Welcome back").first()).toBeVisible();
    });
  }

  test("Sign out other devices", async ({ page, as, backend }) => {
    await as(page, "athlete");
    await page.goto("/settings?tab=security");
    await page.getByRole("button", { name: "Sign out other devices" }).click();
    await expect(toast(page, "Signed out of your other devices")).toBeVisible();
    expect(backend.writesTo("logout").at(-1)?.url).toContain("scope=others");
  });
});

// ---------- Confirmation page ----------

test.describe("sign-up confirmation", () => {
  test("shows the address, resends the email and links to support", async ({ page, backend }) => {
    await page.goto("/signupconfirmation?email=new.family%40e2e.test");
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await expect(page.getByText("new.family@e2e.test", { exact: true })).toBeVisible();
    await expect(page.getByText("Click the confirmation link in the email")).toBeVisible();

    await page.getByRole("button", { name: "Resend confirmation email" }).click();
    await expect(toast(page, "We've sent the confirmation again to new.family@e2e.test.")).toBeVisible();
    const resend = backend.writesTo("resend").at(-1)!;
    expect(resend.body).toMatchObject({ type: "signup", email: "new.family@e2e.test" });
    expect(resend.url).toContain(encodeURIComponent("/auth?mode=signup"));

    await page.getByRole("button", { name: "Contact support" }).click();
    await expect(page).toHaveURL(/\/contact$/);
  });

  test("without an email there is nothing to resend", async ({ page, backend }) => {
    await page.goto("/signupconfirmation");
    await expect(page.getByText("your email", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Resend confirmation email" })).toBeDisabled();
  });
});

// ---------- Coach invites ----------

/** Opens the invite signed out, creates the account from it and answers the questions. */
const signUpFromInvite = async (page: Page, backend: MockBackend) => {
  seedSignup(backend);
  seedInvite(backend);
  await installSignupAuth(page, backend);
  await page.goto(`/invite/${INVITE_TOKEN}`);
  await expect(page.getByRole("heading", { name: "Jamie, Coach Casey Coach invited you to AthaNext" })).toBeVisible();
  await expect(page.getByText("j***@family.test")).toBeVisible();
  expect(lastBody(backend, "get_referral_invite")).toEqual({ _token: INVITE_TOKEN });

  await page.getByRole("link", { name: "Create account" }).click();
  await expect(page).toHaveURL(new RegExp(`/auth\\?mode=signup&persona=athlete&invite=${INVITE_TOKEN}$`));
  await expect(page.getByText("Coach Casey Coach invited you to AthaNext.")).toBeVisible();
  // The invite fills in what the coach told us, and its email needs no code.
  await expect(heading(page, "Create your account")).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^Email/ })).toHaveValue(INVITED_EMAIL);
  await expect(page.getByLabel("First name")).toHaveValue("Jamie");
  await expect(page.getByText("Verified by your invite, no code needed")).toBeVisible();
  expect(lastBody(backend, "invite-signup")).toEqual({ action: "lookup", token: INVITE_TOKEN });

  await page.getByPlaceholder("Phone number").fill("2025550111");
  await page.locator('input[autocomplete="new-password"]').fill(STRONG_PASSWORD);
  await page.getByRole("checkbox").check();
  await completeSignup(page).click();
  await expect(heading(page, "Which sport?")).toBeVisible();
  expect(lastBody(backend, "invite-signup")).toEqual({ action: "create", token: INVITE_TOKEN, password: STRONG_PASSWORD, phone: "+12025550111" });
  expect(lastBody(backend, "token")).toMatchObject({ email: INVITED_EMAIL });
  expect(backend.writesTo("signup")).toHaveLength(0);

  // The questions come after the account, then back to the invite to accept it.
  await expect(tile(page, "Soccer")).toHaveAttribute("aria-checked", "true");
  await tile(page, "Field player").click();
  await expect(heading(page, "Besides training with Casey, what else do you work on?")).toBeVisible();
  await continueButton(page).click();
  await tile(page, "Elite pathway").click();
  await page.getByLabel("Birth date").fill("2005-09-09");
  await continueButton(page).click();
  await answerWhere(page);
  await expect(heading(page, "A bit more about you")).toBeVisible();
  await continueButton(page).click();
  await expect(page).toHaveURL(new RegExp(`/invite/${INVITE_TOKEN}$`));
  expect(lastBody(backend, "user_profiles", "POST")).toMatchObject({ email: INVITED_EMAIL, persona_type: "athlete", name: "Jamie Rivera", is_profile_completed: true });
};

test.describe("coach invite link", () => {
  test("a valid invite shows the coach and leads into sign-up and back to the invite", async ({ page, backend }) => {
    await signUpFromInvite(page, backend);
    // After a reload the new athlete account can accept (see the fixme below for without one).
    await page.reload();
    await expect(page.getByText("How do you know Coach Casey Coach?")).toBeVisible();
    await expect(page.getByRole("button", { name: "Accept invite" })).toBeDisabled();
  });

  test("right after an invited sign-up the invite page offers Accept without a reload", async ({ page, backend }) => {
    await signUpFromInvite(page, backend);
    await expect(page.getByText("How do you know Coach Casey Coach?")).toBeVisible();
  });

  test("an unknown invite can't be used", async ({ page, backend }) => {
    seedInvite(backend);
    await page.goto(`/invite/${DEAD_TOKEN}`);
    await expect(page.getByRole("heading", { name: "This invite link can't be used" })).toBeVisible();
    await page.getByRole("link", { name: "Browse coaches" }).click();
    await expect(page).toHaveURL(/\/coaches$/);
  });

  test("an accepted invite can't be used again", async ({ page, backend }) => {
    seedInvite(backend, { state: "used" });
    await page.goto(`/invite/${INVITE_TOKEN}`);
    await expect(page.getByRole("heading", { name: "This invite link can't be used" })).toBeVisible();
  });

  test("an expired invite says so", async ({ page, backend }) => {
    seedInvite(backend, { state: "expired" });
    await page.goto(`/invite/${INVITE_TOKEN}`);
    await expect(page.getByRole("heading", { name: "This invite has expired" })).toBeVisible();
    await expect(page.getByText("Ask Coach Casey Coach to resend it.")).toBeVisible();
  });

  test("I already have an account signs in and comes back to the invite", async ({ page, backend }) => {
    seedInvite(backend);
    await page.goto(`/invite/${INVITE_TOKEN}`);
    await page.getByRole("button", { name: "I already have an account" }).click();
    await expect(page).toHaveURL(/\/auth\?mode=signin$/);
    await signInForm(page, users.athlete.email, PASSWORD);
    await expect(page).toHaveURL(new RegExp(`/invite/${INVITE_TOKEN}$`));
    // Signed in with a different email than the invite's.
    await expect(page.getByText(`You're signed in as ${users.athlete.email}, which doesn't match this invite.`)).toBeVisible();
  });
});
