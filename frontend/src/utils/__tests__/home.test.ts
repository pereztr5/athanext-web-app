import { describe, it, expect } from "vitest";
import { periodTotals } from "@/utils/home";

const days = (amounts: number[]) => amounts.map((amount, i) => ({ date: `2026-10-${String(i + 1).padStart(2, "0")}`, amount }));

describe("periodTotals", () => {
  it("compares the chosen period with the one before it", () => {
    expect(periodTotals(days([10, 10, 10, 20, 20, 20]), 3)).toEqual({ current: 60, previous: 30, change: 100 });
    expect(periodTotals(days([40, 20]), 1)).toEqual({ current: 20, previous: 40, change: -50 });
  });

  it("has no change when there was nothing before", () => {
    expect(periodTotals(days([0, 0, 5, 5]), 2)).toEqual({ current: 10, previous: 0, change: null });
  });
});
