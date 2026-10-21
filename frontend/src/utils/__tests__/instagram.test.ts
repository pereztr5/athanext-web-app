import { describe, it, expect } from "vitest";
import { instagramUrl, normalizeInstagramHandle } from "@/utils/instagram";

describe("instagram", () => {
  it("reads the handle from every form a coach might paste", () => {
    expect(normalizeInstagramHandle("@jane.doe_10")).toBe("jane.doe_10");
    expect(normalizeInstagramHandle("jane.doe_10")).toBe("jane.doe_10");
    expect(normalizeInstagramHandle("  @Jane_Doe  ")).toBe("Jane_Doe");
    expect(normalizeInstagramHandle("instagram.com/jane.doe_10")).toBe("jane.doe_10");
    expect(normalizeInstagramHandle("www.instagram.com/jane.doe_10/")).toBe("jane.doe_10");
    expect(normalizeInstagramHandle("https://www.instagram.com/jane.doe_10/?hl=en")).toBe("jane.doe_10");
    expect(normalizeInstagramHandle("http://instagram.com/jane.doe_10#top")).toBe("jane.doe_10");
    expect(normalizeInstagramHandle("https://m.instagram.com/jane.doe_10")).toBe("jane.doe_10");
  });

  it("rejects anything that isn't a handle or profile link", () => {
    expect(normalizeInstagramHandle("")).toBeNull();
    expect(normalizeInstagramHandle("   ")).toBeNull();
    expect(normalizeInstagramHandle(null)).toBeNull();
    expect(normalizeInstagramHandle("jane doe")).toBeNull();
    expect(normalizeInstagramHandle("jane-doe")).toBeNull();
    expect(normalizeInstagramHandle("@")).toBeNull();
    expect(normalizeInstagramHandle("a".repeat(31))).toBeNull();
    expect(normalizeInstagramHandle("a".repeat(30))).toBe("a".repeat(30));
    expect(normalizeInstagramHandle(".jane")).toBeNull();
    expect(normalizeInstagramHandle("jane.")).toBeNull();
    expect(normalizeInstagramHandle("ja..ne")).toBeNull();
    expect(normalizeInstagramHandle("https://www.instagram.com/")).toBeNull();
    expect(normalizeInstagramHandle("https://www.instagram.com/p/C1abc/")).toBeNull();
    expect(normalizeInstagramHandle("https://notinstagram.com/jane")).toBeNull();
    expect(normalizeInstagramHandle("https://instagram.com.evil.io/jane")).toBeNull();
  });

  it("builds the profile URL", () => {
    expect(instagramUrl("@jane.doe_10")).toBe("https://www.instagram.com/jane.doe_10");
    expect(instagramUrl("evbgk1")).toBe("https://www.instagram.com/evbgk1");
    expect(instagramUrl("not valid")).toBeNull();
    expect(instagramUrl(undefined)).toBeNull();
  });
});
