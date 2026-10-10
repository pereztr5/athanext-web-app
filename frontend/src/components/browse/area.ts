/**
 * Browse's area select (Working Copy: "Austin, TX / Within 10 miles / Within 25 miles / Online
 * only"). Coaches only store a ZIP, so distance is approximated from ZIP prefixes: the same first
 * four digits counts as within 10 miles, the same first three as within 25.
 */
export type BrowseArea = "near" | "10" | "25" | "online" | "any";

const digits = (zip: string | null | undefined) => (zip || "").replace(/\D/g, "");

/** A US ZIP from the family's profile, or "" when there isn't a usable one. */
export const usableZip = (zip: string | null | undefined): string => {
  const raw = (zip || "").trim();
  return /^\d{5}(-?\d{4})?$/.test(raw) ? digits(raw).slice(0, 5) : "";
};

export const isOnline = (sessionTypes: string[] | null | undefined) =>
  (sessionTypes ?? []).some((type) => /virtual|video|online/i.test(type));

/** 0 same ZIP, 1 same first four digits, 2 same first three, 3 farther or unknown. */
export const zipDistanceRank = (coachZip: string | null | undefined, homeZip: string): number => {
  const coach = digits(coachZip).slice(0, 5);
  if (!homeZip || coach.length < 5) return 3;
  if (coach === homeZip) return 0;
  if (coach.slice(0, 4) === homeZip.slice(0, 4)) return 1;
  if (coach.slice(0, 3) === homeZip.slice(0, 3)) return 2;
  return 3;
};

export const matchesArea = (
  coach: { zip_code?: string | null; session_types?: string[] | null },
  area: BrowseArea,
  homeZip: string
): boolean => {
  if (area === "online") return isOnline(coach.session_types);
  if (area === "10") return zipDistanceRank(coach.zip_code, homeZip) <= 1;
  if (area === "25") return zipDistanceRank(coach.zip_code, homeZip) <= 2;
  return true;
};

export const areaOptions = (city: string, homeZip: string): { value: BrowseArea; label: string }[] =>
  homeZip
    ? [
        { value: "near", label: city || `Near ${homeZip}` },
        { value: "10", label: "Within 10 miles" },
        { value: "25", label: "Within 25 miles" },
        { value: "online", label: "Online only" },
      ]
    : [
        { value: "any", label: "Any area" },
        { value: "online", label: "Online only" },
      ];
