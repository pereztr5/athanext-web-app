import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import {
  contactFormSchema,
  sanitizeInput,
  checkRateLimit,
  setRateLimit,
  isValidEmail,
} from "@/utils/contactValidation";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
});

describe("contactFormSchema", () => {
  const valid = {
    fullName: "Jane Doe",
    email: "JANE@Example.com",
    subject: "Hello there",
    message: "This is a valid message body.",
  };

  it("accepts a valid submission and lowercases email", () => {
    const result = contactFormSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("jane@example.com");
  });
  it("rejects script tags in message", () => {
    expect(contactFormSchema.safeParse({ ...valid, message: "hi <script>alert(1)</script> there" }).success).toBe(false);
  });
  it("rejects @ in subject (regex allowlist)", () => {
    expect(contactFormSchema.safeParse({ ...valid, subject: "hi @you" }).success).toBe(false);
  });
  it("rejects digits in name", () => {
    expect(contactFormSchema.safeParse({ ...valid, fullName: "Jane 2" }).success).toBe(false);
  });
});

describe("sanitizeInput", () => {
  it("escapes angle brackets, quotes and slashes — but NOT ampersand", () => {
    expect(sanitizeInput('<a href="x">')).toBe("&lt;a href=&quot;x&quot;&gt;");
    expect(sanitizeInput("a&b")).toBe("a&b");
  });
  it("trims and handles null-ish", () => {
    expect(sanitizeInput("  hi  ")).toBe("hi");
    expect(sanitizeInput(null as never)).toBe("");
  });
});

describe("checkRateLimit / setRateLimit", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-20T12:00:00Z"));
  });
  afterAll(() => vi.useRealTimers());
  beforeEach(() => store.clear());

  it("allows when no prior submission", () => {
    expect(checkRateLimit("k")).toBe(true);
  });
  it("blocks within the window and allows after it", () => {
    setRateLimit("k");
    expect(checkRateLimit("k", 5)).toBe(false);
    vi.advanceTimersByTime(6 * 60 * 1000);
    expect(checkRateLimit("k", 5)).toBe(true);
  });
  it("fails open when storage throws", () => {
    const spy = vi.spyOn(globalThis.localStorage, "getItem").mockImplementation(() => {
      throw new Error("boom");
    });
    expect(checkRateLimit("k")).toBe(true);
    spy.mockRestore();
  });
});

describe("isValidEmail (contactValidation variant)", () => {
  it("accepts simple emails", () => expect(isValidEmail("a@b.co")).toBe(true));
  it("rejects double @", () => expect(isValidEmail("a@@b.co")).toBe(false));
});
