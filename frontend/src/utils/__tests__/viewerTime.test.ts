import { describe, it, expect } from "vitest";
import {
  formatInstantSpan,
  formatSlotForViewer,
  isValidTimeZone,
  resolveTimeZone,
  sessionInstantISO,
  timeZoneAbbreviation,
} from "@/utils/viewerTime";

describe("sessionInstantISO", () => {
  it("reads stored times as Eastern wall-clock (EDT in summer)", () => {
    expect(sessionInstantISO("2026-07-15", "09:00:00")).toBe("2026-07-15T13:00:00.000Z");
  });
  it("uses EST in winter", () => {
    expect(sessionInstantISO("2026-12-18", "10:00")).toBe("2026-12-18T15:00:00.000Z");
  });
});

describe("formatSlotForViewer", () => {
  it("converts an Eastern slot to Pacific", () => {
    expect(formatSlotForViewer("2026-07-15", "09:00", "10:00", "America/Los_Angeles")).toEqual({
      span: "6:00 to 7:00 am",
      dayShift: null,
    });
  });
  it("keeps Eastern viewers on the stored clock", () => {
    expect(formatSlotForViewer("2026-12-18", "16:00", "17:00", "America/New_York").span).toBe("4:00 to 5:00 pm");
  });
  it("flags a calendar-day change", () => {
    const result = formatSlotForViewer("2026-07-15", "22:00", "23:00", "Asia/Tashkent");
    expect(result.span).toBe("7:00 to 8:00 am");
    expect(result.dayShift).toBe("Thu, Jul 16");
  });
  it("returns empty for missing inputs", () => {
    expect(formatSlotForViewer(null, "09:00", "10:00", "UTC")).toEqual({ span: "", dayShift: null });
  });
});

describe("formatInstantSpan", () => {
  it("keeps both periods when they differ", () => {
    const start = new Date("2026-07-15T15:30:00Z");
    const end = new Date("2026-07-15T16:30:00Z");
    expect(formatInstantSpan(start, end, "America/New_York")).toBe("11:30 am to 12:30 pm");
  });
});

describe("time zone resolution", () => {
  it("validates IANA names", () => {
    expect(isValidTimeZone("America/Chicago")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
  });
  it("prefers a valid saved zone", () => {
    expect(resolveTimeZone("Europe/London")).toBe("Europe/London");
    expect(resolveTimeZone("bogus")).toBe(resolveTimeZone(null));
  });
  it("labels Eastern by season", () => {
    expect(timeZoneAbbreviation("America/New_York", new Date("2026-07-15T12:00:00Z"))).toBe("EDT");
    expect(timeZoneAbbreviation("America/New_York", new Date("2026-12-15T12:00:00Z"))).toBe("EST");
  });
});
