import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { campCoachEmail, campDates, campDetailsEmail, campParentEmail, campTime, money } from "./camp_emails.ts";

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
  assertEquals(campTime("09:00"), "9:00 AM");
  assertEquals(campTime("12:30"), "12:30 PM");
  assertEquals(campTime("20:00"), "8:00 PM");
  assertEquals(money(26845), "$268.45");
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
  assertStringIncludes(paid.html, "9:00 AM to 12:00 PM");
  assertStringIncludes(paid.html, "Finish your account");
  assertStringIncludes(paid.html, "Water bottle");

  const held = campParentEmail({ kind: "held", parentName: null, camp, athletes: [{ first_name: "Leo" }], finishUrl: null });
  assertEquals(held.subject, "Spot held: Thanksgiving <Camp>");
  assertStringIncludes(held.html, "Nothing was charged");
  assert(!held.html.includes("Finish your account"));
});

Deno.test("coach email says how the family pays", () => {
  const paid = campCoachEmail({
    kind: "paid",
    camp,
    parentName: "Ana",
    parentEmail: "ana@example.com",
    athletes: [{ first_name: "Leo" }, { first_name: "Mia" }],
    registrationsUrl: "https://athanext.com/profile?camp=1",
  });
  assertEquals(paid.subject, "2 athletes signed up for Thanksgiving <Camp>");
  assertStringIncludes(paid.html, "signed up and paid in the app");
  const held = campCoachEmail({ ...{ kind: "held" as const }, camp, parentName: null, parentEmail: null, athletes: [{ first_name: "Leo" }], registrationsUrl: "x" });
  assertEquals(held.subject, "1 athlete waiting for payment: Thanksgiving <Camp>");
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
