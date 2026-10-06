import type { RosterAthlete } from "@/api/roster";

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

export const rosterSubtitle = (athlete: RosterAthlete) => {
  const bits = [
    athlete.age != null ? String(athlete.age) : null,
    athlete.team,
    athlete.age != null && athlete.age < 18 && athlete.accountName && athlete.accountName !== athlete.name
      ? `parent ${athlete.accountName}`
      : athlete.age != null && athlete.age >= 18
        ? "18+"
        : null,
  ].filter(Boolean);
  return bits.join(" · ");
};
