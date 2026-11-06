import { test, expect } from "./test";
import { MockError } from "./backend";
import { IDS, users } from "./personas";
import { expectNoSidewaysScroll, isPhone, settle } from "./helpers";
import { PARTNERSHIP_IDS, seedAdminEmail, seedContactInfo, seedPartnerships } from "./data/public";

// Help, Contact us, Resources (partnerships) and the payment-return page, Become a coach, the
// cookie banner and the offline banner.

test.describe("help", () => {
  test("coach: questions expand, tiles and search filter them", async ({ page, as }) => {
    await as(page, "coach");
    await page.goto("/help");
    await expect(page.getByRole("heading", { name: "Common questions" })).toBeVisible();

    const question = page.locator("details").filter({ hasText: "How do payouts and marketplace fees work?" });
    const answer = question.getByText(/Stripe deposits it to your bank/);
    await expect(answer).toBeHidden();
    await question.locator("summary").click();
    await expect(answer).toBeVisible();
    await question.locator("summary").click();
    await expect(answer).toBeHidden();

    await page.getByRole("button", { name: /Calendar and bookings/ }).click();
    await expect(page.getByRole("heading", { name: "Calendar and bookings" })).toBeVisible();
    await expect(page.locator("details")).toHaveCount(3);
    await expect(page.locator("details").first()).toContainText("How do I set my availability?");
    await page.getByRole("button", { name: "Show all" }).click();
    await expect(page.getByRole("heading", { name: "Common questions" })).toBeVisible();
    await expect(page.locator("details")).toHaveCount(9);

    await page.getByPlaceholder(/Search help/).fill("refund");
    await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
    await expect(page.locator("details").filter({ hasText: "How do refunds work?" })).toBeVisible();
    await page.getByPlaceholder(/Search help/).fill("zzzz no such thing");
    await expect(page.getByText("No articles match. Try different words or contact support.")).toBeVisible();
    await settle(page);
    await expectNoSidewaysScroll(page, "/help as coach");
  });

  test("athlete sees the family questions", async ({ page, as }) => {
    await as(page, "athlete");
    await page.goto("/help");
    await expect(page.getByText("Answers about booking, payments and your account")).toBeVisible();
    await expect(page.locator("details").filter({ hasText: "How do package credits work?" })).toBeVisible();
    await expect(page.getByText("How do payouts and marketplace fees work?")).toHaveCount(0);
  });

  test("Message support checks the form, then saves and emails the message", async ({ page, as, backend }) => {
    await as(page, "coach");
    await page.goto("/help");
    await page.getByRole("button", { name: "Message support" }).click();
    const dialog = page.getByRole("dialog", { name: "Message support" });
    await expect(dialog.getByText(`We reply by email to ${users.coach.email}.`)).toBeVisible();

    await dialog.getByRole("button", { name: "Send" }).click();
    await expect(dialog.getByText("Choose a topic", { exact: true }).last()).toBeVisible();
    await expect(dialog.getByText("Tell us a bit more")).toBeVisible();
    expect(backend.writesTo("contact_submissions")).toHaveLength(0);

    await dialog.getByRole("combobox").selectOption("Payouts");
    await dialog.getByRole("textbox").fill("My payout for last week has not arrived yet.");
    await dialog.getByRole("button", { name: "Send" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Message sent").first()).toBeVisible();

    const [insert] = backend.writesTo("contact_submissions", "POST");
    expect(insert.body).toEqual([
      { full_name: "Casey Coach", email: users.coach.email, subject: "Payouts", message: "My payout for last week has not arrived yet.", user_id: IDS.coachUser, status: "new" },
    ]);
    expect(backend.writesTo("send-email").at(-1)?.body).toMatchObject({ kind: "contact", name: "Casey Coach", email: users.coach.email, topic: "Payouts" });
  });

  test("Message support says so when sending fails", async ({ page, as, backend }) => {
    await as(page, "parent");
    backend.functions["send-email"] = new MockError("mail is down", 500);
    await page.goto("/help");
    await page.getByRole("button", { name: "Message support" }).click();
    const dialog = page.getByRole("dialog", { name: "Message support" });
    await dialog.getByRole("combobox").selectOption("A booking");
    await dialog.getByRole("textbox").fill("I can't find my booking from Saturday.");
    await dialog.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("That didn't send. Try again").first()).toBeVisible();
    await expect(dialog).toBeVisible();
  });
});

test.describe("contact us", () => {
  test("shows the contact details from the database", async ({ page, backend }) => {
    seedContactInfo(backend);
    await page.goto("/contact");
    await expect(page.getByRole("heading", { name: "Get in touch" })).toBeVisible();
    await expect(page.getByText("hello@e2e.test")).toBeVisible();
    await expect(page.getByText("Austin, TX")).toBeVisible();
    // The phone line is hidden until calls are staffed.
    await expect(page.getByText("+1 555 555 0199")).toHaveCount(0);
    await settle(page);
    await expectNoSidewaysScroll(page, "/contact");
  });

  test("checks each field before sending", async ({ page, backend }) => {
    await page.goto("/contact");
    await page.getByLabel("Full name").fill("J");
    await page.getByLabel("Email address").fill("jo@e2e.test");
    await page.getByLabel("Subject").fill("Hi");
    await page.getByRole("textbox", { name: /^Message/ }).fill("Too short");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Name must be at least 2 characters")).toBeVisible();
    await expect(page.getByText("Subject must be at least 3 characters")).toBeVisible();
    await expect(page.getByText("Message must be at least 10 characters")).toBeVisible();
    await expect(page.getByText("Check the form").first()).toBeVisible();
    expect(backend.writesTo("contact_submissions")).toHaveLength(0);
    expect(backend.writesTo("send-email")).toHaveLength(0);

    await page.getByLabel("Full name").fill("Jo 99");
    await page.getByLabel("Subject").fill("A question");
    await page.getByRole("textbox", { name: /^Message/ }).fill("A long enough message here.");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Name can only contain letters, spaces, hyphens, apostrophes, and periods")).toBeVisible();
    expect(backend.writesTo("contact_submissions")).toHaveLength(0);
  });

  // The field errors come from useContactSubmission and stay until the next submit, so
  // ContactForm hides a field's error once that field is edited (issue #4, bug 14).
  test("a field's error clears once the visitor edits it", async ({ page }) => {
    await page.goto("/contact");
    await page.getByLabel("Full name").fill("J");
    await page.getByLabel("Email address").fill("jo@e2e.test");
    await page.getByLabel("Subject").fill("A question");
    await page.getByRole("textbox", { name: /^Message/ }).fill("A long enough message here.");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Name must be at least 2 characters")).toBeVisible();
    await page.getByLabel("Full name").fill("Jo Smith");
    await expect(page.getByText("Name must be at least 2 characters")).toBeHidden();
  });

  test("sends a valid message, saves it and emails support, then throttles a repeat", async ({ page, backend }) => {
    await page.goto("/contact");
    await page.getByLabel("Full name").fill("Jo O'Neil");
    await page.getByLabel("Email address").fill("Jo@E2E.test");
    await page.getByLabel("Subject").fill("Group sessions?");
    await page.getByRole("textbox", { name: /^Message/ }).fill("Do you run group sessions for 12 year olds?");
    await expect(page.getByText("43/2000")).toBeVisible();
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Thank you for contacting us. We'll get back to you within 24 hours.").first()).toBeVisible();
    await expect(page.getByLabel("Full name")).toHaveValue("");
    await expect(page.getByRole("textbox", { name: /^Message/ })).toHaveValue("");

    const [insert] = backend.writesTo("contact_submissions", "POST");
    // Saved escaped, with no user for a signed-out visitor.
    expect(insert.body).toEqual([
      { full_name: "Jo O&#x27;Neil", email: "jo@e2e.test", subject: "Group sessions?", message: "Do you run group sessions for 12 year olds?", user_id: null, status: "new" },
    ]);
    expect(backend.writesTo("send-email")[0].body).toEqual({ kind: "contact", name: "Jo O'Neil", email: "jo@e2e.test", topic: "Group sessions?", message: "Do you run group sessions for 12 year olds?" });

    // A second message within five minutes is held back.
    await page.getByLabel("Full name").fill("Jo O'Neil");
    await page.getByLabel("Email address").fill("jo@e2e.test");
    await page.getByLabel("Subject").fill("One more thing");
    await page.getByRole("textbox", { name: /^Message/ }).fill("Also, do you coach goalkeepers?");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Too many requests").first()).toBeVisible();
    expect(backend.writesTo("contact_submissions")).toHaveLength(1);
  });

  test("keeps the form when the notification email fails", async ({ page, backend }) => {
    backend.functions["send-email"] = new MockError("mail is down", 500);
    await page.goto("/contact");
    await page.getByLabel("Full name").fill("Jo Smith");
    await page.getByLabel("Email address").fill("jo@e2e.test");
    await page.getByLabel("Subject").fill("A question");
    await page.getByRole("textbox", { name: /^Message/ }).fill("A long enough message here.");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Message received").first()).toBeVisible();
    expect(backend.writesTo("contact_submissions")).toHaveLength(1);
    await expect(page.getByLabel("Full name")).toHaveValue("Jo Smith");
  });
});

test.describe("resources (partnerships)", () => {
  test("lists resources, filters by sport and previews one", async ({ page, backend }) => {
    seedPartnerships(backend);
    await page.goto("/partnerships");
    await expect(page.getByText("Match Video Analysis")).toBeVisible();
    await expect(page.getByText("Erg Training Plans")).toBeVisible();
    await expect(page.getByText("$49.00")).toBeVisible();
    await expect(page.getByRole("button", { name: "Get Updates" })).toBeDisabled();

    await page.getByRole("button", { name: "Rowing" }).click();
    await expect(page.getByText("Match Video Analysis")).toHaveCount(0);
    await expect(page.getByText("Erg Training Plans")).toBeVisible();
    await page.getByRole("button", { name: "All Sports" }).click();

    await page.getByText("Match Video Analysis").click();
    const dialog = page.getByRole("dialog", { name: "Match Video Analysis" });
    await expect(dialog.getByText("An analyst reviews a full match and sends back clips with notes.")).toBeVisible();
    await expect(dialog.getByText("Tagged clips")).toBeVisible();
    await expect(dialog.getByText("See your decisions on film")).toBeVisible();
    await dialog.getByRole("button", { name: "Close" }).first().click();
    await expect(dialog).toBeHidden();
    await settle(page);
    await expectNoSidewaysScroll(page, "/partnerships");
  });

  test("Purchase Now sends visitors to sign in", async ({ page, backend }) => {
    seedPartnerships(backend);
    await page.goto("/partnerships");
    await page.getByRole("button", { name: "Purchase Now" }).click();
    await expect(page).toHaveURL(/\/auth/);
    expect(backend.writesTo("create-partnership-payment")).toHaveLength(0);
  });

  test("Purchase Now starts checkout for a signed-in parent", async ({ page, as, backend }) => {
    await as(page, "parent");
    seedPartnerships(backend);
    backend.functions["create-partnership-payment"] = { url: "https://checkout.stripe.test/pay/cs_test_partner" };
    await page.goto("/partnerships");
    await page.getByRole("button", { name: "Purchase Now" }).click();
    await expect(page).toHaveURL("https://checkout.stripe.test/pay/cs_test_partner");
    expect(backend.writesTo("create-partnership-payment")[0].body).toEqual({ partnershipId: PARTNERSHIP_IDS.video });
  });

  test("the inquiry form saves the inquiry and emails the team", async ({ page, backend }) => {
    await page.goto("/partnerships");
    await page.getByLabel("Name").fill("Sam Supplier");
    await page.getByLabel("Organization").fill("Fit Labs");
    await page.getByLabel("Email").fill("Sam@FitLabs.test");
    await page.getByLabel("What resource would you like to offer?").fill("Strength plans built for youth rowers.");
    await page.getByRole("button", { name: "Submit Inquiry" }).click();
    await expect(page.getByText("Inquiry Submitted!").first()).toBeVisible();
    await expect(page.getByLabel("Name")).toHaveValue("");

    expect(backend.writesTo("partnership_inquiries", "POST")[0].body).toEqual({
      name: "Sam Supplier",
      organization: "Fit Labs",
      email: "sam@fitlabs.test",
      partnership_interest: "Strength plans built for youth rowers.",
    });
    expect(backend.writesTo("send-email")[0].body).toMatchObject({ kind: "partnership", name: "Sam Supplier", organization: "Fit Labs", email: "sam@fitlabs.test" });
  });

  test("the inquiry form rejects a message that is too short", async ({ page, backend }) => {
    await page.goto("/partnerships");
    await page.getByLabel("Name").fill("Sam Supplier");
    await page.getByLabel("Organization").fill("Fit Labs");
    await page.getByLabel("Email").fill("sam@fitlabs.test");
    await page.getByLabel("What resource would you like to offer?").fill("Plans");
    await page.getByRole("button", { name: "Submit Inquiry" }).click();
    await expect(page.getByText("Validation Error").first()).toBeVisible();
    expect(backend.writesTo("partnership_inquiries")).toHaveLength(0);
    await expect(page.getByLabel("Name")).toHaveValue("Sam Supplier");
  });
});

test.describe("partnership payment return", () => {
  test("confirms a reconciled payment", async ({ page, backend }) => {
    backend.functions["reconcile-partnership-payment"] = { state: "reconciled" };
    await page.goto("/partnership-success?session_id=cs_test_partner");
    await expect(page.getByRole("heading", { name: "Payment Confirmed" })).toBeVisible();
    await expect(page.getByText("Payment confirmed! Your partnership resource is ready.")).toBeVisible();
    expect(backend.writesTo("reconcile-partnership-payment")[0].body).toEqual({ session_id: "cs_test_partner" });
    await page.getByRole("link", { name: "View More Partnerships" }).click();
    await expect(page).toHaveURL(/\/partnerships$/);
  });

  test("retries while the payment is still processing", async ({ page, backend }) => {
    let calls = 0;
    backend.functions["reconcile-partnership-payment"] = () => {
      calls += 1;
      return { state: calls < 2 ? "pending" : "reconciled" };
    };
    await page.goto("/partnership-success?session_id=cs_test_slow");
    await expect(page.getByRole("heading", { name: "Payment Confirmed" })).toBeVisible();
    expect(calls).toBe(2);
  });

  test("a failed check offers Retry verification", async ({ page, backend }) => {
    backend.functions["reconcile-partnership-payment"] = new MockError("Session not found", 404);
    await page.goto("/partnership-success?session_id=cs_test_bad");
    await expect(page.getByRole("heading", { name: "Verification Issue" })).toBeVisible();
    backend.functions["reconcile-partnership-payment"] = { state: "reconciled" };
    await page.getByRole("button", { name: "Retry verification" }).click();
    await expect(page.getByRole("heading", { name: "Payment Confirmed" })).toBeVisible();
    expect(backend.writesTo("reconcile-partnership-payment")).toHaveLength(2);
  });
});

test.describe("become a coach", () => {
  test("visitors are sent to sign up as a coach", async ({ page }) => {
    await page.goto("/become-a-coach");
    await page.getByRole("button", { name: "Learn more" }).click();
    await expect(page.locator("#requirements")).toBeInViewport();
    await page.getByRole("button", { name: "Apply to become a coach" }).click();
    await expect(page).toHaveURL(/\/auth\?mode=signup&persona=coach$/);
  });

  test("coaches go to their profile", async ({ page, as }) => {
    await as(page, "coach");
    await page.goto("/become-a-coach");
    await page.getByRole("button", { name: "Go to Profile" }).click();
    await expect(page).toHaveURL(/\/profile$/);
  });

  test("parents can't apply and are told who to email", async ({ page, as, backend }) => {
    await as(page, "parent");
    seedAdminEmail(backend);
    await page.goto("/become-a-coach");
    await expect(page.getByRole("button", { name: "Apply to become a coach" })).toBeDisabled();
    await expect(page.getByRole("link", { name: "coaches@e2e.test" })).toHaveAttribute("href", "mailto:coaches@e2e.test");
  });
});

test.describe("cookie banner", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  const banner = (page: import("@playwright/test").Page) => page.getByRole("region", { name: "Cookies" });
  const stored = (page: import("@playwright/test").Page) => page.evaluate(() => localStorage.getItem("athanext-cookie-consent"));
  const consentCookie = async (page: import("@playwright/test").Page) => (await page.context().cookies()).find((c) => c.name === "an_cookie_consent")?.value;

  test("Only essential is remembered across reloads", async ({ page }) => {
    await page.goto("/");
    await expect(banner(page)).toBeVisible();
    await expect(banner(page).getByRole("link", { name: "Privacy policy" })).toBeVisible();
    await banner(page).getByRole("button", { name: "Only essential" }).click();
    await expect(banner(page)).toBeHidden();
    expect(await stored(page)).toBe("essential");
    expect(await consentCookie(page)).toBe("essential");
    await page.reload();
    await expect(page.getByText(/welcome back/i).first()).toBeVisible();
    await expect(banner(page)).toBeHidden();
  });

  test("Accept all is remembered across pages", async ({ page }) => {
    await page.goto("/contact");
    await banner(page).getByRole("button", { name: "Accept all" }).click();
    await expect(banner(page)).toBeHidden();
    expect(await stored(page)).toBe("all");
    expect(await consentCookie(page)).toBe("all");
    await page.goto("/partnerships");
    await expect(page.getByText("Resource Marketplace")).toBeVisible();
    await expect(banner(page)).toBeHidden();
  });

  test("Cookie settings in the account menu brings it back to change the answer", async ({ page, as }) => {
    await as(page, "coach");
    await page.goto("/help");
    await banner(page).getByRole("button", { name: "Only essential" }).click();
    await expect(banner(page)).toBeHidden();
    await page.getByRole("button", { name: "Account menu" }).filter({ visible: true }).first().click();
    await page.getByRole("button", { name: "Cookie settings" }).click();
    await expect(banner(page)).toBeVisible();
    // The account menu stays open over the banner (see the fixme below); close it first.
    await page.keyboard.press("Escape");
    await banner(page).getByRole("button", { name: "Accept all" }).click();
    await expect(banner(page)).toBeHidden();
    expect(await stored(page)).toBe("all");
    expect(await consentCookie(page)).toBe("all");
  });

  // "Cookie settings" is a plain button in the account menu's footer, not a menu item, so
  // UserMenu closes the menu itself. Left open, the modal menu blocks pointer events on the
  // banner it just brought back (issue #4, bug 15).
  test("Cookie settings closes the account menu so the banner can be answered at once", async ({ page, as }) => {
    await as(page, "coach");
    await page.goto("/help");
    await banner(page).getByRole("button", { name: "Only essential" }).click();
    await page.getByRole("button", { name: "Account menu" }).filter({ visible: true }).first().click();
    await page.getByRole("button", { name: "Cookie settings" }).click();
    await expect(page.getByRole("menu")).toBeHidden();
    await banner(page).getByRole("button", { name: "Accept all" }).click({ timeout: 5_000 });
    expect(await stored(page)).toBe("all");
  });
});

test.describe("network status", () => {
  test("shows an offline banner and hides it when the network is back", async ({ page, context }) => {
    await page.goto("/contact");
    await expect(page.getByRole("heading", { name: "Get in touch" })).toBeVisible();
    const offline = page.getByText(isPhone(page) ? "Offline, reconnecting…" : "You’re offline. We’ll reconnect when your network is back.");
    await expect(offline).toBeHidden();
    await context.setOffline(true);
    await expect(offline).toBeVisible();
    await context.setOffline(false);
    await expect(offline).toBeHidden();
  });
});
