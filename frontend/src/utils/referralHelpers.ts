// Mirrors the payments-row math in create-booking-payment:
// each fee is rounded to cents independently, then summed.
export type AttestationAnswer = "offline" | "platform" | "declined";
export type ReferralStatus =
  | "invited"
  | "pending_confirmation"
  | "confirmed"
  | "declined";

const round2 = (n: number) => Number(n.toFixed(2));

export const computeSessionPrice = (
  base: number,
  platformFeePerc: number,
  stripeFeePerc: number,
  platformFeeWaived = false,
) => {
  const platformFee = platformFeeWaived ? 0 : round2((base * platformFeePerc) / 100);
  const stripeFee = round2((base * stripeFeePerc) / 100);
  return { base, platformFee, stripeFee, total: round2(base + platformFee + stripeFee) };
};

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  invited: "Invited",
  pending_confirmation: "Pending confirmation",
  confirmed: "Confirmed",
  declined: "Declined",
};
