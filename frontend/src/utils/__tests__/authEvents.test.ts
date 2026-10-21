import { describe, expect, it } from "vitest";
import { planAuthEvent } from "../authEvents";

describe("planAuthEvent", () => {
  it("blocks only when a different user signs in", () => {
    expect(planAuthEvent("SIGNED_IN", null, "u1", true)).toEqual({ blocking: true, fetchProfile: true, clear: false });
    expect(planAuthEvent("SIGNED_IN", "u1", "u2", true)).toEqual({ blocking: true, fetchProfile: true, clear: false });
  });

  it("stays quiet when the same user signs in again (password check, tab focus)", () => {
    expect(planAuthEvent("SIGNED_IN", "u1", "u1", true)).toEqual({ blocking: false, fetchProfile: false, clear: false });
  });

  it("never blocks on token refreshes", () => {
    expect(planAuthEvent("TOKEN_REFRESHED", "u1", "u1", true).blocking).toBe(false);
    expect(planAuthEvent("TOKEN_REFRESHED", "u1", "u1", true).fetchProfile).toBe(false);
  });

  it("refreshes the profile quietly on USER_UPDATED", () => {
    expect(planAuthEvent("USER_UPDATED", "u1", "u1", true)).toEqual({ blocking: false, fetchProfile: true, clear: false });
  });

  it("leaves the first load to the session check", () => {
    expect(planAuthEvent("INITIAL_SESSION", null, "u1", true).blocking).toBe(false);
    expect(planAuthEvent("SIGNED_IN", null, "u1", false).blocking).toBe(false);
  });

  it("clears on sign-out", () => {
    expect(planAuthEvent("SIGNED_OUT", "u1", null, true).clear).toBe(true);
    expect(planAuthEvent("SIGNED_OUT", null, null, false).clear).toBe(true);
  });
});
