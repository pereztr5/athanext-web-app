import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { buildAccountEmail, scheduledDeletionAt } from "./account_emails.ts";

Deno.test("scheduledDeletionAt is the first 07:30 UTC run 14 days later", () => {
  // Asked at 06:00 UTC: due 06:00 on day 14, the 07:30 run that day deletes it.
  assertEquals(scheduledDeletionAt("2026-10-21T06:00:00Z").toISOString(), "2026-11-04T07:30:00.000Z");
  // Asked at 12:00 UTC: due after that day's run, so the next morning.
  assertEquals(scheduledDeletionAt("2026-10-21T12:00:00Z").toISOString(), "2026-11-05T07:30:00.000Z");
  // Exactly on the run time.
  assertEquals(scheduledDeletionAt("2026-10-21T07:30:00Z").toISOString(), "2026-11-04T07:30:00.000Z");
});

Deno.test("deletion email names the date and how to keep the account", () => {
  const email = buildAccountEmail({
    event: "deletion_requested",
    name: "Dana <b>Patel</b>",
    requestedAt: "2026-10-21T12:00:00Z",
    timeZone: "America/New_York",
    appOrigin: "https://athanext.com/",
  });
  assertStringIncludes(email.subject, "Thursday, November 5, 2026");
  assertStringIncludes(email.html, "Keep my account");
  assertStringIncludes(email.html, "https://athanext.com/auth");
  assertStringIncludes(email.html, "Hi Dana,");
  assert(!email.html.includes("<b>Patel"));
});

Deno.test("cancel and deactivate emails", () => {
  assertStringIncludes(buildAccountEmail({ event: "deletion_cancelled", appOrigin: "https://a.b" }).subject, "staying");
  const off = buildAccountEmail({ event: "coach_deactivated", name: "Sam", appOrigin: "https://a.b" });
  assertStringIncludes(off.html, "Reactivate");
  assertStringIncludes(off.html, "https://a.b/settings?tab=security");
});
