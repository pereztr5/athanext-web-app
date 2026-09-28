import { describe, expect, it } from "vitest";
import {
  coachPricingPath,
  coachProfilePath,
  coachPricingLinkLabel,
  coachPublicLinkLabel,
  isCoachUuid,
} from "@/utils/coachSlug";

describe("coachSlug helpers", () => {
  it("detects uuids", () => {
    expect(isCoachUuid("a1111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isCoachUuid("michael-stone")).toBe(false);
  });

  it("builds public paths and labels", () => {
    expect(coachProfilePath("michael-stone")).toBe("/coach/michael-stone");
    expect(coachPricingPath("michael-stone")).toBe("/coach/michael-stone/pricing");
    expect(coachPublicLinkLabel("michael-stone")).toBe("athanext.com/michael-stone");
    expect(coachPricingLinkLabel("michael-stone")).toBe(
      "athanext.com/michael-stone/pricing"
    );
  });
});
