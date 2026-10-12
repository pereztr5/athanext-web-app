import type { OpenInvite, OpenInviteStatus } from "@/api/roster";
import type { CoachClientReferral } from "@/api/referrals";
import { isAwaitingCoachApproval, isInviteExpired, isOpenInvite } from "@/utils/referralHelpers";

/** Invites tab on My Athletes. Same as ROUTES.ATHLETES?tab=invites; avoid circular routes import. */
export const INVITES_PATH = "/athletes?tab=invites";
export const OPEN_INVITES_KEY = ["coach-open-invites"] as const;

export const INVITE_STATUS: Record<OpenInviteStatus, { text: string; action: string; primary?: boolean }> = {
  approval: { text: "Signed up through your link, needs approval", action: "Approve", primary: true },
  bounced: { text: "Email bounced", action: "Fix email" },
  opened: { text: "Opened the invite, not joined yet", action: "Resend" },
  // Opens aren't tracked for plain invites, so this doesn't claim "not opened".
  sent: { text: "Invite sent, not joined yet", action: "Resend" },
};

/** "for Ava, 13 · Email bounced". */
export const inviteLine = (invite: OpenInvite) =>
  [invite.athlete ? `for ${invite.athlete}${invite.age != null ? `, ${invite.age}` : ""}` : null, INVITE_STATUS[invite.status].text]
    .filter(Boolean)
    .join(" · ");

/** Open invites from the coach's referral rows, used until get_coach_open_invites answers. */
export const invitesFromReferrals = (rows: CoachClientReferral[]): OpenInvite[] =>
  rows
    .filter((r) => isAwaitingCoachApproval(r) || (isOpenInvite(r) && !isInviteExpired(r)))
    .map((r): OpenInvite => ({
      id: r.id,
      parent: r.client_name || r.client_email,
      email: r.client_email,
      athlete: r.athlete_first_name || null,
      age: null,
      status: isAwaitingCoachApproval(r) ? "approval" : r.status === "invited" ? "sent" : "opened",
    }))
    .sort((a, b) => Number(b.status === "approval") - Number(a.status === "approval"));
