import { describe, expect, it } from "vitest";
import * as backend from "../../../../backend/supabase/functions/_shared/account_emails.ts";
import { formatDeletionDate, scheduledDeletionAt } from "../accountDeletion";
import { DELETION_GRACE_DAYS } from "../settings";

// Requests at awkward times: just before and after the 07:30 UTC run, late evening in Los
// Angeles and Honolulu, early morning in Tokyo, and around a DST change.
const REQUESTS = [
  "2026-10-21T06:00:00Z",
  "2026-10-21T07:30:00Z",
  "2026-10-21T07:31:00Z",
  "2026-10-21T23:59:00Z",
  "2026-10-22T06:45:00-08:00",
  "2026-10-22T21:00:00-10:00",
  "2026-10-22T03:00:00+09:00",
  "2026-10-25T01:30:00Z",
  "2026-12-24T22:00:00-08:00",
];

describe("account deletion date", () => {
  it("the banner and the deletion email name the same day", () => {
    expect(DELETION_GRACE_DAYS).toBe(backend.DELETION_GRACE_DAYS);
    for (const at of REQUESTS) {
      expect(scheduledDeletionAt(at).toISOString()).toBe(backend.scheduledDeletionAt(at).toISOString());
      expect(formatDeletionDate(at)).toBe(backend.formatDeletionDate(at));
    }
  });

  it("shows the UTC date of the 07:30 UTC run, not a local date", () => {
    // Asked 6:45 am in Los Angeles (14:45 UTC): due Nov 5 14:45 UTC, so the Nov 6 07:30 UTC run.
    expect(formatDeletionDate("2026-10-22T06:45:00-08:00")).toBe("Nov 6");
    expect(formatDeletionDate("2026-10-21T06:00:00Z")).toBe("Nov 4");
  });

  it("the email subject carries the same date as the banner", () => {
    const at = "2026-10-22T21:00:00-10:00";
    const email = backend.buildAccountEmail({ event: "deletion_requested", requestedAt: at, appOrigin: "https://athanext.com" });
    expect(email.subject).toContain(`deleted on ${formatDeletionDate(at)}`);
  });
});
