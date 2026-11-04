import { beforeEach, describe, expect, it } from "vitest";
import { forgetReturnPath, rememberReturnPath, takeReturnPath } from "@/utils/returnPath";

// The unit tests run without a browser: a minimal sessionStorage.
const store = new Map<string, string>();
globalThis.sessionStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
} as unknown as Storage;

describe("return path after sign-in", () => {
  beforeEach(() => forgetReturnPath());

  it("returns a shared session link once", () => {
    rememberReturnPath("/coach/michael-stone?session=abc");
    expect(takeReturnPath()).toBe("/coach/michael-stone?session=abc");
    expect(takeReturnPath()).toBeNull();
  });

  it("ignores other sites and the sign-in page itself", () => {
    rememberReturnPath("//evil.example/x");
    expect(takeReturnPath()).toBeNull();
    rememberReturnPath("https://evil.example/x");
    expect(takeReturnPath()).toBeNull();
    rememberReturnPath("/auth?mode=signin");
    expect(takeReturnPath()).toBeNull();
  });
});
