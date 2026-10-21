import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { familyHtml, reasonLabel, resolveSiteUrl, supportHtml, supportSubject, type IssueReport } from "./email.ts";

const report: IssueReport = {
  id: "r1",
  reason: "safety",
  details: "<script>alert(1)</script> The coach shouted at my son.",
  createdAt: "2026-10-21T10:00:00Z",
  bookingId: "b1",
  occurrenceId: "o1",
  bookingStatus: "booked",
  paymentStatus: "paid",
  sessionTitle: "Finishing",
  sessionWhen: "Tue, Oct 21, 5:00 PM ET",
  place: "Riverside Park",
  price: 80,
  coachName: "Michael Reed",
  coachEmail: "coach@example.com",
  coachLink: "https://athanext.com/coach/michael",
  athleteName: "Ava Smith",
  reporterName: "Jamie Smith",
  reporterEmail: "jamie@example.com",
  sessionLink: "https://athanext.com/sessions/o1",
};

Deno.test("safety reports are URGENT in the subject; others aren't", () => {
  assertEquals(supportSubject(report), "URGENT: Session issue: Safety concern (Michael Reed / Ava Smith)");
  assertEquals(supportSubject({ ...report, reason: "payment" }), "Session issue: Payment problem (Michael Reed / Ava Smith)");
});

Deno.test("unknown reasons read as Something else", () => {
  assertEquals(reasonLabel("whatever"), "Something else");
});

Deno.test("support email escapes the family's text and links the session", () => {
  const html = supportHtml(report);
  assert(!html.includes("<script>"));
  assertStringIncludes(html, "&lt;script&gt;");
  assertStringIncludes(html, "https://athanext.com/sessions/o1");
  assertStringIncludes(html, "jamie@example.com");
});

Deno.test("family confirmation promises a reply within one business day", () => {
  assertStringIncludes(familyHtml(report), "within one business day");
});

Deno.test("links only point at known app hosts", () => {
  assertEquals(resolveSiteUrl("https://evil.example", "https://athanext.com"), "https://athanext.com");
  assertEquals(resolveSiteUrl("https://athanext-staging.vercel.app", "https://athanext.com"), "https://athanext-staging.vercel.app");
  assertEquals(resolveSiteUrl(undefined, "https://athanext.com"), "https://athanext.com");
});
