import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkMeetingUrl, MEETING_URL_MAX, MEETING_URL_PATTERN, meetingUrlAllowed, normalizeMeetingUrl } from "@/utils/meetingUrl";

const migration = readFileSync(
  fileURLToPath(new URL("../../../../backend/supabase/migrations/20261021201000_coach_meeting_links.sql", import.meta.url)),
  "utf8"
);

describe("normalizeMeetingUrl", () => {
  it("keeps an https meeting link", () => {
    expect(normalizeMeetingUrl("https://zoom.us/j/123?pwd=abc")).toBe("https://zoom.us/j/123?pwd=abc");
    expect(normalizeMeetingUrl("  https://meet.google.com/abc-defg-hij  ")).toBe("https://meet.google.com/abc-defg-hij");
  });

  it("rejects anything that is not a plain https URL", () => {
    expect(normalizeMeetingUrl("")).toBeNull();
    expect(normalizeMeetingUrl("   ")).toBeNull();
    expect(normalizeMeetingUrl("zoom.us/j/1")).toBeNull();
    expect(normalizeMeetingUrl("http://zoom.us/j/1")).toBeNull();
    expect(normalizeMeetingUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeMeetingUrl("https://user:pass@zoom.us/j/1")).toBeNull();
    expect(normalizeMeetingUrl("https://localhost/room")).toBeNull();
  });

  it("short links behave the same as in the database", () => {
    // "https://a.b" is 11 characters; it used to pass here and fail the database's 12-character minimum.
    expect(normalizeMeetingUrl("https://a.b")).toBe("https://a.b/");
    expect(meetingUrlAllowed("https://a.b")).toBe(true);
    expect(meetingUrlAllowed("https://a./")).toBe(false);
  });

  it("everything it returns passes the database rule", () => {
    for (const raw of ["https://a.b", "https://zoom.us/j/1?pwd=x#y", "https://teams.microsoft.com/l/meetup-join/19%3a", "https://a.b:8443/x@y"]) {
      const out = normalizeMeetingUrl(raw);
      expect(out).not.toBeNull();
      expect(meetingUrlAllowed(out as string)).toBe(true);
    }
  });

  it("gives a friendly reason", () => {
    expect(checkMeetingUrl("http://zoom.us/j/1").error).toMatch(/https:\/\//);
    expect(checkMeetingUrl("https://user:pass@zoom.us/j/1").error).toMatch(/password/);
    expect(checkMeetingUrl(`https://zoom.us/${"x".repeat(MEETING_URL_MAX)}`).error).toMatch(/500 characters/);
  });

  it("uses the exact pattern and limit of the coach_meeting_links check", () => {
    expect(migration).toContain(`meeting_url ~ '${MEETING_URL_PATTERN}'`);
    expect(migration).toContain(`char_length(meeting_url) <= ${MEETING_URL_MAX}`);
  });
});
