import fs from "node:fs";
import type { Page } from "@playwright/test";
import { test, expect } from "./test";
import { MockError } from "./backend";
import { IDS } from "./personas";
import { isPhone } from "./helpers";
import { ROSTER, dayFromToday } from "./data/athletes";
import { BILLING, MONEY, seedAnalytics, seedBusiness, seedCoachBilling, seedFamilyInvoice, seedFeeConfig, seedPayments, seedStripePayouts, ALEX_HOME } from "./data/business";

// Casey Coach's money: My Business (/business) with the payments summary, camp money and offline
// payments; Money in and invoices (/payments); payouts and the coach plan in settings; the coach
// plan lock; and a parent paying an invoice (/invoices/:id), plus the parent's Account page.

const shortDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

test.describe("my business", () => {
  test.beforeEach(async ({ page, backend, as }) => {
    seedBusiness(backend);
    await as(page, "coach");
  });

  test("shows the profile card, money owed, the next payout and the overdue count", async ({ page }) => {
    await page.goto("/business");
    await expect(page.getByRole("heading", { name: "My Business" })).toBeVisible();
    await expect(page.getByText("Casey Coach", { exact: true }).last()).toBeVisible();
    await expect(page.getByText("Midfield · Central Park")).toBeVisible();
    await expect(page.getByRole("link", { name: "View profile" })).toHaveAttribute("href", "/profile");
    await expect(page.getByRole("link", { name: "Edit profile" })).toHaveAttribute("href", "/profile?mode=edit");

    // The soonest pending or in-transit payout, not the later one or the one already paid.
    const payments = page.getByRole("link", { name: /^Payments/ });
    const next = new Date(Date.now() + 2 * 86_400_000).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    await expect(payments).toContainText(`Paid in app: $240 owed · payout ${next}`);
    await expect(payments.getByText("1 overdue")).toBeVisible();
    await expect(page.getByRole("link", { name: /^My organization/ })).toContainText("By invitation from AthaNext");
  });

  test("shows camp money from registrations", async ({ page }) => {
    await page.goto("/business");
    const camps = page.getByRole("region", { name: "Camps" });
    await expect(camps.getByText("3 registrations this month")).toBeVisible();
    await expect(camps.getByText("Paid in app").locator("..")).toContainText("$250");
    await expect(camps.getByText("Paid to you directly").locator("..")).toContainText("$200");
    await expect(camps.getByText("Still to collect").locator("..")).toContainText("$150");
    await expect(camps.getByText("1 family", { exact: true })).toBeVisible();
  });

  test("lists offline payments and confirms one as paid", async ({ page, backend }) => {
    await page.goto("/business");
    const offline = page.getByRole("region", { name: "Offline payments" });
    await expect(offline.getByText("Paid to you directly this month").locator("..")).toContainText("$120");
    await expect(offline.getByText("Paid to you directly, all time").locator("..")).toContainText("$480");
    const waiting = offline.getByText("Waiting for payment").locator("..");
    await expect(waiting.getByRole("link", { name: /Dana Carter for Ben/ })).toHaveAttribute("href", `/sessions/${MONEY.waitingOccurrence}`);
    await expect(waiting).toContainText(`Speed session, ${shortDate(dayFromToday(-2))}, session done`);
    await expect(waiting).toContainText("$60");
    await expect(offline.getByText("Latest offline payments").locator("..")).toContainText("Leo Park");
    await expect(offline.getByText("Latest offline payments").locator("..").getByText("Camp", { exact: true })).toBeVisible();

    await waiting.getByRole("button", { name: "Mark as paid" }).click();
    await expect(page.getByText("Marked as paid", { exact: true }).first()).toBeVisible();
    expect(backend.writesTo("confirm_offline_payment")[0].body).toEqual({ p_booking_id: MONEY.waitingBooking });
  });

  // offlinePayAPI.confirm throws the supabase-js error, a plain { code, message, details, hint }
  // object, not an Error; markPaidError() still reads its message.
  test("a plan-ended error on Mark as paid links to Plan settings", async ({ page, backend }) => {
    backend.rpc.confirm_offline_payment = new MockError("Your free plan has ended", 400);
    await page.goto("/business");
    await page.getByRole("region", { name: "Offline payments" }).getByRole("button", { name: "Mark as paid" }).click();
    await expect(page.getByText("Subscribe in Plan settings to mark payments as paid.").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Plan settings" })).toHaveAttribute("href", "/settings?tab=plan");
  });

  test("booking-only coaches see that families pay them directly", async ({ page, backend }) => {
    backend.table("coaches")[0].pay_mode = "self";
    await page.goto("/business");
    await expect(page.getByRole("link", { name: /^Payments/ })).toContainText("Booking only. Families pay you directly");
    await expect(page.getByText("1 overdue")).toHaveCount(0);
  });

  test("an organization owner sees their organization", async ({ page, backend }) => {
    const { seedOrganization } = await import("./data/organization");
    seedOrganization(backend);
    await page.goto("/business");
    const row = page.getByRole("link", { name: /^My organization/ });
    await expect(row).toContainText("E2E Rowing Club · 2 coaches");
    await row.click();
    await expect(page).toHaveURL(/\/organization$/);
  });
});

/** The invoice table on desktop, the accordion rows on phone. */
const invoiceRow = (page: Page, family: string, hasText?: string) =>
  (isPhone(page) ? page.getByRole("button", { name: new RegExp(`^${family}`) }) : page.getByRole("row", { name: new RegExp(family) })).filter({ hasText });

test.describe("money in and invoices", () => {
  test.beforeEach(async ({ page, backend, as }) => {
    seedPayments(backend);
    await as(page, "coach");
  });

  test("totals money in for 30 days, split by where it came from", async ({ page }) => {
    await page.goto("/payments");
    await expect(page.getByText("Money in and invoices")).toBeVisible();
    // $80 own client + $100 marketplace + $60 paid directly + $15 gear (+ the $60 paid invoice).
    await expect(page.getByText("$315", { exact: true })).toBeVisible();
    await expect(page.getByText("+271% vs previous 30 days")).toBeVisible();
    await expect(page.getByText("Your clients, no fee").locator("..")).toContainText("$140");
    await expect(page.getByText("Marketplace", { exact: true }).locator("..")).toContainText("$100");
    await expect(page.getByText("Paid to you directly", { exact: true }).locator("..")).toContainText("$60");
    await expect(page.getByText("Gear and deals").locator("..")).toContainText("$15");

    // One day: only yesterday's... nothing today.
    await page.getByRole("group", { name: "Period" }).getByRole("button", { name: "1D" }).click();
    await expect(page.getByText("No money in for this period yet.")).toBeVisible();
    await page.getByRole("group", { name: "Period" }).getByRole("button", { name: "7D" }).click();
    await expect(page.getByText("$255", { exact: true })).toBeVisible();
    await page.getByRole("group", { name: "Chart" }).getByRole("button", { name: "Bar" }).click();
    await expect(page.getByRole("group", { name: "Chart" }).getByRole("button", { name: "Bar" })).toHaveAttribute("aria-pressed", "true");
  });

  test("custom range adds up only the days picked", async ({ page }) => {
    await page.goto("/payments");
    await page.getByRole("group", { name: "Period" }).getByRole("button", { name: "Custom" }).click();
    await page.getByLabel("From", { exact: true }).fill(dayFromToday(-3));
    await page.getByLabel("To", { exact: true }).fill(dayFromToday(-1));
    // $100 package (3 days ago), $15 gear (2 days ago), $80 session (yesterday).
    await expect(page.getByText("$195", { exact: true })).toBeVisible();
  });

  test("lists invoices and payments, filters and searches them", async ({ page }) => {
    await page.goto("/payments");
    const toggle = page.getByRole("button", { name: /^Invoices/ });
    await expect(toggle).toContainText("2 outstanding · $210 due");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    await expect(invoiceRow(page, "Dana Carter").first()).toContainText("Overdue");
    await expect(invoiceRow(page, "Liz King")).toContainText("Paid in app");
    if (!isPhone(page)) {
      await expect(page.getByRole("row", { name: /Speed session/ })).toContainText("Paid directly");
      await expect(page.getByRole("row", { name: /Individual session/ })).toContainText("Pending");
    }

    const show = page.getByRole("group", { name: "Show" });
    await show.getByRole("button", { name: "Outstanding 2" }).click();
    await expect(invoiceRow(page, "Liz King")).toHaveCount(0);
    await expect(invoiceRow(page, "Maria Martinez")).toHaveCount(1);

    await show.getByRole("button", { name: "All" }).click();
    await page.getByPlaceholder("Search families").fill("king");
    await expect(invoiceRow(page, "Liz King")).toHaveCount(1);
    await expect(invoiceRow(page, "Dana Carter")).toHaveCount(0);
    await page.getByPlaceholder("Search families").fill("nobody");
    await expect(page.getByText("No invoices here.")).toBeVisible();
  });

  test("sends a reminder for an open invoice", async ({ page, backend }) => {
    await page.goto("/payments");
    await page.getByRole("button", { name: /^Invoices/ }).click();
    await page.getByRole("group", { name: "Show" }).getByRole("button", { name: "Outstanding 2" }).click();
    if (isPhone(page)) {
      await invoiceRow(page, "Maria Martinez").click();
      await page.getByRole("button", { name: "Send reminder" }).click();
    } else {
      await page.getByRole("row", { name: /Maria Martinez/ }).getByRole("button", { name: "Remind" }).click();
    }
    await expect(page.getByText("Reminder 2 of 3 sent to Maria Martinez").first()).toBeVisible();
    expect(backend.writesTo("coach-invoices").at(-1)!.body).toMatchObject({ action: "remind", invoice_id: MONEY.openInvoice });
  });

  test("marks an invoice paid outside AthaNext", async ({ page, backend }) => {
    await page.goto("/payments");
    await page.getByRole("button", { name: /^Invoices/ }).click();
    if (isPhone(page)) {
      await invoiceRow(page, "Dana Carter", "Overdue").click();
      await page.getByRole("button", { name: "Mark as paid" }).click();
    } else {
      await invoiceRow(page, "Dana Carter", "Overdue").getByRole("button", { name: "Mark as paid" }).click();
    }
    const dialog = page.getByRole("dialog", { name: "Mark as paid?" });
    await expect(dialog).toContainText("Use this when Dana Carter paid you $90 outside AthaNext");
    await dialog.getByRole("button", { name: "Mark as paid" }).click();
    await expect(page.getByText("Dana Carter's invoice marked as paid").first()).toBeVisible();
    expect(backend.writesTo("mark_coach_invoice_paid")[0].body).toEqual({ p_invoice_id: MONEY.overdueInvoice });
  });

  test("creates an invoice: validates, then sends it to coach-invoices", async ({ page, backend }) => {
    await page.goto("/payments");
    await page.getByRole("button", { name: "Create invoice" }).click();
    const dialog = page.getByRole("dialog", { name: "Create invoice" });
    await dialog.getByLabel("Amount").fill("0");
    await dialog.getByRole("button", { name: "Send invoice" }).click();
    await expect(dialog.getByText("Choose an athlete")).toHaveCount(2);
    await expect(dialog.getByText("Enter an amount")).toBeVisible();
    expect(backend.writesTo("coach-invoices")).toHaveLength(0);

    await expect(dialog.getByLabel("Athlete").locator("option")).toHaveText(["Choose an athlete", "Ava Martinez, Maria Martinez", "Ben Carter, Dana Carter"]);
    await dialog.getByLabel("Athlete").selectOption(ROSTER.ava);
    await dialog.getByLabel("For").fill("Session package");
    await dialog.getByLabel("Amount").fill("320");
    await dialog.getByLabel("Due date").fill(dayFromToday(14));
    await dialog.getByLabel("Note to the family (optional)").fill("Four sessions in October.");
    await dialog.getByRole("button", { name: "Send invoice" }).click();
    await expect(page.getByText("Invoice sent to Maria Martinez").first()).toBeVisible();
    await expect(dialog).toBeHidden();
    expect(backend.writesTo("coach-invoices")[0].body).toEqual({
      origin: "http://localhost:5199",
      action: "create",
      athlete_id: ROSTER.ava,
      service: "Session package",
      amount: 320,
      due: dayFromToday(14),
      note: "Four sessions in October.",
    });
  });

  test("exports the shown rows as CSV", async ({ page }) => {
    await page.goto("/payments");
    await expect(page.getByRole("button", { name: "Export CSV" })).toBeEnabled();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe(`athanext-payments-${dayFromToday(0)}.csv`);
    const csv = fs.readFileSync((await file.path())!, "utf8");
    // A header and 7 rows: 3 invoices and 4 payments (the paid invoice is listed once).
    expect(csv.split("\n")).toHaveLength(8);
    expect(csv).toContain("Liz King");
    expect(csv).toContain("Overdue");
    await expect(page.getByText("CSV downloaded").first()).toBeVisible();
  });

  test("booking-only coaches see the banner", async ({ page, backend }) => {
    backend.table("coaches")[0].pay_mode = "self";
    await page.goto("/payments");
    await expect(page.getByText("Booking only is on. New bookings are paid to you directly, outside AthaNext. Past payments stay here.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Change" })).toHaveAttribute("href", "/settings?tab=booking");
  });
});

test.describe("payouts and plan in settings", () => {
  test.beforeEach(async ({ page, as }) => {
    await as(page, "coach");
  });

  test("Set up payouts asks stripe-payouts for an onboarding link and goes there", async ({ page, backend }) => {
    seedStripePayouts(backend, { connected: false });
    await page.goto("/settings?tab=booking");
    await page.getByRole("button", { name: "Set up payouts" }).click();
    await page.waitForURL(MONEY.stripeOnboard);
    const call = backend.writesTo("stripe-payouts").find((w) => (w.body as { action: string }).action === "onboard")!;
    expect(call.body).toEqual({ action: "onboard", origin: "http://localhost:5199" });
  });

  test("a coach who started setup can finish it", async ({ page, backend }) => {
    seedStripePayouts(backend, { connected: true, details_submitted: false });
    await page.goto("/settings?tab=booking");
    await expect(page.getByText("Finish setting up with Stripe. Payments for paid sessions wait here until you do.")).toBeVisible();
    await page.getByRole("button", { name: "Finish setting up" }).click();
    await page.waitForURL(MONEY.stripeOnboard);
  });

  test("connected payouts show the bank and open the Stripe dashboard", async ({ page, backend }) => {
    seedStripePayouts(backend);
    await page.goto("/settings?tab=booking");
    await expect(page.getByText(/Payouts are on to the account ending 6789/)).toBeVisible();
    await page.getByRole("button", { name: "Open Stripe dashboard" }).click();
    await page.waitForURL(MONEY.stripeDashboard);
    expect(backend.writesTo("stripe-payouts").some((w) => (w.body as { action: string }).action === "dashboard")).toBe(true);
  });

  test("a Stripe error stays on the page with a message", async ({ page, backend }) => {
    backend.functions["stripe-payouts"] = (body: unknown) =>
      (body as { action: string }).action === "onboard" ? new MockError("Stripe is unavailable", 502) : { account: { connected: false } };
    await page.goto("/settings?tab=booking");
    await page.getByRole("button", { name: "Set up payouts" }).click();
    await expect(page.getByText("Couldn't open Stripe").first()).toBeVisible();
    await expect(page.getByText("Stripe is unavailable").first()).toBeVisible();
    await expect(page).toHaveURL(/\/settings\?tab=booking$/);
    await expect(page.getByRole("button", { name: "Set up payouts" })).toBeEnabled();
  });

  test("trial: days left and Subscribe opens Checkout", async ({ page, backend }) => {
    seedCoachBilling(backend, BILLING.trial);
    await page.goto("/settings?tab=plan");
    await expect(page.getByText(/12 days left \(ends /)).toBeVisible();
    await page.getByRole("button", { name: "Subscribe · $29/mo" }).click();
    await page.waitForURL(MONEY.checkout);
    const call = backend.writesTo("coach-billing").find((w) => (w.body as { action: string }).action === "checkout")!;
    expect(call.body).toEqual({ action: "checkout", origin: "http://localhost:5199" });
  });

  test("subscribed: Manage billing opens the Stripe portal", async ({ page, backend }) => {
    seedCoachBilling(backend, BILLING.subscribed);
    await page.goto("/settings?tab=plan");
    await expect(page.getByText(/You're on the AthaNext coach plan at \$29\/month\. Status: active\./)).toBeVisible();
    await page.getByRole("button", { name: "Manage billing" }).click();
    await page.waitForURL(MONEY.portal);
  });

  test("coming back from Checkout says so and clears the flag", async ({ page, backend }) => {
    seedCoachBilling(backend, BILLING.subscribed);
    await page.goto("/settings?tab=plan&billing=success");
    await expect(page.getByText("You're on the coach plan", { exact: true }).first()).toBeVisible();
    await expect(page).toHaveURL(/\/settings\?tab=plan$/);
  });
});

test.describe("coach plan lock", () => {
  test.beforeEach(async ({ page, backend, as }) => {
    seedCoachBilling(backend, BILLING.locked);
    await as(page, "coach");
  });

  test("locks coach tools after the trial and Subscribe opens Checkout", async ({ page, backend }) => {
    await page.goto("/business");
    await expect(page.getByRole("heading", { name: "Your free plan has ended" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "My Business" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Plan settings" })).toHaveAttribute("href", "/settings?tab=plan");
    await page.getByRole("button", { name: "Subscribe · $29/mo" }).click();
    await page.waitForURL(MONEY.checkout);
    expect(backend.writesTo("coach-billing").some((w) => (w.body as { action: string }).action === "checkout")).toBe(true);
  });

  test("athletes and payments are locked too, settings and home are not", async ({ page }) => {
    for (const path of ["/athletes", "/payments"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "Your free plan has ended" })).toBeVisible();
    }
    await page.goto("/settings?tab=plan");
    await expect(page.getByText(/Your free plan ended on /)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your free plan has ended" })).toHaveCount(0);
  });
});

test.describe("an invoice for a parent", () => {
  test.beforeEach(async ({ backend }) => {
    seedFeeConfig(backend);
  });

  test("shows the invoice with card processing and pays it on Stripe", async ({ page, backend, as }) => {
    seedFamilyInvoice(backend);
    seedPayments(backend);
    await as(page, "parent");
    await page.goto(`/invoices/${IDS.invoice}`);
    await expect(page.getByRole("heading", { name: "Invoice from Casey Coach" })).toBeVisible();
    const due = new Date(`${dayFromToday(7)}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    await expect(page.getByText(`Due ${due}`)).toBeVisible();
    await expect(page.getByText("Individual session")).toBeVisible();
    await expect(page.getByText("Alex Athlete")).toBeVisible();
    await expect(page.getByText("Thanks for a great month!")).toBeVisible();
    // $120 with 2.9% + $0.30 grossed up: $123.89.
    await expect(page.getByText("+$3.89")).toBeVisible();
    await page.getByRole("button", { name: "Pay $123.89 by card" }).click();
    await page.waitForURL(MONEY.invoiceCheckout);
    const call = backend.writesTo("coach-invoices").find((w) => (w.body as { action: string }).action === "checkout")!;
    expect(call.body).toEqual({ origin: "http://localhost:5199", action: "checkout", invoice_id: IDS.invoice });
  });

  test("Pay offline tells the coach", async ({ page, backend, as }) => {
    seedFamilyInvoice(backend);
    seedPayments(backend);
    await as(page, "parent");
    await page.goto(`/invoices/${IDS.invoice}`);
    await page.getByRole("button", { name: "Pay offline" }).click();
    await expect(page.getByText("They'll mark this paid once they have the money.").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Told the coach" })).toBeDisabled();
    expect(backend.writesTo("coach-invoices").at(-1)!.body).toEqual({ origin: "http://localhost:5199", action: "request_offline", invoice_id: IDS.invoice });
  });

  test("coming back from Stripe checks the payment and shows it paid", async ({ page, backend, as }) => {
    const row = seedFamilyInvoice(backend);
    seedPayments(backend);
    const paid = backend.functions["coach-invoices"] as (body: unknown, ctx: never) => unknown;
    backend.functions["coach-invoices"] = (body: unknown, ctx) => {
      if ((body as { action: string }).action === "verify") {
        row.status = "paid";
        row.paid_at = new Date().toISOString();
      }
      return paid(body, ctx as never);
    };
    await as(page, "parent");
    await page.goto(`/invoices/${IDS.invoice}?paid=1`);
    await expect(page.getByRole("heading", { name: "Paid, thank you" })).toBeVisible();
    await expect(page.getByText("Casey Coach has been paid.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Pay .* by card/ })).toHaveCount(0);
    expect(backend.writesTo("coach-invoices").some((w) => (w.body as { action: string }).action === "verify")).toBe(true);
  });

  test("the parent's home lists the invoice and opens it", async ({ page, backend, as }) => {
    seedFamilyInvoice(backend);
    backend.rpc.get_athlete_home = ALEX_HOME;
    await as(page, "parent");
    await page.goto("/dashboard");
    const card = page.getByRole("region", { name: "Invoices" });
    await expect(card.getByText("1 to pay")).toBeVisible();
    await card.getByRole("link", { name: /Individual session · \$120/ }).click();
    await expect(page).toHaveURL(new RegExp(`/invoices/${IDS.invoice}$`));
    await expect(page.getByRole("heading", { name: "Invoice from Casey Coach" })).toBeVisible();
  });

  test("the coach who sent it can't open the family's invoice page", async ({ page, backend, as }) => {
    seedFamilyInvoice(backend);
    await as(page, "coach");
    await page.goto(`/invoices/${IDS.invoice}`);
    await expect(page.getByText("Invoice not found")).toBeVisible();
    await expect(page.getByText("Sign in with the account the invoice was sent to.")).toBeVisible();
    await expect(page.getByRole("button", { name: /by card/ })).toHaveCount(0);
  });
});

test.describe("account for a parent", () => {
  test("shows the athlete card, the parent and the account rows", async ({ page, backend, as }) => {
    backend.rpc.get_athlete_home = ALEX_HOME;
    await as(page, "parent");
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
    await expect(page.getByText("Alex Athlete")).toBeVisible();
    await expect(page.getByText(/^Forward · U\d+ · Rovers U17$/)).toBeVisible();
    await expect(page.getByText("Managed by Pat Parent, parent")).toBeVisible();
    await expect(page.getByRole("link", { name: /Account settings/ })).toContainText("Parent details, notifications and privacy");
    await expect(page.getByRole("link", { name: /Help/ })).toHaveAttribute("href", "/help");
    await page.getByRole("button", { name: "Sign out" }).click();
    // Signed out: home is the sign-in page.
    await expect(page).toHaveURL(/\/(auth\?mode=signin)?$/);
    await expect(page.getByText(/welcome back/i).first()).toBeVisible();
  });
});

test.describe("analytics", () => {
  test("shows sessions, average price, retention, top sessions and ratings", async ({ page, backend, as }) => {
    // The two sessions this month are on the 1st; on the 1st itself they may not have ended yet.
    test.skip(new Date().getUTCDate() === 1, "this month's sessions are on the 1st");
    seedAnalytics(backend);
    await as(page, "coach");
    await page.goto("/analytics");
    await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
    await expect(page.getByText("Sessions delivered").locator("..")).toContainText("2");
    // ($80 + $100) / 2.
    await expect(page.getByText("Avg session price").locator("..")).toContainText("$90");
    // Mia came back, Leo is new, Sam lapsed.
    await expect(page.getByText("50%", { exact: true })).toBeVisible();
    await expect(page.getByText("Returning athletes").locator("..")).toContainText("1");
    await expect(page.getByText("New this month").locator("..")).toContainText("1");
    await expect(page.getByText("Lapsed (60+ days)").locator("..")).toContainText("1");
    await expect(page.getByText("No delivered sessions this month.")).toHaveCount(0);
    await expect(page.getByText("Technique", { exact: true })).toBeVisible();
    await expect(page.getByText("Speed", { exact: true })).toBeVisible();
    await expect(page.getByText("4.5", { exact: true })).toBeVisible();
    await expect(page.getByText("Based on 4 verified sessions")).toBeVisible();
    expect(backend.writesTo("get_bookings_by_user_id")[0].body).toEqual({ athlete_id_param: null, coach_id_param: IDS.coach });
  });

  test("with no sessions or ratings everything reads None", async ({ page, as }) => {
    await as(page, "coach");
    await page.goto("/analytics");
    await expect(page.getByText("No delivered sessions this month.")).toBeVisible();
    await expect(page.getByText("No verified ratings yet")).toBeVisible();
    await expect(page.getByText("Avg session price").locator("..")).toContainText("None");
  });
});
