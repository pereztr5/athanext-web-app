// Auth, email confirmation, and Google OAuth read this key to route an invited
// athlete back to /invite/:token after they sign up or log in.
export const INVITE_TOKEN_STORAGE_KEY = "ccr_invite_token";

export const inviteLinkFor = (token: string) => `${window.location.origin}/invite/${token}`;

export type AttestationAnswer = "offline" | "platform" | "declined";
export type ReferralStatus =
  | "invited"
  | "pending_confirmation"
  | "confirmed"
  | "declined";

const round2 = (n: number) => Number(n.toFixed(2));

// `total` mirrors the Stripe line item in create-booking-payment exactly:
// unit_amount = Math.round(price * (1 + platform% + stripe%) * 100). The fee
// breakdown is display-only; the Stripe fee absorbs any rounding cent so the
// parts always add up to what the athlete is charged.
export const computeSessionPrice = (
  base: number,
  platformFeePerc: number,
  stripeFeePerc: number,
  platformFeeWaived = false,
) => {
  const effectivePlatformPerc = platformFeeWaived ? 0 : platformFeePerc;
  const total = Math.round(base * (1 + effectivePlatformPerc / 100 + stripeFeePerc / 100) * 100) / 100;
  const platformFee = round2((base * effectivePlatformPerc) / 100);
  const stripeFee = round2(total - base - platformFee);
  return { base, platformFee, stripeFee, total };
};

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  invited: "Invited",
  pending_confirmation: "Pending confirmation",
  confirmed: "Confirmed",
  declined: "Declined",
};

/** An invite the athlete has not answered yet (the link still works until it expires). */
export const isOpenInvite = (r: {
  status: ReferralStatus;
  initiated_by: string;
  athlete_id: string | null;
}) =>
  r.initiated_by !== "athlete" &&
  (r.status === "invited" ||
    r.status === "pending_confirmation" ||
    (r.status === "confirmed" && !r.athlete_id));

export const isInviteExpired = (r: { expires_at: string | null }) =>
  Boolean(r.expires_at && new Date(r.expires_at).getTime() < Date.now());

export const referralStatusLabel = (r: {
  status: ReferralStatus;
  initiated_by: string;
  athlete_id: string | null;
  expires_at: string | null;
}) => {
  if (isOpenInvite(r) && isInviteExpired(r)) return "Expired";
  if (r.status === "confirmed" && !r.athlete_id) return "Confirmed · awaiting signup";
  return REFERRAL_STATUS_LABELS[r.status];
};

/** Raised by claim_coach_referral; anything else falls back to a generic message. */
export const CLAIM_ERROR_MESSAGES: Record<string, string> = {
  invite_not_found: "This invite link has already been used or is no longer valid.",
  invite_already_claimed: "This invite has already been used.",
  invite_expired: "This invite has expired. Ask your coach to resend it.",
  email_mismatch: "This invite was sent to a different email address.",
  no_athlete_profile: "Sign in with an athlete account to accept this invite.",
};

export const claimErrorMessage = (message: string | undefined) => {
  const key = Object.keys(CLAIM_ERROR_MESSAGES).find((k) => message?.includes(k));
  return key ? CLAIM_ERROR_MESSAGES[key] : "Could not accept this invite. Please try again.";
};
