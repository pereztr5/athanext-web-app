import { describe, expect, it } from "vitest";
import { ATHLETE_NOTIFICATIONS, COACH_NOTIFICATIONS, EMAIL_PREF_SENDERS, emailPrefKey } from "@/utils/settings";

describe("email notification switches", () => {
  it("maps every switch to the function that sends that email", () => {
    for (const item of [...COACH_NOTIFICATIONS, ...ATHLETE_NOTIFICATIONS]) {
      expect(EMAIL_PREF_SENDERS[emailPrefKey(item.kind)]).toBeTruthy();
    }
  });

  it("does not offer an in-app or push switch", () => {
    const kinds = [...COACH_NOTIFICATIONS, ...ATHLETE_NOTIFICATIONS].map((item) => item.kind);
    expect(kinds).not.toContain("app");
    expect(kinds).not.toContain("push");
    expect(Object.keys(EMAIL_PREF_SENDERS).some((key) => key.endsWith("_app") || key.endsWith("_push"))).toBe(false);
  });

  it("sends booking receipts from the booking email function", () => {
    expect(EMAIL_PREF_SENDERS.receipts_email).toBe("send-booking-notifications");
  });
});
