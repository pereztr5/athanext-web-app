import { describe, it, expect } from "vitest";
import {
  normalizePhone,
  capitalize,
  formatDateToUSA,
  capitalizeFirst,
  formatDateForInput,
  sanitizeTagsFromString,
  sanitizeImages,
  deriveInitials,
} from "@/utils/helperFunctions";
import { MAX_TAGS, MAX_COVER_IMAGES } from "@/utils/validations";

describe("normalizePhone", () => {
  it("strips non-digits and prefixes +", () => {
    expect(normalizePhone("(555) 123-4567")).toBe("+5551234567");
  });
  it("returns bare + for empty input", () => {
    expect(normalizePhone("")).toBe("+");
  });
  it("caps at 15 digits", () => {
    expect(normalizePhone("1".repeat(20))).toBe("+" + "1".repeat(15));
  });
});

describe("capitalize", () => {
  it("capitalizes first letter, lowercases rest", () => {
    expect(capitalize("HELLO")).toBe("Hello");
  });
  it("returns empty string for null/undefined", () => {
    expect(capitalize(null)).toBe("");
    expect(capitalize(undefined)).toBe("");
  });
});

describe("formatDateToUSA", () => {
  it("formats full ISO datetime (TZ=UTC)", () => {
    expect(formatDateToUSA("2026-07-20T12:00:00Z")).toBe("July 20, 2026");
  });
  it("returns empty string for invalid input", () => {
    expect(formatDateToUSA("garbage")).toBe("");
    expect(formatDateToUSA("")).toBe("");
  });
});

describe("capitalizeFirst", () => {
  it("capitalizes and replaces the FIRST hyphen only", () => {
    expect(capitalizeFirst("in-person")).toBe("In person");
    expect(capitalizeFirst("a-b-c")).toBe("A b-c"); // only first hyphen replaced
  });
});

describe("formatDateForInput", () => {
  it("formats as YYYY-MM-DD with zero padding", () => {
    expect(formatDateForInput(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("sanitizeTagsFromString", () => {
  it("splits lines and drops empties", () => {
    expect(sanitizeTagsFromString("speed\ndribbling\n\n")).toEqual(["speed", "dribbling"]);
  });
  it("HTML-escapes tag content via sanitizeHtml", () => {
    expect(sanitizeTagsFromString("<b>fast</b>")).toEqual(["&lt;b&gt;fast&lt;&#x2F;b&gt;"]);
  });
  it("caps at MAX_TAGS", () => {
    const many = Array.from({ length: MAX_TAGS + 5 }, (_, i) => `tag${i}`).join("\n");
    expect(sanitizeTagsFromString(many)).toHaveLength(MAX_TAGS);
  });
  it("returns [] for non-string input", () => {
    expect(sanitizeTagsFromString(123 as never)).toEqual([]);
  });
});

describe("sanitizeImages", () => {
  it("trims, drops empties/non-strings, caps at MAX_COVER_IMAGES", () => {
    expect(sanitizeImages([" a.png ", "", 3 as never])).toEqual(["a.png"]);
    const many = Array.from({ length: MAX_COVER_IMAGES + 3 }, (_, i) => `${i}.png`);
    expect(sanitizeImages(many)).toHaveLength(MAX_COVER_IMAGES);
  });
});

describe("deriveInitials", () => {
  it("uses first and last word initials", () => {
    expect(deriveInitials("Daniel Villafuerte")).toBe("DV");
    expect(deriveInitials(" a  b  c ")).toBe("AC");
  });
  it("uses first two letters for single word", () => {
    expect(deriveInitials("cher")).toBe("CH");
  });
  it("returns empty for empty/null", () => {
    expect(deriveInitials("")).toBe("");
    expect(deriveInitials(null)).toBe("");
  });
});
