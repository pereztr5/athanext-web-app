import { describe, expect, it } from "vitest";
import { isPublicCoachRatingVisible, publicCoachRatingLabel } from "@/utils/publicRating";

describe("public coach rating", () => {
  it("stays New until three athlete ratings", () => {
    expect(publicCoachRatingLabel(5, 0)).toBe("New");
    expect(publicCoachRatingLabel(5, 2)).toBe("New");
    expect(isPublicCoachRatingVisible(2, 5)).toBe(false);
  });

  it("shows the average once three athlete ratings exist", () => {
    expect(publicCoachRatingLabel(4.5, 3)).toBe("4.5");
    expect(isPublicCoachRatingVisible(3, 4.5)).toBe(true);
  });

  it("stays New when the stored score is empty", () => {
    expect(publicCoachRatingLabel(null, 8)).toBe("New");
    expect(publicCoachRatingLabel(0, undefined)).toBe("New");
  });
});
