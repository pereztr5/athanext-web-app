import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { campCoachEmail, campCoachMarkedPaidEmail, campDates, campDetailsEmail, campMarkedPaidEmail, campParentEmail, campTime, campTimes, holdDay, money } from "./camp_emails.ts";
import { EMAIL_CARD, EMAIL_CREAM } from "./email_shell.ts";

const camp = {
  name: "Thanksgiving <Camp>",
  starts_on: "2026-11-24",
  ends_on: "2026-11-26",
  location: "Riverside Park",
  included: ["Water bottle", "Shin guards"],
  coach_name: "Brayan",
};

Deno.test("dates, times and money", () => {
  assertEquals(campDates("2026-11-24", "2026-11-26"), "Nov 24 to Nov 26");
  assertEquals(campDates("2026-11-24", "2026-11-24"), "Nov 24");
  assertEquals(campDates(null, null), "");
  assertEquals(campTime("09:00"), "9am");
  assertEquals(campTime("12:30"), "12:30pm");
  assertEquals(campTime("20:00"), "8pm");
  assertEquals(campTime("00:30"), "12:30am");
  assertEquals(campTime("16:00:00"), "4pm");
  assertEquals(campTime("bad"), "");
  assertEquals(money(26845), "$268.45");
});

Deno.test("camp times carry the Eastern label", () => {
  assertEquals(campTimes("16:00", "17:30"), "4pm to 5:30pm ET");
  assertEquals(campTimes("09:00:00", "12:30:00"), "9am to 12:30pm ET");
  assertEquals(campTimes("09:00", null), "9am ET");
  assertEquals(campTimes(null, null), "");
  assertEquals(campTimes("", "bad"), "");
});

Deno.test("parent receipt escapes names and offers Finish your account only when given", () => {
  const paid = campParentEmail({
    kind: "paid",
    parentName: "Ana <b>Diaz</b>",
    camp,
    athletes: [{ first_name: "Leo", last_name: "Diaz", group_name: "U12", start_time: "09:00", end_time: "12:00" }],
    amountCents: 26845,
    finishUrl: "https://athanext.com/auth?mode=signup&email=a%40b.c",
  });
  assertEquals(paid.subject, "You're in: Thanksgiving <Camp>");
  assertStringIncludes(paid.html, "Thanksgiving &lt;Camp&gt;");
  assert(!paid.html.includes("<b>Diaz</b>"));
  assertStringIncludes(paid.html, "$268.45");
  assertStringIncludes(paid.html, "9am to 12pm ET");
  assertStringIncludes(paid.html, "Finish your account");
  assertStringIncludes(paid.html, "Water bottle");
  assertStringIncludes(paid.html, EMAIL_CREAM);
  assertStringIncludes(paid.html, EMAIL_CARD);

  const held = campParentEmail({ kind: "held", parentName: null, camp, athletes: [{ first_name: "Leo" }], finishUrl: null });
  assertEquals(held.subject, "Spot held: Thanksgiving <Camp>");
  assertStringIncludes(held.html, "Nothing was charged");
  assert(!held.html.includes("Finish your account"));
  assert(!held.html.includes(" him"));

  const dated = campParentEmail({
    kind: "held",
    parentName: null,
    camp,
    athletes: [{ first_name: "Leo" }],
    finishUrl: null,
    heldUntil: "2026-11-04T13:09:23Z",
  });
  assertStringIncludes(dated.html, "by <strong>Nov 4</strong> to keep your spot");
});

Deno.test("hold day is on Eastern time", () => {
  assertEquals(holdDay("2026-11-05T03:00:00Z"), "Nov 4");
  assertEquals(holdDay(null), null);
});

Deno.test("marked-paid email confirms the spot", () => {
  const paid = campMarkedPaidEmail({ camp, parentName: "Ana Diaz", athlete: { first_name: "Leo" }, finishUrl: null });
  assertEquals(paid.subject, "You're in: Thanksgiving <Camp>");
  assertStringIncludes(paid.html, "marked your payment as received");
  assertStringIncludes(paid.html, "Hi Ana,");
});

Deno.test("coach marked-paid email confirms the spot to the coach", () => {
  const mail = campCoachMarkedPaidEmail({
    camp,
    parentName: "Ana <b>",
    parentEmail: "ana@example.com",
    athlete: { first_name: "Leo", group_name: "U10" },
    amountCents: 25000,
    registrationsUrl: "https://app.athanext.com/camps?camp=1&view=registrations",
  });
  assertEquals(mail.subject, "Spot confirmed: Thanksgiving <Camp>");
  assertStringIncludes(mail.html, "You marked the payment from Ana &lt;b&gt; (ana@example.com) as received");
  assertStringIncludes(mail.html, "Leo's spot at <strong>Thanksgiving &lt;Camp&gt;</strong> is confirmed");
  assertStringIncludes(mail.html, "Paid to you directly:</strong> $250.00");
  assertStringIncludes(mail.html, "view=registrations");
});

Deno.test("coach email: new sign-up paid by card", () => {
  const paid = campCoachEmail({
    kind: "paid",
    camp,
    parentName: "Ana <b>",
    parentEmail: "ana@example.com",
    athletes: [
      { first_name: "Leo", last_name: "Diaz", group_name: "U10 <A>", start_time: "09:00", end_time: "12:00" },
      { first_name: "Mia" },
    ],
    amountCents: 26845,
    registrationsUrl: "https://app.athanext.com/camps?camp=1&view=registrations",
  });
  assertEquals(paid.subject, "New sign-up: Thanksgiving <Camp>");
  assertStringIncludes(paid.html, "Ana &lt;b&gt; (ana@example.com) signed up for <strong>Thanksgiving &lt;Camp&gt;</strong> and paid by card");
  assertStringIncludes(paid.html, "The spot is confirmed.");
  assertStringIncludes(paid.html, "Leo Diaz (U10 &lt;A&gt;, 9am to 12pm ET)");
  assertStringIncludes(paid.html, "Mia");
  assertStringIncludes(paid.html, "Nov 24 to Nov 26");
  assertStringIncludes(paid.html, "<strong>Paid by card:</strong> $268.45");
  assertStringIncludes(paid.html, "Open registrations");
  assertStringIncludes(paid.html, "https://app.athanext.com/camps?camp=1&amp;view=registrations");
  assert(!paid.html.includes("<b>"));
  assert(!paid.html.includes("confirm payment"));
});

Deno.test("coach email: spot requested, paid offline", () => {
  const held = campCoachEmail({
    kind: "held",
    camp,
    parentName: null,
    parentEmail: null,
    athletes: [{ first_name: "Leo", last_name: "Diaz" }],
    amountCents: 25000,
    heldUntil: "2026-11-04T15:00:00Z",
    registrationsUrl: "x",
  });
  assertEquals(held.subject, "Spot requested: Thanksgiving <Camp>");
  assertStringIncludes(held.html, "A family requested a spot at <strong>Thanksgiving &lt;Camp&gt;</strong> and will pay you offline.");
  assertStringIncludes(held.html, "waiting for you to confirm payment");
  assertStringIncludes(held.html, "<strong>To be paid offline:</strong> $250.00");
  assertStringIncludes(held.html, "marked paid by <strong>Nov 4</strong>");
  assertStringIncludes(held.html, "Open registrations");
  // No amount or pay-by date: those lines are left out.
  const bare = campCoachEmail({ kind: "held", camp, parentName: null, parentEmail: null, athletes: [{ first_name: "Leo" }], registrationsUrl: "x" });
  assert(!bare.html.includes("To be paid offline"));
  assert(!bare.html.includes("released"));
});

Deno.test("details email for a coach-added athlete", () => {
  const notPaid = campDetailsEmail({ camp, parentName: "Ana Diaz", athlete: { first_name: "Leo" }, status: "held", finishUrl: null });
  assertStringIncludes(notPaid.html, "Pay Brayan directly");
  const paid = campDetailsEmail({ camp, parentName: null, athlete: { first_name: "Leo" }, status: "paid", finishUrl: "https://x" });
  assert(!paid.html.includes("Pay Brayan directly"));
  assertStringIncludes(paid.html, "Finish your account");
});

Deno.test("refund email and full-refund rule", async () => {
  const { campReversedEmail } = await import("./camp_emails.ts");
  const { isFullRefund } = await import("./camp_settle.ts");
  const mail = campReversedEmail({
    status: "refunded",
    camp,
    parentName: "Ana",
    parentEmail: "ana@example.com",
    athletes: [{ first_name: "Leo" }],
    registrationsUrl: "https://athanext.com/profile?camp=1",
  });
  assertEquals(mail.subject, "Refunded: Thanksgiving <Camp> sign-up");
  assertStringIncludes(mail.html, "no longer hold a spot");
  assertEquals(campReversedEmail({ ...{ status: "disputed" as const }, camp, parentName: null, parentEmail: null, athletes: [], registrationsUrl: "x" }).subject, "Disputed: Thanksgiving <Camp> sign-up");
  assert(isFullRefund({ amount: 26845, amount_refunded: 26845 }));
  assert(isFullRefund({ refunded: true }));
  assert(!isFullRefund({ amount: 26845, amount_refunded: 1000, refunded: false }));
});
