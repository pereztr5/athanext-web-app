/**
 * Athlete Home (ATH-92): age group, the player card line and the "Finish profile" checklist.
 */

export interface HomeAthlete {
  id: string;
  fullName: string;
  dateOfBirth: string | null;
  sport: string | null;
  position: string | null;
  team: string | null;
  graduationYear: string | null;
  pathway: string | null;
  seasonGoal: string | null;
  highlightVideoUrl: string | null;
  photo: string | null;
}

/** Whole years between an ISO birth date and today (ISO). */
export const ageOn = (dob: string | null, todayISO: string): number | null => {
  if (!dob) return null;
  const [y, m, d] = dob.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = todayISO.slice(0, 10).split("-").map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
};

/** Soccer-style age group: the season starts in August, so "U16" for a 2010 birth year in the 2025-26 season. */
export const ageGroup = (dob: string | null, todayISO: string): string => {
  if (!dob) return "";
  const season = Number(todayISO.slice(0, 4)) + (Number(todayISO.slice(5, 7)) >= 8 ? 1 : 0);
  return `U${season - Number(dob.slice(0, 4))}`;
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** "U17 · Goalkeeper · Riverside FC · Class of 2028" */
export const playerLine = (a: HomeAthlete, todayISO: string): string => {
  const group = ageGroup(a.dateOfBirth, todayISO);
  return [
    group && !(a.team ?? "").includes(group) ? group : "",
    a.position ?? "",
    a.team ?? "",
    a.graduationYear ? `Class of ${a.graduationYear}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
};

export const sportLabel = (sport: string | null) => (sport ? capitalize(sport.toLowerCase()) : "");

export type ProfileItemKey = "basics" | "position" | "team" | "pathway" | "grad" | "goal" | "video";

export const profileItems = (a: HomeAthlete): { key: ProfileItemKey; label: string; done: boolean }[] => [
  { key: "basics", label: "Name and age", done: Boolean(a.fullName.trim() && a.dateOfBirth) },
  { key: "position", label: "Sport and position", done: Boolean(a.sport && a.position) },
  { key: "team", label: "Club or team", done: Boolean(a.team) },
  { key: "pathway", label: "Pathway level", done: Boolean(a.pathway) },
  { key: "grad", label: "Graduation year", done: Boolean(a.graduationYear) },
  { key: "goal", label: "Season goal", done: Boolean(a.seasonGoal?.trim()) },
  { key: "video", label: "Highlight video", done: Boolean(a.highlightVideoUrl?.trim()) },
];
