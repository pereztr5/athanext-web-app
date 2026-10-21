import { describe, expect, it } from "vitest";
import { ISSUE_REASONS, issueErrors } from "@/utils/sessionIssues";

describe("report an issue", () => {
  it("offers the four reasons, safety first", () => {
    expect(ISSUE_REASONS.map((r) => r.label)).toEqual(["Safety concern", "Coach didn't show", "Payment problem", "Something else"]);
  });

  it("needs a reason and a few words", () => {
    expect(issueErrors(null, "")).toEqual({ reason: "Choose what the issue is about", details: "Tell us a bit more about what happened" });
    expect(issueErrors("payment", "   Charged twice for this ")).toEqual({});
    expect(issueErrors("payment", "short")).toEqual({ details: "Tell us a bit more about what happened" });
    expect(issueErrors("other", "x".repeat(2001)).details).toMatch(/2000/);
  });
});
