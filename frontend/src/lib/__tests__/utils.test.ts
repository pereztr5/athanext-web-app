import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("keeps custom font sizes next to a text colour", () => {
    expect(cn("text-body-m", "text-[#1A202C]")).toBe("text-body-m text-[#1A202C]");
    expect(cn("text-subtitle text-[#767980]")).toBe("text-subtitle text-[#767980]");
  });

  it("still lets a later font size win", () => {
    expect(cn("text-body-m", "text-stat")).toBe("text-stat");
    expect(cn("text-sm", "text-card-title")).toBe("text-card-title");
  });
});
