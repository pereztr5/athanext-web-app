import { useMemo } from "react";
import { useFeeConfig } from "@/hooks/useFeeConfig";
import { useMyReferrals } from "@/hooks/useReferrals";
import type { PlanFees } from "@/utils/bookPlan";

/** Fees for planBooking: a confirmed referral waives that coach's platform fee for this family. */
export const useBookingFees = (athleteId: string | null | undefined): PlanFees => {
  const { config, error } = useFeeConfig();
  const { data: referrals } = useMyReferrals(athleteId ?? undefined);
  return useMemo(
    () => ({
      config,
      error,
      waived: new Set((referrals ?? []).filter((r) => r.status === "confirmed").map((r) => r.coach_id)),
    }),
    [config, error, referrals]
  );
};
