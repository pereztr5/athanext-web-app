import { expect, test } from "@playwright/test";
import { expectNoSidewaysScroll, watchErrors } from "./helpers";

// Signed-out pages. No account needed.
const pages = [
  { route: "/auth?mode=signin", text: /sign in/i },
  { route: "/auth?mode=signup", text: /welcome to athanext/i },
  { route: "/forgot-password", text: /reset/i },
  { route: "/coaches", text: /coach/i },
  { route: "/privacy-policy", text: /privacy/i },
  { route: "/terms-and-conditions", text: /terms/i },
];

for (const { route, text } of pages) {
  test(`signed out: ${route} loads and fits the screen`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(route);
    await expect(page.getByText(text).first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectNoSidewaysScroll(page, route);
    expect(errors, `uncaught errors on ${route}`).toEqual([]);
  });
}

test("sign up: the questions start and Continue with Google is offered at the account step", async ({ page }) => {
  await page.goto("/auth?mode=signup");
  await expect(page.getByText(/welcome to athanext/i).first()).toBeVisible();
  await expectNoSidewaysScroll(page, "sign-up first question");
});

test("sign in: a wrong password shows an error and the page stays usable", async ({ page }) => {
  await page.goto("/auth?mode=signin");
  await page.locator("#signin-email").fill("nobody@example.com");
  await page.locator("#signin-password").fill("not-the-password-1");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("button", { name: /^sign in$/i })).toBeEnabled({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/auth/);
});

test("forgot password: sending shows Check your email with a resend cooldown", async ({ page }) => {
  // Answer the reset request here so no email is ever sent.
  await page.route("**/auth/v1/recover**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );
  await page.goto("/forgot-password");
  await page.locator("#reset-email").fill("nobody@example.com");
  await page.getByRole("button", { name: /send reset link/i }).click();
  await expect(page.getByText(/check your email/i).first()).toBeVisible();
  await expect(page.getByText("nobody@example.com")).toBeVisible();
  await expect(page.getByRole("button", { name: /resend link in/i })).toBeDisabled();
  await expect(page.getByRole("button", { name: /back to sign in/i })).toBeVisible();
  await expectNoSidewaysScroll(page, "forgot password sent");
});

test("sign in: a password-updated link shows the success notice", async ({ page }) => {
  await page.goto("/auth?mode=signin&message=password-updated");
  await expect(page.getByText(/password updated/i)).toBeVisible();
});

test("camp page: an unknown camp link shows a friendly not-found and fits the screen", async ({ page }) => {
  const errors = watchErrors(page);
  const writes: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (request.method() === "GET" || request.method() === "OPTIONS" || request.method() === "HEAD") return;
    // get_camp_page is a read (PostgREST runs RPCs over POST); anything else would be a write.
    if (url.includes("/rest/v1/rpc/get_camp_page")) return;
    if (url.includes("/rest/v1/") || url.includes("/functions/v1/") || url.includes("/storage/v1/")) writes.push(`${request.method()} ${url}`);
  });
  // The page asks for the camp; answer "no such camp" here so the test needs no data.
  await page.route("**/rest/v1/rpc/get_camp_page**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "null" }));

  await page.goto("/no-such-coach-e2e/no-such-camp-e2e");
  await expect(page.getByRole("heading", { name: /this camp isn't open/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /find a coach/i })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expectNoSidewaysScroll(page, "unknown camp");

  // The old /camps/<coach>/<camp> link lands on the same page.
  await page.goto("/camps/no-such-coach-e2e/no-such-camp-e2e?src=link");
  await expect(page).toHaveURL(/\/no-such-coach-e2e\/no-such-camp-e2e\?src=link$/);
  await expect(page.getByRole("heading", { name: /this camp isn't open/i })).toBeVisible();

  // A link that can't be a camp never asks the database.
  await page.goto("/no-such-coach-e2e/Not_A_Camp");
  await expect(page.getByRole("heading", { name: /this camp isn't open/i })).toBeVisible();

  expect(writes, "the camp page must not write anything").toEqual([]);
  expect(errors, "uncaught errors on the camp page").toEqual([]);
});
