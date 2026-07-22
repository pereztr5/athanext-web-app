import { describe, expect, it } from "vitest";
import { resolveRole } from "../role";

describe("resolveRole", () => {
  it("prefers the DB profile over auth metadata", () => {
    const user = { user_metadata: { persona_type: "athlete" } };
    const userProfile = { persona_type: "coach" };
    expect(resolveRole(user, userProfile)).toBe("coach");
  });

  it("falls back to auth metadata when the profile has no persona", () => {
    const user = { user_metadata: { persona_type: "parent" } };
    expect(resolveRole(user, null)).toBe("parent");
    expect(resolveRole(user, { persona_type: null })).toBe("parent");
  });

  it("normalizes case and whitespace", () => {
    expect(resolveRole(null, { persona_type: " Coach " })).toBe("coach");
    expect(resolveRole({ user_metadata: { persona_type: "ATHLETE" } }, null)).toBe("athlete");
  });

  it("returns null for unknown or missing values", () => {
    expect(resolveRole(null, null)).toBeNull();
    expect(resolveRole({ user_metadata: {} }, {})).toBeNull();
    expect(resolveRole(null, { persona_type: "admin" })).toBeNull();
    expect(resolveRole({ user_metadata: { persona_type: 42 } }, null)).toBeNull();
  });
});
