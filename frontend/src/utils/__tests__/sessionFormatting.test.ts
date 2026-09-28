import { describe, expect, it } from "vitest";
import { formatLocationSentence, formatTimeSpan, formatWholePrice } from "@/utils/sessionFormatting";

describe("formatTimeSpan", () => {
  it("shares the period when both times are in the same half of the day", () => {
    expect(formatTimeSpan("16:00", "17:00")).toBe("4:00 to 5:00 PM");
  });

  it("keeps both periods when the span crosses noon", () => {
    expect(formatTimeSpan("11:30:00", "12:30:00")).toBe("11:30 AM to 12:30 PM");
  });

  it("accepts ISO datetimes", () => {
    expect(formatTimeSpan("2026-03-09T10:00:00", "2026-03-09T10:45:00")).toBe("10:00 to 10:45 AM");
  });

  it("returns an empty string for invalid input", () => {
    expect(formatTimeSpan("nope", "17:00")).toBe("");
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
