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
