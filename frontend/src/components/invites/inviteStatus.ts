/** How a referral row reads on the Invites page (Working Copy `c-invites`). */
import type { BrandPillTone } from "@/components/brand";
import type { CoachInviteRow } from "@/api/referrals";
import { isInviteExpired, isOpenInvite } from "@/utils/referralHelpers";

export type InviteStatus = "sent" | "opened" | "expired" | "bounced" | "approval" | "marketplace" | "joined" | "declined";
export type InviteFilter = "all" | "waiting" | "approval" | "joined";

export const INVITE_STATUS: Record<InviteStatus, [string, BrandPillTone]> = {
  sent: ["Invite sent", "neutral"],
  opened: ["Opened", "neutral"],
  expired: ["Invite expired", "neutral"],
  bounced: ["Email bounced", "red"],
  approval: ["Needs approval", "amber"],
  marketplace: ["Marketplace client", "neutral"],
  joined: ["Joined", "green"],
  declined: ["Declined", "neutral"],
};

export const INVITE_FILTERS: [InviteFilter, string][] = [
  ["all", "All"],
  ["waiting", "Waiting"],
  ["approval", "Needs approval"],
  ["joined", "Joined"],
];

export const inviteStatus = (r: CoachInviteRow): InviteStatus => {
  if (r.initiated_by === "athlete" && r.status === "pending_confirmation") return "approval";
  if (r.status === "confirmed" && r.athlete_id) return "joined";
  // A family who first booked on the marketplace answers "platform" and keeps the standard fee.
  if (r.status === "declined") return r.relationship_source === "platform" ? "marketplace" : "declined";
  if (isOpenInvite(r)) {
    if (r.email_bounced_at) return "bounced";
    if (isInviteExpired(r)) return "expired";
    if (r.opened_at) return "opened";
  }
  return "sent";
};

export const matchesFilter = (status: InviteStatus, filter: InviteFilter) =>
  filter === "all" ||
  (filter === "waiting" && (status === "sent" || status === "opened" || status === "bounced" || status === "expired")) ||
  (filter === "approval" && status === "approval") ||
  (filter === "joined" && (status === "joined" || status === "marketplace"));

export const inviteCounts = (statuses: InviteStatus[]) => ({
  total: statuses.length,
  joined: statuses.filter((s) => s === "joined" || s === "marketplace").length,
  waiting: statuses.filter((s) => s === "sent" || s === "opened").length,
  approval: statuses.filter((s) => s === "approval").length,
});

export const viaLabel = (r: CoachInviteRow) => {
  const via = r.invited_via ?? (r.initiated_by === "athlete" ? "link" : r.initiated_by === "admin" ? "admin" : "email");
  return via === "link" ? "Link" : via === "import" ? "Import" : via === "admin" ? "AthaNext team" : "Email";
};

export const parentName = (r: CoachInviteRow) => r.client_name?.trim() || r.client_email;

export const athleteFirst = (r: CoachInviteRow) =>
  r.athlete_first_name?.trim() || r.athlete_name?.split(" ")[0] || null;

const dayLabel = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** The line under the parent: "Leo, 12", the bounced email, or the marketplace note. */
export const inviteSubline = (r: CoachInviteRow, status: InviteStatus) => {
  if (status === "bounced") return r.client_email;
  if (status === "marketplace" && r.marketplace_since) return `Booked you on the marketplace ${dayLabel(r.marketplace_since)}`;
  const athlete = athleteFirst(r);
  if (!athlete) return r.client_name ? r.client_email : "Athlete not added yet";
  return r.athlete_age != null ? `${athlete}, ${r.athlete_age}` : athlete;
};

export const updatedAt = (r: CoachInviteRow) =>
  r.updated_at ?? [r.confirmed_at, r.opened_at, r.created_at].filter(Boolean).sort().pop() ?? r.created_at;

/** "Today", "Yesterday" or "Thu, Sep 24", in the viewer's local calendar. */
export const relativeDay = (iso: string, now = new Date()) => {
  const at = new Date(iso);
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(now) - day(at)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return at.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};
