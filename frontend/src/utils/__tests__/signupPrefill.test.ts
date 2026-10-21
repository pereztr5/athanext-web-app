import { describe, expect, it } from "vitest";
import { emptySignupAnswers, initialSignupStep, isGoogleUser, prefillFromUser } from "../signup";

const googleUser = {
  email: "sam@example.com",
  user_metadata: { full_name: "Sam  de Vries" },
  app_metadata: { provider: "google" },
};

describe("prefillFromUser", () => {
  it("fills name and email from Google and marks the account as Google", () => {
    const out = prefillFromUser(emptySignupAnswers(), googleUser);
    expect(out).toMatchObject({ first: "Sam", last: "de Vries", email: "sam@example.com", google: true });
  });

  it("keeps answers already typed", () => {
    const out = prefillFromUser({ ...emptySignupAnswers(), first: "Samuel", phone: "+15125550100" }, googleUser);
    expect(out.first).toBe("Samuel");
    expect(out.phone).toBe("+15125550100");
  });

  it("doesn't mark an email account as Google", () => {
    const out = prefillFromUser(emptySignupAnswers(), { email: "a@b.co", user_metadata: { name: "Ann Lee" }, app_metadata: { provider: "email" } });
    expect(out.google).toBeUndefined();
    expect(out.first).toBe("Ann");
  });
});

describe("isGoogleUser", () => {
  it("checks the provider and linked identities", () => {
    expect(isGoogleUser(googleUser)).toBe(true);
    expect(isGoogleUser({ app_metadata: { provider: "email" }, identities: [{ provider: "google" }] })).toBe(true);
    expect(isGoogleUser({ app_metadata: { provider: "email" } })).toBe(false);
  });
});

describe("initialSignupStep", () => {
  it("starts at the first question without saved answers", () => {
    expect(initialSignupStep(true, null)).toBe("who");
    expect(initialSignupStep(false, { who: "coach" })).toBe("who");
  });

  it("goes to the account step for a signed-in account with saved answers", () => {
    expect(initialSignupStep(true, { who: "parent" })).toBe("account");
  });
});
