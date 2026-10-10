import { useMemo } from "react";
import { useFeeConfig } from "@/hooks/useFeeConfig";
import { useMyReferrals } from "@/hooks/useReferrals";
import type { PlanFees } from "@/utils/bookPlan";

/** Fees for planBooking: a confirmed referral waives that coach's platform fee for this family. */
export const useBookingFees = (athleteId: string | null | undefined): PlanFees => {
  const { platformFeePerc, stripeFeePerc } = useFeeConfig();
  const { data: referrals } = useMyReferrals(athleteId ?? undefined);
  return useMemo(
    () => ({
      platformPerc: platformFeePerc,
      stripePerc: stripeFeePerc,
      waived: new Set((referrals ?? []).filter((r) => r.status === "confirmed").map((r) => r.coach_id)),
    }),
    [platformFeePerc, stripeFeePerc, referrals]
  );
};
