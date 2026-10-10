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

/** Academy package savings vs single sessions (Working Copy `pkgCalc`). */
export interface PackageSaving {
  /** Package price per session, rounded to dollars. */
  per: number;
  rows: { key: string; name: string; single: number; save: number }[];
  min: number;
  max: number;
}

const wholeDollars = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export const packageSaving = (
  pkg: { kind: "individual" | "group"; sessionCount: number; price: number; coachIds: string[] },
  coaches: { id: string; name: string; price: number }[],
  groupPrices: number[]
): PackageSaving => {
  const per = Math.round(pkg.price / Math.max(1, pkg.sessionCount));
  const rows =
    pkg.kind === "group"
      ? [...new Set(groupPrices.filter((p) => p > 0))].map((p) => ({
          key: `g${p}`,
          name: `${wholeDollars(p)} group sessions`,
          single: p * pkg.sessionCount,
          save: p * pkg.sessionCount - pkg.price,
        }))
      : coaches
          .filter((c) => pkg.coachIds.includes(c.id) && c.price > 0)
          .map((c) => ({ key: c.id, name: c.name, single: c.price * pkg.sessionCount, save: c.price * pkg.sessionCount - pkg.price }));
  const saves = rows.map((r) => r.save);
  return { per, rows, min: rows.length ? Math.min(...saves) : 0, max: rows.length ? Math.max(...saves) : 0 };
};

/** "Saves $40 to $120 vs single sessions", or "" when there's nothing to save. */
export const savingLine = (k: PackageSaving, suffix = " vs single sessions") =>
  !k.rows.length || k.max <= 0
    ? ""
    : k.min === k.max
      ? `Saves ${wholeDollars(k.max)}${suffix}`
      : k.min <= 0
        ? `Saves up to ${wholeDollars(k.max)}${suffix}`
        : `Saves ${wholeDollars(k.min)} to ${wholeDollars(k.max)}${suffix}`;
