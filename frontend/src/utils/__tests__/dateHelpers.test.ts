import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import {
  getWeekStart,
  formatWeekRange,
  getTodayISODate,
  parseISODateLocal,
  parseLocalTimeParts,
  buildLocalDateTime,
  hasSlotStarted,
  toLocalISODate,
  formatDate,
} from "@/utils/dateHelpers";

// Characterization tests: pin CURRENT behavior. Run under TZ=UTC.

describe("getWeekStart", () => {
  it("returns Monday for a mid-week date", () => {
    expect(toLocalISODate(getWeekStart(new Date(2026, 6, 22)))).toBe("2026-07-20"); // Wed -> Mon
  });
  it("returns the previous Monday for a Sunday", () => {
    expect(toLocalISODate(getWeekStart(new Date(2026, 6, 26)))).toBe("2026-07-20");
  });
  it("returns the same day for a Monday", () => {
    expect(toLocalISODate(getWeekStart(new Date(2026, 6, 20)))).toBe("2026-07-20");
  });
});

describe("formatWeekRange", () => {
  it("formats Monday-start week as 'Mon D, YYYY - Mon D, YYYY'", () => {
    expect(formatWeekRange(new Date(2026, 6, 20))).toBe("Jul 20, 2026 - Jul 26, 2026");
  });
});

describe("getTodayISODate", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 20, 12, 0, 0));
  });
  afterAll(() => vi.useRealTimers());
  it("returns local YYYY-MM-DD for today", () => {
    expect(getTodayISODate()).toBe("2026-07-20");
  });
});

describe("parseISODateLocal", () => {
  it("parses YYYY-MM-DD into local date parts", () => {
    const d = parseISODateLocal("2026-07-05");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 6, 5]);
  });
});

describe("parseLocalTimeParts", () => {
  it("parses HH:mm", () => expect(parseLocalTimeParts("09:30")).toEqual([9, 30, 0]));
  it("defaults missing parts to 0", () => expect(parseLocalTimeParts("9")).toEqual([9, 0, 0]));
  it("coerces garbage to 0", () => expect(parseLocalTimeParts("aa:bb")).toEqual([0, 0, 0]));
});

describe("buildLocalDateTime", () => {
  it("combines date and time in local tz", () => {
    const d = buildLocalDateTime("2026-07-20", "09:30");
    expect([d.getHours(), d.getMinutes(), d.getDate()]).toEqual([9, 30, 20]);
  });
});

describe("hasSlotStarted", () => {
  it("is true once start time is reached", () => {
    expect(hasSlotStarted("2026-07-20", "09:00", new Date(2026, 6, 20, 10, 0))).toBe(true);
  });
  it("is false before start time", () => {
    expect(hasSlotStarted("2026-07-20", "09:00", new Date(2026, 6, 20, 8, 0))).toBe(false);
  });
  it("is false for missing date or time", () => {
    expect(hasSlotStarted(null, "09:00")).toBe(false);
    expect(hasSlotStarted("2026-07-20", null)).toBe(false);
  });
});

describe("toLocalISODate", () => {
  it("zero-pads month and day", () => {
    expect(toLocalISODate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("formatDate", () => {
  // NOTE: formatDate uses new Date(iso) which parses date-only strings as UTC
  // midnight — this pin is only stable because the test script forces TZ=UTC.
  it("formats an ISO date string", () => {
    expect(formatDate("2026-07-20")).toBe("Jul 20, 2026");
  });
});
