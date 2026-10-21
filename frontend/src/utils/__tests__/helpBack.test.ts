import { describe, expect, it } from "vitest";
import { helpBackLink, helpBackPath, helpLinkFrom } from "@/utils/helpBack";

describe("Help back link", () => {
  it("goes back to the session it came from", () => {
    expect(helpBackLink("/sessions/abc-123")).toEqual({ label: "Back to session", to: "/sessions/abc-123" });
    expect(helpBackLink(decodeURIComponent(helpLinkFrom("/sessions/abc").split("from=")[1]))).toEqual({
      label: "Back to session",
      to: "/sessions/abc",
    });
  });

  it("uses a plain Back for other in-app pages", () => {
    expect(helpBackLink("/my-sessions?tab=past")).toEqual({ label: "Back", to: "/my-sessions?tab=past" });
  });

  it("ignores anything that isn't an in-app path", () => {
    for (const bad of [null, "", "https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "sessions/1", "/help", "/help?from=/x", `/${"a".repeat(400)}`, "/a b"]) {
      expect(helpBackPath(bad)).toBeNull();
    }
  });
});
