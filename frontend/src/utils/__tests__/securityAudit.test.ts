import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { SecurityAudit } from "@/utils/securityAudit";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
});

describe("SecurityAudit.validateInput", () => {
  it("rejects XSS patterns", () => {
    expect(SecurityAudit.validateInput("<script>x")).toBe(false);
    expect(SecurityAudit.validateInput("javascript:void(0)")).toBe(false);
  });
  it("rejects SQL patterns", () => {
    expect(SecurityAudit.validateInput("union select a from b")).toBe(false);
  });
  it("accepts plain text", () => {
    expect(SecurityAudit.validateInput("hello world")).toBe(true);
  });
  it("validates email type", () => {
    expect(SecurityAudit.validateInput("a@b.c", "email")).toBe(true);
    expect(SecurityAudit.validateInput("nope", "email")).toBe(false);
  });
  it("validates phone type (10-20 chars of digits/space/dash/parens)", () => {
    expect(SecurityAudit.validateInput("+1 555-123-4567", "phone")).toBe(true);
    expect(SecurityAudit.validateInput("123", "phone")).toBe(false);
  });
});

describe("SecurityAudit.checkRateLimit", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-20T12:00:00Z"));
  });
  afterAll(() => vi.useRealTimers());
  beforeEach(() => store.clear());

  it("allows up to maxAttempts within the window, then blocks", () => {
    expect(SecurityAudit.checkRateLimit("act", 2, 60000)).toBe(true);
    expect(SecurityAudit.checkRateLimit("act", 2, 60000)).toBe(true);
    expect(SecurityAudit.checkRateLimit("act", 2, 60000)).toBe(false);
  });
  it("allows again after the window passes", () => {
    SecurityAudit.checkRateLimit("act", 1, 60000);
    expect(SecurityAudit.checkRateLimit("act", 1, 60000)).toBe(false);
    vi.advanceTimersByTime(61000);
    expect(SecurityAudit.checkRateLimit("act", 1, 60000)).toBe(true);
  });
  it("clearRateLimit resets the counter", () => {
    SecurityAudit.checkRateLimit("act", 1, 60000);
    SecurityAudit.clearRateLimit("act");
    expect(SecurityAudit.checkRateLimit("act", 1, 60000)).toBe(true);
  });
});
