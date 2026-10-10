import { describe, expect, it } from "vitest";
import { formatLocationSentence, formatTimeSpan, formatWholePrice } from "@/utils/sessionFormatting";

describe("formatTimeSpan", () => {
  it("shares the period when both times are in the same half of the day", () => {
    expect(formatTimeSpan("16:00", "17:00")).toBe("4:00 to 5:00 pm");
  });

  it("keeps both periods when the span crosses noon", () => {
    expect(formatTimeSpan("11:30:00", "12:30:00")).toBe("11:30 am to 12:30 pm");
  });

  it("accepts ISO datetimes", () => {
    expect(formatTimeSpan("2026-03-09T10:00:00", "2026-03-09T10:45:00")).toBe("10:00 to 10:45 am");
  });

  it("returns an empty string for invalid input", () => {
    expect(formatTimeSpan("nope", "17:00")).toBe("");
  });

  it("appends the zone abbreviation when asked", () => {
    const start = "2026-07-15T20:00:00Z";
    const end = "2026-07-15T21:00:00Z";
    expect(formatTimeSpan(start, end, "America/New_York")).toBe("4:00 to 5:00 pm");
    expect(formatTimeSpan(start, end, "America/New_York", true)).toBe("4:00 to 5:00 pm EDT");
    expect(formatTimeSpan("2026-12-15T21:00:00Z", "2026-12-15T22:00:00Z", "America/Chicago", true)).toBe(
      "3:00 to 4:00 pm CST",
    );
  });

  it("leaves bare clock times without a zone", () => {
    expect(formatTimeSpan("16:00", "17:00", "America/New_York", true)).toBe("4:00 to 5:00 pm");
  });
});

describe("formatWholePrice", () => {
  it("drops cents for whole amounts", () => {
    expect(formatWholePrice(45)).toBe("$45");
  });

  it("keeps cents otherwise", () => {
    expect(formatWholePrice(47.25)).toBe("$47.25");
  });
});

describe("formatLocationSentence", () => {
  it("sentence-cases known locations", () => {
    expect(formatLocationSentence("in-person")).toBe("In person");
    expect(formatLocationSentence("online")).toBe("Online");
    expect(formatLocationSentence(null)).toBe("");
  });
});
