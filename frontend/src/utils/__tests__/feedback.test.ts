import { describe, it, expect } from "vitest";
import { scoreWord } from "@/utils/feedback";

describe("scoreWord", () => {
  it("names each band of the 0 to 10 score", () => {
    expect([1, 3, 4, 5, 6, 7, 8, 9, 10].map(scoreWord)).toEqual([
      "Rough", "Rough", "Okay", "Okay", "Good", "Good", "Great", "Great", "Excellent",
    ]);
  });
});
