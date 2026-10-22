/**
 * The pillars a coach picks at sign up, per sport. The database list (sport_pillars, read with
 * getSportPillars) is the source; these titles are only the offline fallback and the display
 * order. Sign up and the session tag picker both use pillarTitles, so a session is tagged with
 * the same pillars families chose from and coaches' picks link to sport_pillars rows.
 */
export type PillarSport = "Soccer" | "Rowing";

/** Fallback and order. Matches sport_pillars in the database. */
export const SIGNUP_PILLARS: Record<PillarSport, readonly string[]> = {
  Soccer: ["On-field training", "Video analysis", "Mentorship", "Performance coaching", "Academic tutoring", "College recruiting"],
  Rowing: [
    "Technical development",
    "Race preparation",
    "Mentorship",
    "Performance coaching",
    "Academic tutoring",
    "College recruiting",
  ],
};

/** Soccer unless the profile says rowing (the app's two sports). */
export const pillarSport = (sport?: string | null): PillarSport => (/rowing/i.test(sport ?? "") ? "Rowing" : "Soccer");

/** The sport_type value the database uses. */
export const pillarSportKey = (sport?: string | null): "soccer" | "rowing" => (pillarSport(sport) === "Rowing" ? "rowing" : "soccer");

export const pillarsForSport = (sport?: string | null) => SIGNUP_PILLARS[pillarSport(sport)];

const pillarKey = (title: string) => title.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * The pillar titles to offer: the database titles (trimmed, without case-insensitive
 * duplicates), in the fallback's order with any others after it. The fallback when the
 * database gave none.
 */
export const pillarTitles = (sport: string | null | undefined, dbTitles?: readonly (string | null | undefined)[] | null) => {
  const fallback = pillarsForSport(sport);
  const seen = new Set<string>();
  const titles: string[] = [];
  for (const raw of dbTitles ?? []) {
    const title = raw?.trim().replace(/\s+/g, " ");
    if (!title || seen.has(pillarKey(title))) continue;
    seen.add(pillarKey(title));
    titles.push(title);
  }
  if (!titles.length) return [...fallback];
  const rank = (title: string) => {
    const i = fallback.findIndex((f) => pillarKey(f) === pillarKey(title));
    return i === -1 ? fallback.length : i;
  };
  return titles
    .map((title, i) => ({ title, i }))
    .sort((a, b) => rank(a.title) - rank(b.title) || a.i - b.i)
    .map(({ title }) => title);
};

/** Ids of the database pillars whose titles were picked, ignoring case and extra spaces. */
export const pickedPillarIds = (
  rows: readonly { id: string; title: string | null }[],
  picked: readonly string[],
): string[] => {
  const wanted = new Set(picked.map(pillarKey));
  return rows.filter((row) => row.title && wanted.has(pillarKey(row.title))).map((row) => row.id);
};
