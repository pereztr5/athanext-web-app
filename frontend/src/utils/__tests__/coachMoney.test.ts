import { describe, expect, it, vi } from "vitest";
import { COACH_MONEY_KEYS, invalidateCoachMoney } from "@/utils/coachMoney";

describe("invalidateCoachMoney", () => {
  it("invalidates every coach money query key", async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    await invalidateCoachMoney({ invalidateQueries } as never);
    expect(invalidateQueries.mock.calls.map((c) => c[0].queryKey)).toEqual(
      COACH_MONEY_KEYS.map((key) => [key]),
    );
  });
});
