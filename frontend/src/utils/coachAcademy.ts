/** Academy filtering on the coach directory, keyed off the free-text coaches.company field. */

export const ALL_ACADEMIES = "All Academies";

export const coachAcademy = (company: string | null | undefined): string =>
  typeof company === "string" ? company.trim().replace(/\s+/g, " ") : "";

const academyKey = (company: string | null | undefined) => coachAcademy(company).toLowerCase();

/** Distinct academy names (case-insensitive), first spelling wins, sorted A–Z. */
export const getAcademyOptions = (coaches: Array<{ company?: string | null } | null | undefined>): string[] => {
  const byKey = new Map<string, string>();
  coaches.forEach((coach) => {
    const name = coachAcademy(coach?.company);
    if (name && !byKey.has(name.toLowerCase())) byKey.set(name.toLowerCase(), name);
  });
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
};

export const matchesAcademy = (company: string | null | undefined, selected: string): boolean =>
  selected === ALL_ACADEMIES || (academyKey(company) !== "" && academyKey(company) === selected.toLowerCase());
