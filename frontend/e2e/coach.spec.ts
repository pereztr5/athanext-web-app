import { expect, test } from "@playwright/test";
import { account, signIn, visit, watchErrors } from "./helpers";

const coach = account("COACH");

test.describe("coach account", () => {
  test.skip(!coach, "Set E2E_COACH_EMAIL and E2E_COACH_PASSWORD to run");

  test("signs in and every main page loads and fits the screen", async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page, coach!);
    for (const route of ["/dashboard", "/schedule", "/my-sessions", "/athletes", "/business", "/payments", "/profile", "/chat", "/settings"]) {
      await visit(page, route);
    }
    expect(errors, "uncaught errors").toEqual([]);
  });

  test("create session opens from My schedule", async ({ page }) => {
    await signIn(page, coach!);
    await visit(page, "/schedule/create");
    // Opens the form only. Nothing is saved.
    await expect(page.getByText(/1-on-1|one-on-one/i).first()).toBeVisible();
  });
});
