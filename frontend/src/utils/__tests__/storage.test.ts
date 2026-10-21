import { describe, expect, it } from "vitest";
import { getStoragePathFromPublicUrl } from "../storage";

describe("getStoragePathFromPublicUrl", () => {
  const base = "https://x.supabase.co/storage/v1/object/public/athalink-images/";

  it("returns the object path", () => {
    expect(getStoragePathFromPublicUrl(`${base}athlete-profiles/u1-1.png`)).toBe("athlete-profiles/u1-1.png");
  });

  it("drops the cache-buster", () => {
    expect(getStoragePathFromPublicUrl(`${base}athlete-profiles/u1-1.png?v=123`)).toBe("athlete-profiles/u1-1.png");
  });

  it("ignores other URLs", () => {
    expect(getStoragePathFromPublicUrl("https://example.com/a.png")).toBeNull();
    expect(getStoragePathFromPublicUrl(null)).toBeNull();
  });
});
