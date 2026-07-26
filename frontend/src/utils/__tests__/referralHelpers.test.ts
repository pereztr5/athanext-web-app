import { describe, expect, it } from "vitest";
import { computeSessionPrice } from "../referralHelpers";

describe("computeSessionPrice", () => {
  it("applies platform and stripe fees like the payments row", () => {
    const p = computeSessionPrice(100, 10, 2.9);
    expect(p).toEqual({ base: 100, platformFee: 10, stripeFee: 2.9, total: 112.9 });
  });

  it("zeroes only the platform fee when waived", () => {
    const p = computeSessionPrice(100, 10, 2.9, true);
    expect(p).toEqual({ base: 100, platformFee: 0, stripeFee: 2.9, total: 102.9 });
  });

  it("rounds each fee to cents before summing", () => {
    const p = computeSessionPrice(33.33, 10, 2.9);
    expect(p.platformFee).toBe(3.33);
    expect(p.stripeFee).toBe(0.97);
    expect(p.total).toBe(37.63);
  });

  it("handles zero percentages (config missing defaults to 0)", () => {
    expect(computeSessionPrice(50, 0, 0)).toEqual({
      base: 50, platformFee: 0, stripeFee: 0, total: 50,
    });
  });
});
