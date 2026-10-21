import { describe, it, expect } from "vitest";
import { rollCallCount, rollCallLine, scoreWord } from "@/utils/feedback";

describe("scoreWord", () => {
  it("names each band of the 0 to 10 score", () => {
    expect([1, 3, 4, 5, 6, 7, 8, 9, 10].map(scoreWord)).toEqual([
      "Rough", "Rough", "Okay", "Okay", "Good", "Good", "Great", "Great", "Excellent",
    ]);
  });
});

describe("rollCallCount", () => {
  it("says the count in words", () => {
    expect(rollCallCount(6, 0)).toBe("All 6 here");
    expect(rollCallCount(6, 1)).toBe("5 here · 1 missed");
    expect(rollCallCount(6, 6)).toBe("Nobody came");
    expect(rollCallCount(1, 0)).toBe("1 here");
    expect(rollCallCount(0, 0)).toBe("No athletes");
  });
});

describe("rollCallLine", () => {
  it("says who gets the summary and the notes", () => {
    expect(rollCallLine({ cameCount: 6, missedNames: [], missedGetsShortMessage: true })).toBe(
      "Your summary goes to every family. Notes below are only for the 6 athletes who came."
    );
  });

  it("matches the spec wording when missed families still get the summary", () => {
    expect(rollCallLine({ cameCount: 5, missedNames: ["Maya"], missedGetsShortMessage: false })).toBe(
      "Your summary goes to every family. Notes below are only for the 5 athletes who came. Maya is marked as missed."
    );
  });

  it("tells the coach missed families get the short message instead", () => {
    expect(rollCallLine({ cameCount: 4, missedNames: ["Maya", "Leo"], missedGetsShortMessage: true })).toBe(
      'Your summary goes to the families of the 4 athletes who came. Notes below are only for the 4 athletes who came. Maya and Leo are marked as missed, so their families get a short "missed this session" message instead.'
    );
  });

  it("covers nobody coming", () => {
    expect(rollCallLine({ cameCount: 0, missedNames: ["Maya"], missedGetsShortMessage: true })).toMatch(/^Nobody came\./);
  });
});
