import { describe, it, expect } from "vitest";
import { isValidE164, parsePhone, toE164 } from "@/utils/phone";

describe("toE164", () => {
  it("prefixes the country dial code and strips formatting", () => {
    expect(toE164("US", "(555) 123-4567")).toBe("+15551234567");
  });
  it("drops the national trunk 0", () => {
    expect(toE164("GB", "07911 123456")).toBe("+447911123456");
  });
  it("keeps the leading 0 for Italy", () => {
    expect(toE164("IT", "06 1234 5678")).toBe("+390612345678");
  });
  it("returns empty string when no number was typed", () => {
    expect(toE164("US", "")).toBe("");
    expect(toE164("US", " - ")).toBe("");
  });
});

describe("parsePhone", () => {
  it("defaults +1 to the US", () => {
    expect(parsePhone("+15551234567")).toEqual({ iso: "US", national: "5551234567" });
  });
  it("keeps the current country when it shares the dial code", () => {
    expect(parsePhone("+15551234567", "CA")).toEqual({ iso: "CA", national: "5551234567" });
  });
  it("prefers the longest matching dial code", () => {
    expect(parsePhone("+353861234567")).toEqual({ iso: "IE", national: "861234567" });
    expect(parsePhone("+998901234567")).toEqual({ iso: "UZ", national: "901234567" });
  });
  it("treats legacy values without + as a national number", () => {
    expect(parsePhone("123-456-7890")).toEqual({ iso: "US", national: "1234567890" });
  });
  it("handles empty values", () => {
    expect(parsePhone(null)).toEqual({ iso: "US", national: "" });
  });
  it("round-trips with toE164", () => {
    const { iso, national } = parsePhone("+447911123456");
    expect(toE164(iso, national)).toBe("+447911123456");
  });
});

describe("isValidE164", () => {
  it("accepts 8 to 15 digits after +", () => {
    expect(isValidE164("+15551234567")).toBe(true);
    expect(isValidE164("+1555")).toBe(false);
    expect(isValidE164("+1234567890123456")).toBe(false);
    expect(isValidE164("5551234567")).toBe(false);
  });
});

describe("phone edge cases", () => {
  it("drops a leading country 1 on US numbers", async () => {
    const { toE164 } = await import("@/utils/phone");
    expect(toE164("US", "1 555 123 4567")).toBe("+15551234567");
  });
  it("does not silently truncate long numbers", async () => {
    const { toE164, isValidE164 } = await import("@/utils/phone");
    const value = toE164("GB", "7911 123456 78901");
    expect(isValidE164(value)).toBe(false);
  });
  it("normalizes legacy stored values", async () => {
    const { normalizeStoredPhone } = await import("@/utils/phone");
    expect(normalizeStoredPhone("123-456-7890")).toBe("+11234567890");
    expect(normalizeStoredPhone("+")).toBe("");
    expect(normalizeStoredPhone("+447911123456")).toBe("+447911123456");
  });
});
