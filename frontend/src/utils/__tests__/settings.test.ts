import { describe, it, expect } from "vitest";
import { joinName, notificationOn, passwordStrength, splitName } from "@/utils/settings";

describe("names", () => {
  it("splits and joins first and last names", () => {
    expect(splitName("  Riley  Ann Example ")).toEqual({ first: "Riley", last: "Ann Example" });
    expect(splitName(null)).toEqual({ first: "", last: "" });
    expect(joinName(" Riley ", " Example ")).toBe("Riley Example");
    expect(joinName("Riley", "")).toBe("Riley");
  });
});

describe("passwordStrength", () => {
  it("scores length, numbers and symbols", () => {
    expect(passwordStrength("").score).toBe(0);
    expect(passwordStrength("abcdefgh").score).toBe(1);
    expect(passwordStrength("abcdefg1").score).toBe(2);
    expect(passwordStrength("abcdef1!").score).toBe(3);
    expect(passwordStrength("abcdefghij1!").hint).toBe("Very strong.");
  });
});

describe("notificationOn", () => {
  it("treats missing keys as on", () => {
    expect(notificationOn({}, "message", "email")).toBe(true);
    expect(notificationOn(null, "message", "app")).toBe(true);
    expect(notificationOn({ message_email: false }, "message", "email")).toBe(false);
    expect(notificationOn({ message_email: false }, "message", "app")).toBe(true);
  });
});
