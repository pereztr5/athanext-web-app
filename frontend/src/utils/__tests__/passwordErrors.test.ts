import { describe, expect, it } from "vitest";
import { PASSWORD_FALLBACK_MESSAGE, WRONG_PASSWORD_MESSAGE, friendlyPasswordError } from "../passwordErrors";

describe("friendlyPasswordError", () => {
  it("explains a reused password", () => {
    expect(friendlyPasswordError({ code: "same_password", message: "New password should be different from the old password." })).toMatch(
      /different from your current one/
    );
    expect(friendlyPasswordError({ message: "New password should be different from the old password." })).toMatch(/different/);
  });

  it("explains a weak password", () => {
    expect(friendlyPasswordError({ code: "weak_password", message: "Password is known to be weak" })).toMatch(/too easy to guess/);
  });

  it("flags a wrong current password", () => {
    expect(friendlyPasswordError({ code: "invalid_credentials", message: "Invalid login credentials", status: 400 })).toBe(
      WRONG_PASSWORD_MESSAGE
    );
  });

  it("explains rate limits and ended sessions", () => {
    expect(friendlyPasswordError({ status: 429, message: "x" })).toMatch(/Too many attempts/);
    expect(friendlyPasswordError({ message: "Auth session missing!" })).toMatch(/Sign in again/);
  });

  it("shows Supabase's own message for anything else", () => {
    expect(friendlyPasswordError({ message: "Something specific broke" })).toBe("Something specific broke");
  });

  it("falls back when there is nothing to show", () => {
    expect(friendlyPasswordError(null)).toBe(PASSWORD_FALLBACK_MESSAGE);
    expect(friendlyPasswordError({ message: "" })).toBe(PASSWORD_FALLBACK_MESSAGE);
  });
});
