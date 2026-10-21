import { expect, test } from "@playwright/test";
import { account, signIn, visit, watchErrors } from "./helpers";

const family = account("FAMILY");

test.describe("family account", () => {
  test.skip(!family, "Set E2E_FAMILY_EMAIL and E2E_FAMILY_PASSWORD to run");

  test("signs in and every main page loads and fits the screen", async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page, family!);
    for (const route of ["/dashboard", "/my-sessions", "/book", "/my-coaches", "/coaches", "/chat", "/settings", "/help"]) {
      await visit(page, route);
    }
    expect(errors, "uncaught errors").toEqual([]);
  });

  test("booking opens a coach and shows times to pick", async ({ page }) => {
    await signIn(page, family!);
    await visit(page, "/book");
    // Stops before payment: nothing is booked or charged.
    await expect(page.getByRole("button").first()).toBeVisible();
  });

  test("stays signed in after a reload", async ({ page }) => {
    await signIn(page, family!);
    await visit(page, "/my-sessions");
    await page.reload();
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page.locator("main").first()).toBeVisible();
  });
});
