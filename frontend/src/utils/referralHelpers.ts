// Auth, email confirmation, and Google OAuth read this key to route an invited
// athlete back to /invite/:token after they sign up or log in.
export const INVITE_TOKEN_STORAGE_KEY = "ccr_invite_token";

// Sign-ups through a coach's share link (ATH-78) keep the coach here until the profile is
// complete, then ask to join their roster. The coach approves on My Clients.
export const JOIN_COACH_STORAGE_KEY = "ccr_join_coach";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The share-link coach from the URL (saved for after email confirmation) or from earlier. */
export const readJoinCoach = (fromUrl: string | null): string | null => {
  try {
    if (fromUrl && UUID_RE.test(fromUrl)) {
      localStorage.setItem(JOIN_COACH_STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    const saved = localStorage.getItem(JOIN_COACH_STORAGE_KEY);
    return saved && UUID_RE.test(saved) ? saved : null;
  } catch {
    return fromUrl && UUID_RE.test(fromUrl) ? fromUrl : null;
  }
};

export const clearJoinCoach = () => {
  try {
    localStorage.removeItem(JOIN_COACH_STORAGE_KEY);
  } catch {
    // Storage can be blocked; the referral already exists.
  }
};

export const joinLinkFor = (coachId: string) =>
  `${window.location.origin}/auth?mode=signup&coach=${coachId}`;

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

/**
 * "$50.00 session + $5.00 platform fee + $1.65 processing fee", adding up to
 * computeSessionPrice's total: the last fee shown absorbs any rounding cent.
 */
export const formatPriceBreakdown = (
  base: number,
  platformFeePerc: number,
  stripeFeePerc: number,
  platformFeeWaived = false,
) => {
  const money = (value: number) => `$${value.toFixed(2)}`;
  const roundCents = (value: number) => Math.round(value * 100) / 100;
  const price = computeSessionPrice(base, platformFeePerc, stripeFeePerc, platformFeeWaived);
  const hasProcessingFee = stripeFeePerc > 0;
  const platformFee = hasProcessingFee ? price.platformFee : roundCents(price.total - base);
  const platformPart = platformFeeWaived ? "no platform fee (existing client)" : `${money(platformFee)} platform fee`;
  const processingPart = hasProcessingFee ? ` + ${money(roundCents(price.total - base - price.platformFee))} processing fee` : "";
  return `${money(base)} session + ${platformPart}${processingPart}`;
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

/** A family who asked to join (share link or sign-up) and waits for the coach to approve. */
export const isAwaitingCoachApproval = (r: { status: ReferralStatus; initiated_by: string }) =>
  r.initiated_by === "athlete" && r.status === "pending_confirmation";

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

// Unpaid checkouts and requests the coach hasn't accepted aren't bookings yet.
const INACTIVE_BOOKING_STATUSES = new Set(["canceled", "refunded", "pending_payment", "requested"]);

/**
 * Coaches the athlete has a confirmed booking with, minus coaches already listed
 * through a pending/confirmed referral (the referral row wins). First-seen order.
 */
export const bookedOnlyCoaches = (
  sessions: {
    coachId: string;
    coachName?: string | null;
    dbStatus: string;
    computedStatus: string;
  }[],
  referrals: { coach_id: string; status: ReferralStatus }[],
) => {
  const listed = new Set(
    referrals
      .filter((r) => r.status === "pending_confirmation" || r.status === "confirmed")
      .map((r) => r.coach_id),
  );
  const booked = new Map<string, { coachId: string; coachName: string | null }>();
  for (const s of sessions) {
    if (!s.coachId || listed.has(s.coachId)) continue;
    if (INACTIVE_BOOKING_STATUSES.has(s.dbStatus) || s.computedStatus === "canceled") continue;
    const existing = booked.get(s.coachId);
    if (!existing) booked.set(s.coachId, { coachId: s.coachId, coachName: s.coachName ?? null });
    else if (!existing.coachName && s.coachName) existing.coachName = s.coachName;
  }
  return [...booked.values()];
};
