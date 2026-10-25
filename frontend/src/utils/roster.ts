import type { RosterAthlete } from "@/api/roster";
import { getZonedISODate, zonedWallTimeToUtc } from "@/utils/dateHelpers";
import { formatClock, formatDayISO } from "@/utils/schedule";

export type RosterSort = "name" | "next" | "pkg" | "pos" | "last" | "age" | "newest";

export const ROSTER_SORTS: [RosterSort, string][] = [
  ["name", "Name A–Z"],
  ["next", "Next session"],
  ["last", "Last session"],
  ["pkg", "Credits left"],
  ["pos", "Position"],
  ["age", "Age"],
  ["newest", "Newest"],
];

const nextKey = (athlete: RosterAthlete) =>
  athlete.next ? `${athlete.next.date}T${athlete.next.startTime}` : "9999";

const creditsLeft = (athlete: RosterAthlete) => {
  if (athlete.packageTotal == null) return 99;
  return Math.max(0, athlete.packageTotal - (athlete.packageUsed ?? 0));
};

const compare: Record<RosterSort, (a: RosterAthlete, b: RosterAthlete) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  next: (a, b) => nextKey(a).localeCompare(nextKey(b)),
  last: (a, b) => (a.lastDate ?? "0000").localeCompare(b.lastDate ?? "0000"),
  pkg: (a, b) => creditsLeft(a) - creditsLeft(b),
  pos: (a, b) => (a.position ?? "").localeCompare(b.position ?? ""),
  age: (a, b) => (a.age ?? 0) - (b.age ?? 0),
  newest: (a, b) => (b.joinedOn ?? "").localeCompare(a.joinedOn ?? ""),
};

export const sortRoster = (rows: RosterAthlete[], sort: RosterSort, dir: 1 | -1) =>
  rows.slice().sort((a, b) => dir * compare[sort](a, b) || a.name.localeCompare(b.name));

/** A camp athlete whose family hasn't made an account yet. */
export const campWithoutAccount = (athlete: Pick<RosterAthlete, "fromCamp" | "hasAccount">) => athlete.fromCamp && !athlete.hasAccount;

export const rosterSubtitle = (athlete: RosterAthlete) => {
  const bits = [
    athlete.age != null ? String(athlete.age) : null,
    athlete.team,
    athlete.age != null && athlete.age < 18 && athlete.accountName && athlete.accountName !== athlete.name
      ? `parent ${athlete.accountName}`
      : athlete.age != null && athlete.age >= 18
        ? "18+"
        : null,
    campWithoutAccount(athlete) ? "Account not set up yet" : null,
  ].filter(Boolean);
  return bits.join(" · ");
};

/** "Mon, Sep 28, 4:00 pm", or "Today, 10:30 am", in the viewer's time zone. */
export const rosterNextLabel = (date: string, start: string, timeZone: string, now = new Date()) => {
  const at = zonedWallTimeToUtc(date, start);
  if (!at) return "";
  const day = getZonedISODate(at, timeZone);
  const dayLabel = day === getZonedISODate(now, timeZone)
    ? "Today"
    : formatDayISO(day, { weekday: "short", month: "short", day: "numeric" });
  return `${dayLabel}, ${formatClock(at, timeZone)}`;
};

/** Sessions left on the athlete's current package, or null without one. */
export const packageLeft = (athlete: RosterAthlete) =>
  athlete.packageTotal ? Math.max(0, athlete.packageTotal - (athlete.packageUsed ?? 0)) : null;
