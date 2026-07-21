import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import {
  sanitizeHtml,
  isValidEmail,
  isValidPhoneNumber,
  calculateAge,
  isValidAge,
  truncateString,
} from "@/config/security";

describe("sanitizeHtml", () => {
  it("escapes HTML special characters including slash", () => {
    expect(sanitizeHtml('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;"
    );
  });
  it("escapes ampersand", () => expect(sanitizeHtml("a&b")).toBe("a&amp;b"));
  it("leaves plain text alone", () => expect(sanitizeHtml("hello")).toBe("hello"));
});

describe("isValidEmail (security.ts variant — trims and lowercases first)", () => {
  it("accepts padded, mixed-case emails", () => {
    expect(isValidEmail(" Foo@Bar.com ")).toBe(true);
  });
  it("rejects missing TLD dot", () => expect(isValidEmail("a@b")).toBe(false));
  it("rejects > 254 chars", () => {
    expect(isValidEmail("x".repeat(250) + "@b.co")).toBe(false);
  });
});

describe("isValidPhoneNumber", () => {
  it("accepts 10-digit strings", () => expect(isValidPhoneNumber("1234567890")).toBe(true));
  it("rejects letters and empty", () => {
    expect(isValidPhoneNumber("abc")).toBe(false);
    expect(isValidPhoneNumber("")).toBe(false);
  });
});

describe("calculateAge / isValidAge", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-20T12:00:00Z"));
  });
  afterAll(() => vi.useRealTimers());

  it("computes age from DOB", () => expect(calculateAge("2000-01-01")).toBe(26));
  it("returns null for invalid DOB", () => expect(calculateAge("nope")).toBeNull());
  it("accepts ages within [5, 120]", () => expect(isValidAge("2000-01-01")).toBe(true));
  it("rejects under MIN_AGE", () => expect(isValidAge("2024-01-01")).toBe(false));
  it("rejects invalid DOB", () => expect(isValidAge("nope")).toBe(false));
});

describe("truncateString", () => {
  it("truncates over-length strings", () => expect(truncateString("hello", 3)).toBe("hel"));
  it("leaves short strings alone", () => expect(truncateString("hi", 10)).toBe("hi"));
});
