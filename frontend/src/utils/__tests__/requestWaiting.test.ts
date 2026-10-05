import { describe, it, expect } from "vitest";
import { countExpiringSoon, formatExpiry, isRequestExpiringSoon, minutesLeft } from "@/utils/requestWaiting";

const now = new Date("2026-09-30T12:00:00Z");

describe("request holds", () => {
  it("counts whole minutes left", () => {
    expect(minutesLeft("2026-09-30T13:30:30Z", now)).toBe(90);
    expect(minutesLeft(null, now)).toBe(0);
    expect(minutesLeft("not a date", now)).toBe(0);
    expect(minutesLeft("2026-09-30T11:00:00Z", now)).toBe(0);
  });
  it("flags requests with under 6 hours left", () => {
    expect(isRequestExpiringSoon("2026-09-30T18:00:00Z", now)).toBe(false);
    expect(isRequestExpiringSoon("2026-09-30T17:59:00Z", now)).toBe(true);
    expect(isRequestExpiringSoon(null, now)).toBe(false);
    expect(
      countExpiringSoon([{ expiresAt: "2026-09-30T13:00:00Z" }, { expiresAt: "2026-10-01T11:00:00Z" }], now)
    ).toBe(1);
  });
  it("formats the time left", () => {
    expect(formatExpiry("2026-10-01T09:30:00Z", now)).toBe("Expires in 21h");
    expect(formatExpiry("2026-09-30T12:40:00Z", now)).toBe("Expires in 40 min");
    expect(formatExpiry("2026-09-30T11:00:00Z", now)).toBe("Expiring");
  });
});
