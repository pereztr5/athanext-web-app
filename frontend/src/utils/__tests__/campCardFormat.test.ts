import { describe, expect, it } from "vitest";
import { formatDailyTime } from "@/components/camps/format";

describe("formatDailyTime", () => {
  it("labels the camp's clock", () => {
    expect(formatDailyTime("16:00", "17:30")).toMatch(/ ET$/);
    expect(formatDailyTime(null, null)).toBeFalsy();
  });
});
