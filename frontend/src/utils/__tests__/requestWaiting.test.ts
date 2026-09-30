import { describe, it, expect } from "vitest";
import { countOverdueRequests, formatWaiting, hoursWaiting, isRequestOverdue } from "@/utils/requestWaiting";

const now = new Date("2026-09-30T12:00:00Z");

describe("request waiting", () => {
  it("counts whole hours since the request", () => {
    expect(hoursWaiting("2026-09-30T06:30:00Z", now)).toBe(5);
    expect(hoursWaiting(null, now)).toBe(0);
    expect(hoursWaiting("not a date", now)).toBe(0);
    expect(hoursWaiting("2026-10-01T00:00:00Z", now)).toBe(0);
  });
  it("flags requests waiting 24h or more", () => {
    expect(isRequestOverdue("2026-09-29T12:00:01Z", now)).toBe(false);
    expect(isRequestOverdue("2026-09-29T12:00:00Z", now)).toBe(true);
    expect(
      countOverdueRequests([{ requestedAt: "2026-09-28T00:00:00Z" }, { requestedAt: "2026-09-30T11:00:00Z" }], now)
    ).toBe(1);
  });
  it("formats the wait", () => {
    expect(formatWaiting(0)).toBe("Just now");
    expect(formatWaiting(30)).toBe("Waiting 30h");
    expect(formatWaiting(73)).toBe("Waiting 3 days");
  });
});
