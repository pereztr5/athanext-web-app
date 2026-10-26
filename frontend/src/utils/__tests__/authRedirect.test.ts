import { describe, expect, it } from "vitest";
import { buildOAuthRedirectPath, whoFromPersona } from "../authRedirect";

describe("buildOAuthRedirectPath", () => {
  it("returns / when there is nothing to preserve", () => {
    expect(buildOAuthRedirectPath({})).toBe("/");
    expect(buildOAuthRedirectPath({ signup: false })).toBe("/");
  });

  it("forces signup mode when signup is true", () => {
    expect(buildOAuthRedirectPath({ signup: true })).toBe("/auth?mode=signup");
  });

  it("keeps invite on the auth return", () => {
    expect(buildOAuthRedirectPath({ invite: "tok-1" })).toBe("/auth?mode=signup&invite=tok-1");
  });

  it("keeps coach share when there is no invite", () => {
    expect(buildOAuthRedirectPath({ coach: "coach-uuid" })).toBe(
      "/auth?mode=signup&coach=coach-uuid",
    );
  });

  it("drops coach when invite is present", () => {
    expect(buildOAuthRedirectPath({ invite: "tok", coach: "c1" })).toBe(
      "/auth?mode=signup&invite=tok",
    );
  });

  it("keeps camp finish params", () => {
    expect(
      buildOAuthRedirectPath({
        campSignup: "11111111-1111-1111-1111-111111111111",
        email: "parent@example.com",
      }),
    ).toBe(
      "/auth?mode=signup&camp_signup=11111111-1111-1111-1111-111111111111&email=parent%40example.com",
    );
  });

  it("combines signup with camp and invite", () => {
    expect(
      buildOAuthRedirectPath({
        signup: true,
        invite: "tok",
        campSignup: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        email: "a@b.co",
      }),
    ).toBe(
      "/auth?mode=signup&invite=tok&camp_signup=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa&email=a%40b.co",
    );
  });
});

describe("whoFromPersona", () => {
  it("maps known persona query values", () => {
    expect(whoFromPersona("coach")).toBe("coach");
    expect(whoFromPersona("athlete")).toBe("self");
    expect(whoFromPersona("parent")).toBe("parent");
    expect(whoFromPersona("other")).toBeNull();
    expect(whoFromPersona(null)).toBeNull();
  });
});
