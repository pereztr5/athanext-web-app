import type { Page } from "@playwright/test";
import { test, expect } from "./test";
import { IDS } from "./personas";
import { handleGuardianInvite, handleResolveCoach, profileRow, seedGuardians, seedParentAthlete, SETTINGS } from "./data/settings";

// /settings for coaches, parents and athletes: each tab's edits and the writes they send.
// Password change is covered elsewhere and skipped here.

const tab = (page: Page, name: string) => page.getByRole("navigation", { name: "Settings" }).getByRole("button", { name, exact: true });
/**
 * Runs an action that saves the coach and waits until every request it set off (the save, the
 * coach refetch) has finished and React has rendered: the offline-pay form resets to the
 * refetched row, so typing before then is lost.
 */
const afterSave = async (page: Page, action: () => Promise<unknown>) => {
  const pending = new Set<unknown>();
  const start = (r: unknown) => pending.add(r);
  const end = (r: unknown) => pending.delete(r);
  page.on("request", start);
  page.on("requestfinished", end);
  page.on("requestfailed", end);
  try {
    await action();
    await expect.poll(() => pending.size, { intervals: [100] }).toBe(0);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect.poll(() => pending.size, { intervals: [100] }).toBe(0);
  } finally {
    page.off("request", start);
    page.off("requestfinished", end);
    page.off("requestfailed", end);
  }
};
const toast = (page: Page, text: string | RegExp) => page.getByText(text).first();

test.describe("settings as a coach", () => {
  test.beforeEach(async ({ page, backend, as }) => {
    handleResolveCoach(backend);
    // A business name, so tests can wait for the coach row to load before typing (the form
    // resets to the saved values when it arrives).
    backend.table("coaches")[0].company = "Casey Soccer";
    await as(page, "coach");
  });

  test("account: shows saved details, validates and saves name, phone and business", async ({ page, backend }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Account settings" })).toBeVisible();
    await expect(tab(page, "Account")).toHaveAttribute("aria-current", "page");
    await expect(page.getByLabel("First name")).toHaveValue("Casey");
    await expect(page.getByLabel("Last name")).toHaveValue("Coach");
    await expect(page.getByLabel("Email")).toHaveValue("coach@e2e.test");
    await expect(page.getByLabel("Email")).toHaveAttribute("readonly", "");
    await expect(page.getByLabel("Phone")).toHaveValue("+15555550100");
    await expect(page.getByLabel("Business name")).toHaveValue("Casey Soccer");
    await expect(page.getByText("You have unsaved changes")).toHaveCount(0);

    await page.getByLabel("First name").fill("");
    await page.getByLabel("Phone").fill("555-01");
    await expect(page.getByText("You have unsaved changes")).toBeVisible();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Required")).toBeVisible();
    await expect(page.getByText("Enter a full phone number")).toBeVisible();
    expect(backend.writesTo("coaches", "PATCH")).toHaveLength(0);

    await page.getByLabel("First name").fill("Casey");
    await page.getByLabel("Last name").fill("Morgan");
    await page.getByLabel("Phone").fill("(212) 555-0199");
    await page.getByLabel("Business name").fill("Morgan Soccer Academy");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(toast(page, "Changes saved")).toBeVisible();
    const coach = backend.writesTo("coaches", "PATCH");
    expect(coach).toHaveLength(1);
    expect(coach[0].url).toContain(`id=eq.${IDS.coach}`);
    expect(coach[0].body).toEqual({ name: "Casey Morgan", company: "Morgan Soccer Academy" });
    const profile = backend.writesTo("user_profiles", "PATCH");
    expect(profile.at(-1)!.url).toContain(`id=eq.${IDS.coachUser}`);
    expect(profile.at(-1)!.body).toEqual({ name: "Casey Morgan", phone_number: "(212) 555-0199" });
    // Saved values become the new baseline: no save bar.
    await expect(page.getByText("You have unsaved changes")).toHaveCount(0);
    await expect(page.getByLabel("Last name")).toHaveValue("Morgan");
  });

  test("account: Discard puts the saved values back", async ({ page, backend }) => {
    await page.goto("/settings");
    await expect(page.getByLabel("Business name")).toHaveValue("Casey Soccer");
    await page.getByLabel("Business name").fill("Something else");
    await page.getByRole("button", { name: "Discard" }).click();
    await expect(page.getByLabel("Business name")).toHaveValue("Casey Soccer");
    await expect(page.getByText("You have unsaved changes")).toHaveCount(0);
    expect(backend.writesTo("coaches", "PATCH")).toHaveLength(0);
  });

  test("account: leaving a tab with unsaved changes asks first", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByLabel("Business name")).toHaveValue("Casey Soccer");
    await page.getByLabel("Business name").fill("Unsaved Co");

    page.once("dialog", (dialog) => void dialog.dismiss());
    await tab(page, "Notifications").click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByLabel("Business name")).toHaveValue("Unsaved Co");

    page.once("dialog", (dialog) => {
      expect(dialog.message()).toBe("Discard unsaved changes?");
      void dialog.accept();
    });
    await tab(page, "Notifications").click();
    await expect(page).toHaveURL(/\/settings\?tab=notifications$/);
    await expect(page.getByRole("heading", { name: "Email notifications" })).toBeVisible();
  });

  test("account: the time zone saves straight away", async ({ page, backend }) => {
    await page.goto("/settings");
    await page.getByRole("combobox", { name: "Time zone" }).click();
    await page.getByRole("option", { name: /Eastern Time \(New York\)/ }).click();
    await expect(toast(page, "Time zone updated")).toBeVisible();
    expect(backend.writesTo("user_profiles", "PATCH").at(-1)!.body).toEqual({ timezone: "America/New_York" });
    await expect(page.getByRole("combobox", { name: "Time zone" })).toContainText("Eastern Time (New York)");
  });

  test("notifications: each switch saves its email preference", async ({ page, backend }) => {
    await page.goto("/settings?tab=notifications");
    const bookings = page.getByRole("switch", { name: "Bookings by email" });
    const messages = page.getByRole("switch", { name: "Messages by email" });
    await expect(bookings).toBeChecked();
    await expect(messages).toBeChecked();

    await bookings.click();
    await expect(bookings).not.toBeChecked();
    await expect.poll(() => backend.writesTo("user_profiles", "PATCH").length).toBe(1);
    expect(backend.writesTo("user_profiles", "PATCH")[0].body).toEqual({ notification_prefs: { booking_email: false } });

    await messages.click();
    await expect.poll(() => backend.writesTo("user_profiles", "PATCH").length).toBe(2);
    expect(backend.writesTo("user_profiles", "PATCH")[1].body).toEqual({ notification_prefs: { booking_email: false, message_email: false } });

    // Stays off after a reload.
    await page.reload();
    await expect(page.getByRole("switch", { name: "Bookings by email" })).not.toBeChecked();
    await expect(page.getByRole("switch", { name: "Messages by email" })).not.toBeChecked();
  });

  test("notifications: a failed save flips the switch back", async ({ page }) => {
    await page.route("**/rest/v1/user_profiles?*", (route) =>
      route.request().method() === "PATCH"
        ? route.fulfill({ status: 500, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ message: "boom" }) })
        : route.fallback()
    );
    await page.goto("/settings?tab=notifications");
    const bookings = page.getByRole("switch", { name: "Bookings by email" });
    await bookings.click();
    await expect(toast(page, "Couldn't save")).toBeVisible();
    await expect(bookings).toBeChecked();
  });

  test("privacy: hiding from the marketplace saves listed=false", async ({ page, backend }) => {
    await page.goto("/settings?tab=privacy");
    const listed = page.getByRole("switch", { name: "Show my profile on the marketplace" });
    await expect(listed).toBeChecked();
    await listed.click();
    await expect(toast(page, "Hidden from the marketplace. Families you invite can still book")).toBeVisible();
    expect(backend.writesTo("coaches", "PATCH")[0].body).toEqual({ listed: false });
    await listed.click();
    await expect(toast(page, "Your profile is on the marketplace")).toBeVisible();
    expect(backend.writesTo("coaches", "PATCH")[1].body).toEqual({ listed: true });
  });

  test("booking: offline payment turns on with methods and a note", async ({ page, backend }) => {
    await page.goto("/settings?tab=booking");
    const offline = page.getByRole("switch", { name: "Offline payment" });
    await expect(offline).not.toBeChecked();
    await afterSave(page, () => offline.click());
    await expect(toast(page, "Families can now choose to pay you directly")).toBeVisible();
    const first = backend.writesTo("coaches", "PATCH")[0].body as Record<string, unknown>;
    expect(first).toMatchObject({ pay_mode: "app", pay_note: null, offline_pay: { on: true, note: "", methods: { cash: { on: true, handle: "" } } } });

    // Each save refetches the coach and resets the form to it; let that land before typing.
    await afterSave(page, () => page.getByRole("checkbox", { name: "Venmo" }).check());
    await expect(page.getByText("Add your Venmo username so families know where to send it")).toBeVisible();
    const handle = page.getByRole("textbox", { name: "Venmo @username" });
    await afterSave(page, () => handle.fill("@casey-coach").then(() => handle.blur()));
    await expect(handle).toHaveValue("@casey-coach");
    await expect(page.getByText("Add your Venmo username")).toHaveCount(0);
    await expect.poll(() => backend.writesTo("coaches", "PATCH").length).toBe(3);
    expect(backend.writesTo("coaches", "PATCH")[2].body).toMatchObject({ offline_pay: { methods: { venmo: { on: true, handle: "@casey-coach" } } } });

    const note = page.getByLabel("Note for families (optional)");
    await note.fill("Please pay before the session starts");
    await note.blur();
    await expect(toast(page, "Saved")).toBeVisible();
    expect(backend.writesTo("coaches", "PATCH").at(-1)!.body).toMatchObject({ pay_note: "Please pay before the session starts", offline_pay: { note: "Please pay before the session starts" } });
  });

  test("password and account: deactivating needs the word, then shows the reactivate banner", async ({ page, backend }) => {
    await page.goto("/settings?tab=security");
    await page.getByRole("button", { name: "Deactivate account" }).click();
    const confirm = page.getByRole("button", { name: "Deactivate account" });
    await expect(confirm).toBeDisabled();
    await page.getByLabel("Type DEACTIVATE to confirm").fill("deactivate");
    await expect(confirm).toBeDisabled();
    await page.getByLabel("Type DEACTIVATE to confirm").fill("DEACTIVATE");
    await confirm.click();

    await expect(toast(page, "Account deactivated")).toBeVisible();
    expect(backend.writesTo("coaches", "PATCH")[0].body).toEqual({ deactivated_at: expect.any(String) });
    await expect.poll(() => backend.writesTo("account-emails").length).toBe(1);
    expect(backend.writesTo("account-emails")[0].body).toEqual({ event: "coach_deactivated" });

    await expect(page.getByText("Your account is deactivated.")).toBeVisible();
    await page.getByRole("button", { name: "Reactivate" }).click();
    await expect(toast(page, "Welcome back")).toBeVisible();
    expect(backend.writesTo("coaches", "PATCH")[1].body).toEqual({ deactivated_at: null });
    await expect(page.getByText("Your account is deactivated.")).toHaveCount(0);
  });

  test("password and account: sign out other devices", async ({ page, backend }) => {
    await page.goto("/settings?tab=security");
    await page.getByRole("button", { name: "Sign out other devices" }).click();
    await expect(toast(page, "Signed out of your other devices")).toBeVisible();
    expect(backend.writesTo("logout").at(-1)!.url).toContain("scope=others");
  });
});

test.describe("settings as a parent", () => {
  test.beforeEach(async ({ page, backend, as }) => {
    seedParentAthlete(backend);
    await as(page, "parent");
  });

  test("parent or guardian: edits name, relationship and phone", async ({ page, backend }) => {
    await page.goto("/settings");
    await expect(page.getByText("Ava's account, managed by Pat Parent. Edit anything right here.")).toBeVisible();
    await expect(tab(page, "Parent or guardian")).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Ava is under 18, so Pat Parent holds the account.", { exact: false })).toBeVisible();
    await expect(page.getByLabel("Full name")).toHaveValue("Pat Parent");
    await expect(page.getByLabel("Relationship")).toHaveValue("Parent");

    await page.getByLabel("Full name").fill(" ");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Required")).toBeVisible();

    await page.getByLabel("Full name").fill("Pat Patel");
    await page.getByLabel("Relationship").selectOption("Guardian");
    await page.getByLabel("Phone").fill("");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(toast(page, "Changes saved")).toBeVisible();
    const write = backend.writesTo("user_profiles", "PATCH").at(-1)!;
    expect(write.url).toContain(`id=eq.${IDS.parentUser}`);
    expect(write.body).toEqual({ name: "Pat Patel", phone_number: null, guardian_relationship: "Guardian" });
    expect(profileRow(backend, IDS.parentUser).guardian_relationship).toBe("Guardian");
  });

  test("second guardian: lists guardians, invites one, retries and removes", async ({ page, backend }) => {
    seedGuardians(backend);
    handleGuardianInvite(backend);
    await page.goto("/settings");
    const card = page.locator("section").filter({ has: page.getByRole("heading", { name: "Second guardian" }) });
    await expect(card.getByText("Jamie Patel")).toBeVisible();
    await expect(card.getByText("jamie@e2e.test · invite sent")).toBeVisible();
    await expect(card.getByText("robin@e2e.test · saved, email not sent")).toBeVisible();
    await expect(page.getByRole("switch", { name: "Send booking receipts to your second guardians too" })).toBeChecked();

    // Invite: validation first.
    await card.getByRole("button", { name: "Invite a guardian" }).click();
    const dialog = page.getByRole("dialog", { name: "Invite a guardian" });
    await expect(dialog.getByText("Pat Parent stays the account holder.", { exact: false })).toBeVisible();
    await dialog.getByRole("button", { name: "Send invite" }).click();
    await expect(dialog.getByText("Required")).toBeVisible();
    await expect(dialog.getByText("Enter a valid email")).toBeVisible();
    expect(backend.writesTo("athlete_guardians", "POST")).toHaveLength(0);

    await dialog.getByLabel("Full name").fill("Sam Rivera");
    await dialog.getByLabel("Email").fill(" Sam.Rivera@E2E.test ");
    await dialog.getByLabel("Relationship").selectOption("Other family member");
    await dialog.getByRole("button", { name: "Send invite" }).click();
    await expect(dialog).toBeHidden();
    await expect(toast(page, "Invite sent")).toBeVisible();
    const insert = backend.writesTo("athlete_guardians", "POST")[0];
    expect(insert.body).toEqual({ athlete_id: SETTINGS.parentAthlete, name: "Sam Rivera", email: "sam.rivera@e2e.test", relationship: "Other family member" });
    const newId = backend.table("athlete_guardians").find((g) => g.name === "Sam Rivera")!.id;
    expect(backend.writesTo("guardian-invite")[0].body).toEqual({ guardian_id: newId });
    await expect(card.getByText("sam.rivera@e2e.test · invite sent")).toBeVisible();

    // Retry the one whose email didn't send.
    const robin = card.locator("div").filter({ hasText: /^RPRobin Patel/ });
    await robin.getByRole("button", { name: "Try again" }).click();
    await expect(card.getByText("robin@e2e.test · invite sent")).toBeVisible();
    expect(backend.writesTo("guardian-invite").at(-1)!.body).toEqual({ guardian_id: SETTINGS.unsentGuardian });

    // Remove Jamie.
    const jamie = card.locator("div").filter({ hasText: /^JPJamie Patel/ });
    await jamie.getByRole("button", { name: "Remove" }).click();
    await expect(toast(page, "Guardian removed")).toBeVisible();
    expect(backend.writesTo("athlete_guardians", "DELETE")[0].url).toContain(`id=eq.${SETTINGS.invitedGuardian}`);
    await expect(card.getByText("Jamie Patel")).toHaveCount(0);
  });

  test("second guardian: an invite whose email fails is saved and says so", async ({ page, backend }) => {
    handleGuardianInvite(backend, false);
    await page.goto("/settings");
    const card = page.locator("section").filter({ has: page.getByRole("heading", { name: "Second guardian" }) });
    await card.getByRole("button", { name: "Invite a guardian" }).click();
    const dialog = page.getByRole("dialog", { name: "Invite a guardian" });
    await dialog.getByLabel("Full name").fill("Sam Rivera");
    await dialog.getByLabel("Email").fill("sam@e2e.test");
    await dialog.getByRole("button", { name: "Send invite" }).click();
    await expect(toast(page, "Guardian saved")).toBeVisible();
    await expect(card.getByText("sam@e2e.test · saved, email not sent")).toBeVisible();
    await expect(card.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("second guardian: receipts switch saves receipts_email", async ({ page, backend }) => {
    seedGuardians(backend);
    await page.goto("/settings");
    const receipts = page.getByRole("switch", { name: "Send booking receipts to your second guardians too" });
    await receipts.click();
    await expect(receipts).not.toBeChecked();
    await expect.poll(() => backend.writesTo("user_profiles", "PATCH").length).toBe(1);
    expect(backend.writesTo("user_profiles", "PATCH")[0].body).toEqual({ notification_prefs: { receipts_email: false } });
  });

  test("notifications: family email switches save", async ({ page, backend }) => {
    await page.goto("/settings");
    await tab(page, "Notifications").click();
    await expect(page).toHaveURL(/\?tab=notifications$/);
    const messages = page.getByRole("switch", { name: "Messages by email" });
    await expect(messages).toBeChecked();
    await messages.click();
    await expect.poll(() => backend.writesTo("user_profiles", "PATCH").length).toBe(1);
    expect(backend.writesTo("user_profiles", "PATCH")[0].body).toEqual({ notification_prefs: { message_email: false } });
  });

  test("privacy and safety: explains who sees Ava's profile", async ({ page }) => {
    await page.goto("/settings?tab=privacy");
    await expect(page.getByText("Ava's profile is visible only to you and Ava's coaches.", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download Ava's data (PDF)" })).toBeVisible();
  });

  test("password and account: requests deletion, then keeps the account", async ({ page, backend }) => {
    await page.goto("/settings?tab=security");
    const card = page.locator("section").filter({ has: page.getByRole("heading", { name: "Delete account" }) });
    await expect(card).toContainText("Deletes Ava's account and personal details 14 days after you ask");
    await card.getByRole("button", { name: "Delete account" }).click();
    const confirm = card.getByRole("button", { name: "Delete account" });
    await expect(confirm).toBeDisabled();
    await card.getByLabel("Type DELETE to confirm").fill("DELETE");
    await confirm.click();

    await expect(toast(page, "Account deletion scheduled")).toBeVisible();
    const write = backend.writesTo("user_profiles", "PATCH")[0];
    expect(write.url).toContain(`id=eq.${IDS.parentUser}`);
    expect(write.body).toEqual({ deletion_requested_at: expect.any(String) });
    await expect.poll(() => backend.writesTo("account-emails").length).toBe(1);
    expect(backend.writesTo("account-emails")[0].body).toEqual({ event: "deletion_requested" });

    // The banner shows on every signed-in page and the delete card is gone.
    await expect(page.getByText(/This account will be deleted on/)).toBeVisible();
    await expect(card).toHaveCount(0);
    await page.goto("/dashboard");
    await expect(page.getByText(/This account will be deleted on/)).toBeVisible();

    await page.getByRole("button", { name: "Keep my account" }).click();
    await expect(toast(page, "Your account is staying")).toBeVisible();
    expect(backend.writesTo("user_profiles", "PATCH").at(-1)!.body).toEqual({ deletion_requested_at: null });
    await expect.poll(() => backend.writesTo("account-emails").length).toBe(2);
    expect(backend.writesTo("account-emails")[1].body).toEqual({ event: "deletion_cancelled" });
    await expect(page.getByText(/This account will be deleted on/)).toHaveCount(0);
  });

  test("legal tab opens", async ({ page }) => {
    await page.goto("/settings");
    await tab(page, "Legal").click();
    await expect(page).toHaveURL(/\?tab=legal$/);
    await expect(page.getByRole("button", { name: /Terms of service/ })).toContainText("You accepted");
    await expect(page.getByRole("button", { name: /Privacy policy/ })).toBeVisible();
    // Coach-only agreements aren't listed for families.
    await expect(page.getByRole("button", { name: /Coach terms/ })).toHaveCount(0);
  });
});

test.describe("settings as an athlete", () => {
  test.beforeEach(async ({ page, as }) => {
    await as(page, "athlete");
  });

  test("account: no guardian card, and the name saves", async ({ page, backend }) => {
    await page.goto("/settings");
    await expect(page.getByText("Your account, notifications and privacy.")).toBeVisible();
    await expect(tab(page, "Account")).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "Second guardian" })).toHaveCount(0);
    await expect(page.getByLabel("Relationship")).toHaveCount(0);

    await page.getByLabel("Full name").fill("Alex Rivera");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(toast(page, "Changes saved")).toBeVisible();
    expect(backend.writesTo("user_profiles", "PATCH").at(-1)!.body).toEqual({ name: "Alex Rivera", phone_number: "+15555550100" });
  });

  test("password and account: the delete card speaks to the athlete", async ({ page }) => {
    await page.goto("/settings?tab=security");
    await expect(page.getByText("Deletes your account and personal details 14 days after you ask", { exact: false })).toBeVisible();
  });
});
