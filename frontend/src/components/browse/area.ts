/**
 * "View All Coaches" ZIP filter: the family enters a ZIP (prefilled from their profile) and picks
 * a radius (10 / 25 / 50 mi); coaches sort nearest first. Distance is real miles between ZIP
 * centers when both are known (coach points come from get_coach_coordinates, the family's from
 * a ZIP lookup). Otherwise it falls back to ZIP prefixes: the same first four digits counts as
 * within 10 miles, the same first three as within 25. A failed lookup never empties the list on
 * its own: it only means the prefix guess is used.
 */

export type Radius = "any" | "10" | "25" | "50";

export const RADIUS_OPTIONS: { value: Radius; label: string }[] = [
  { value: "any", label: "Any distance" },
  { value: "10", label: "10 mi" },
  { value: "25", label: "25 mi" },
  { value: "50", label: "50 mi" },
];

export interface GeoPoint {
  lat: number;
  lng: number;
}

const digits = (zip: string | null | undefined) => (zip || "").replace(/\D/g, "");

/** A US ZIP from the family's profile, or "" when there isn't a usable one. */
export const usableZip = (zip: string | null | undefined): string => {
  const raw = (zip || "").trim();
  return /^\d{5}(-?\d{4})?$/.test(raw) ? digits(raw).slice(0, 5) : "";
};

/** What the ZIP box keeps while typing: digits only, at most 5. */
export const cleanZipInput = (value: string) => digits(value).slice(0, 5);

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

/** Great-circle miles between two points. */
export const haversineMiles = (a: GeoPoint, b: GeoPoint): number => {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.min(1, Math.sqrt(h)));
};

export interface CoachDistance {
  /** Real miles when both points are known. */
  miles: number | null;
  /** ZIP-prefix rank, the fallback. */
  rank: number;
}

/** A coach's stored point counts only while it was made for the ZIP they have now. */
export const coachPoint = (
  coachId: string,
  coachZip: string | null | undefined,
  points: Map<string, { zip: string | null; point: GeoPoint }>
): GeoPoint | null => {
  const stored = points.get(coachId);
  if (!stored) return null;
  const zip = digits(coachZip).slice(0, 5);
  return stored.zip && zip && stored.zip !== zip ? null : stored.point;
};

export const coachDistance = (
  coachZip: string | null | undefined,
  point: GeoPoint | null,
  homeZip: string,
  homePoint: GeoPoint | null
): CoachDistance => ({
  miles: point && homePoint ? haversineMiles(point, homePoint) : null,
  rank: zipDistanceRank(coachZip, homeZip),
});

/** Within the radius: by miles when known, else by ZIP prefix (unknown coaches are left out). */
export const withinRadius = (d: CoachDistance, radius: Radius): boolean => {
  if (radius === "any") return true;
  const max = Number(radius);
  if (d.miles != null) return d.miles <= max;
  return d.rank <= (max >= 25 ? 2 : 1);
};

const RANK_MILES = [2, 8, 20, Number.POSITIVE_INFINITY];

/** Nearest first: real miles, or a rough figure from the ZIP prefix. Unknown sorts last. */
export const distanceSortValue = (d: CoachDistance) => d.miles ?? RANK_MILES[d.rank] ?? Number.POSITIVE_INFINITY;

/** "3 mi away" on the card, only for real distances. */
export const distanceLabel = (d: CoachDistance): string => {
  if (d.miles == null) return "";
  if (d.miles < 1) return "Under 1 mi away";
  return `${Math.round(d.miles)} mi away`;
};
