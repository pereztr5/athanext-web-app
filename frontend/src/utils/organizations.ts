/**
 * Organizations (ATH-90): the owner's numbers. Org share is worked out on the session price
 * (what families paid, after AthaNext fees). The owner's own sessions stay 100% theirs.
 */

export interface OrgCoach {
  coachId: string;
  name: string;
  slug: string | null;
  photo: string | null;
  /** Their usual session price, for the split example. */
  hourlyRate: number;
  isOwner: boolean;
  /** % of each paid session to the org; null for the owner. */
  rate: number | null;
  /** A new rate waiting for the coach to accept. */
  pendingRate: number | null;
  shown: boolean;
  joinedAt: string;
  pillars: string[];
}

export interface OrgPricing {
  name: string;
  who: string;
  price: string;
  unit: string;
}

export interface OrgInvite {
  id: string;
  email: string;
  rate: number;
  sentAt: string;
}

export interface MyOrganization {
  id: string;
  name: string;
  slug: string;
  line: string;
  about: string;
  logoUrl: string | null;
  pricing: OrgPricing[];
  coaches: OrgCoach[];
  invites: OrgInvite[];
}

export interface OrgSession {
  id: string;
  coachId: string;
  date: string;
  startTime: string;
  endTime: string;
  type: "individual" | "group";
  name: string;
  pillar: string | null;
  capacity: number;
  price: number;
  athletes: number;
  came: number;
  marked: boolean;
  noShow: boolean;
  /** Paid in the app for this session. */
  paid: number;
  /** Org share of `paid`, at the rate in effect when each booking was made. */
  toOrg: number;
}

export interface OrgCoachRow {
  coach: OrgCoach;
  sessions: number;
  broughtIn: number;
  toOrg: number;
}

export const ABOUT_MAX = 280;

export const money = (value: number) =>
  Math.round(value * 100) % 100
    ? `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${Math.round(value).toLocaleString("en-US")}`;

export const rateLabel = (rate: number) => `${Number(rate.toFixed(2))}%`;

export const monthKey = (iso: string) => iso.slice(0, 7);

/** One row per coach for the given sessions, in the org's coach order. */
export const coachRows = (coaches: OrgCoach[], sessions: OrgSession[]): OrgCoachRow[] =>
  coaches.map((coach) => {
    const mine = sessions.filter((s) => s.coachId === coach.coachId);
    return {
      coach,
      sessions: mine.length,
      broughtIn: mine.reduce((sum, s) => sum + s.paid, 0),
      toOrg: mine.reduce((sum, s) => sum + s.toOrg, 0),
    };
  });

export const orgTotals = (rows: OrgCoachRow[]) => {
  const others = rows.filter((r) => !r.coach.isOwner);
  const own = rows.filter((r) => r.coach.isOwner).reduce((sum, r) => sum + r.broughtIn, 0);
  const share = others.reduce((sum, r) => sum + r.toOrg, 0);
  return {
    sessions: rows.reduce((sum, r) => sum + r.sessions, 0),
    broughtIn: rows.reduce((sum, r) => sum + r.broughtIn, 0),
    /** From coaches only. */
    share,
    /** What coaches kept. */
    paidToCoaches: others.reduce((sum, r) => sum + r.broughtIn - r.toOrg, 0),
    /** Org share plus the owner's own sessions. */
    withOwn: share + own,
  };
};

/** "On a $70 session: $14 to the org · $56 to Dana". */
export const splitExample = (price: number, rate: number) => {
  const toOrg = Math.round(price * rate) / 100;
  return { toOrg, toCoach: Math.round((price - toOrg) * 100) / 100 };
};

export const isValidRate = (value: string) => value.trim() !== "" && Number(value) >= 0 && Number(value) <= 100;

export const attendanceLabel = (s: Pick<OrgSession, "noShow" | "marked" | "type" | "came">) =>
  s.noShow ? "No-show" : !s.marked ? "Not marked" : s.type === "group" ? `${s.came} came` : s.came ? "Came" : "Absent";

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

/** Book on an org page: signed-in families pick a coach and time; others see the org's coaches. */
export const bookPathFor = (isAuthenticated: boolean, orgName: string) =>
  isAuthenticated ? "/book" : `/coaches?academy=${encodeURIComponent(orgName)}`;
