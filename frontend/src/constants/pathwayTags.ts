export const PATHWAY_TAGS = [
  "Foundations",
  "Youth Development",
  "Elite Pathway",
  "High School",
  "College",
  "Pre-Pro",
  "Pro",
  "Adult/Recreation",
] as const;

export type PathwayTag = (typeof PATHWAY_TAGS)[number];

export const MAX_PATHWAY_TAGS = 5;

export function isPathwayTag(value: string): value is PathwayTag {
  return (PATHWAY_TAGS as readonly string[]).includes(value);
}

export function sanitizePathwayTags(values: string[] | null | undefined): PathwayTag[] {
  const seen = new Set<PathwayTag>();
  for (const value of values || []) {
    if (isPathwayTag(value) && !seen.has(value)) {
      seen.add(value);
    }
  }
  return Array.from(seen).slice(0, MAX_PATHWAY_TAGS);
}

/** Suggest pathway tags from DOB / graduation year. Pro is never auto-suggested. */
export function suggestPathwayTags(
  dateOfBirth?: string | null,
  graduationYear?: number | null
): PathwayTag[] {
  const suggestions = new Set<PathwayTag>();
  const now = new Date();
  const currentYear = now.getFullYear();

  if (dateOfBirth) {
    const dob = new Date(dateOfBirth);
    if (!Number.isNaN(dob.getTime())) {
      let age = currentYear - dob.getFullYear();
      const monthDiff = now.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
        age -= 1;
      }

      if (age >= 5 && age <= 7) suggestions.add("Foundations");
      else if (age >= 8 && age <= 13) suggestions.add("Youth Development");
      else if (age >= 14 && age <= 17) {
        suggestions.add("Elite Pathway");
        suggestions.add("High School");
      } else if (age >= 18 && age <= 22) suggestions.add("College");
      else if (age >= 23) suggestions.add("Pre-Pro");
    }
  }

  if (graduationYear && graduationYear > currentYear) {
    suggestions.add("High School");
  } else if (graduationYear && graduationYear <= currentYear) {
    suggestions.add("College");
  }

  return Array.from(suggestions).slice(0, MAX_PATHWAY_TAGS);
}

/** Soft zip proximity rank: 0 exact, 1 same 3-digit prefix, 2 other/missing. */
export function zipProximityRank(
  coachZip: string | null | undefined,
  queryZip: string
): number {
  const coach = (coachZip || "").replace(/\D/g, "");
  const query = queryZip.replace(/\D/g, "");
  if (!query || !coach) return 2;
  if (coach === query) return 0;
  if (coach.length >= 3 && query.length >= 3 && coach.slice(0, 3) === query.slice(0, 3)) {
    return 1;
  }
  return 2;
}
