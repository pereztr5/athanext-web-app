import { describe, expect, it } from "vitest";
import { normalizeMeetingUrl } from "@/utils/meetingUrl";

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
});
