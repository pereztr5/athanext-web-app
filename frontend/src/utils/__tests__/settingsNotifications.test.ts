import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ATHLETE_NOTIFICATIONS, COACH_NOTIFICATIONS, emailPrefKey } from "@/utils/settings";

const fn = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../../../../backend/supabase/functions/${name}/index.ts`, import.meta.url)), "utf8");

// The edge function that reads each "<kind>_email" switch before it sends.
const SENDERS: Record<string, string> = {
  booking: "send-booking-notifications",
  message: "send-conversation-email",
};

describe("email notification switches", () => {
  it("every switch is read by the function that sends that email", () => {
    for (const item of [...COACH_NOTIFICATIONS, ...ATHLETE_NOTIFICATIONS]) {
      const sender = SENDERS[item.kind];
      expect(sender, `no sender for ${item.kind}`).toBeTruthy();
      expect(fn(sender)).toContain(`.${emailPrefKey(item.kind)}`);
    }
  });

  it("booking receipts for second guardians are read by the booking email function", () => {
    expect(fn("send-booking-notifications")).toContain(".receipts_email");
  });

  it("does not offer an in-app or push switch", () => {
    const kinds = [...COACH_NOTIFICATIONS, ...ATHLETE_NOTIFICATIONS].map((item) => item.kind);
    expect(kinds).not.toContain("app");
    expect(kinds).not.toContain("push");
  });
});
