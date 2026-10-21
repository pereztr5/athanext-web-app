import { describe, it, expect } from "vitest";
import { SESSION_LENGTHS, lengthLabel, lengthOptions, missingFields, missingLine, plainError } from "@/utils/sessionForm";

describe("session lengths", () => {
  it("is one list from 30 minutes to 3 hours", () => {
    expect([...SESSION_LENGTHS]).toEqual([30, 45, 60, 75, 90, 120, 150, 180]);
  });

  it("labels each length", () => {
    expect(SESSION_LENGTHS.map(lengthLabel)).toEqual([
      "30 min", "45 min", "60 min", "75 min", "90 min", "2 hours", "2 hr 30 min", "3 hours",
    ]);
  });

  it("keeps a saved length that isn't in the list", () => {
    expect(lengthOptions(100)).toEqual([30, 45, 60, 75, 90, 100, 120, 150, 180]);
    expect(lengthOptions(60)).toEqual([...SESSION_LENGTHS]);
  });
});

describe("what's missing", () => {
  it("lists the failed checks in order", () => {
    expect(missingFields([["a time", false], ["a name", true], ["a price", false]])).toEqual(["a time", "a price"]);
  });

  it("writes the line above the button", () => {
    expect(missingLine([])).toBe("");
    expect(missingLine(["a time"])).toBe("Still missing: a time.");
    expect(missingLine(["a time", "a name", "a price"])).toBe("Still missing: a time, a name and a price.");
  });
});

describe("plainError", () => {
  it("passes server sentences through", () => {
    expect(plainError({ message: "Pick a time that hasn't passed" })).toBe("Pick a time that hasn't passed.");
    expect(plainError(new Error("Name the group session."))).toBe("Name the group session.");
  });

  it("puts technical errors in plain words", () => {
    expect(plainError(new TypeError("Failed to fetch"))).toMatch(/offline/);
    expect(plainError({ message: 'new row violates check constraint "x"' })).toMatch(/isn't allowed/);
    expect(plainError({ message: "JWT expired" })).toMatch(/signed out/);
  });

  it("falls back when there's nothing readable", () => {
    expect(plainError(null)).toBe("That didn't go through. Try again.");
    expect(plainError({}, "Couldn't save.")).toBe("Couldn't save.");
  });
});
