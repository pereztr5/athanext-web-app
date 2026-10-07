import { isPublicCoachRatingVisible } from "@/utils/publicRating";

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

/**
 * URL slug for an academy page: "GK Academy FL" -> "gk-academy-fl". Keeps letters
 * from any script, so non-Latin names still get a usable slug.
 */
export const academySlug = (company: string | null | undefined): string =>
  coachAcademy(company)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

export interface CoachOrganization {
  name: string;
  slug: string;
  coachIds: string[];
  coachCount: number;
  verifiedCount: number;
  sports: string[];
  /** Most common first location among the organization's coaches. */
  location: string;
  /** Photos of up to three coaches, for the card's avatar stack. */
  photos: string[];
  /** Review-weighted average of its coaches' ratings; null without reviews. */
  rating: number | null;
  totalReviews: number;
}

type OrganizationCoach = {
  id?: string;
  company?: string | null;
  rating?: number | null;
  total_reviews?: number | null;
  is_verified?: boolean | null;
  locations?: string[] | null;
  profile_image_url?: string | null;
  image_url?: string | null;
};

/**
 * Groups coaches into organizations by academy slug, so the directory and the
 * organization page always agree on membership. Coaches without one are skipped.
 * Sorted by coach count, then A–Z.
 */
export const buildOrganizations = <T extends OrganizationCoach>(
  coaches: Array<T | null | undefined>,
  getSport: (coach: T) => string
): CoachOrganization[] => {
  const groups = new Map<string, { name: string; members: T[] }>();
  coaches.forEach((coach) => {
    const name = coachAcademy(coach?.company);
    const key = academySlug(name);
    if (!coach || !key) return;
    const group = groups.get(key) ?? { name, members: [] };
    group.members.push(coach);
    groups.set(key, group);
  });

  return [...groups.values()]
    .map(({ name, members }) => {
      const locationCounts = new Map<string, number>();
      members.forEach((coach) => {
        const location = coach.locations?.[0]?.trim();
        if (location) locationCounts.set(location, (locationCounts.get(location) ?? 0) + 1);
      });
      const location = [...locationCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
      const reviewed = members.filter((coach) => (coach.total_reviews ?? 0) > 0 && typeof coach.rating === "number");
      const totalReviews = reviewed.reduce((sum, coach) => sum + (coach.total_reviews ?? 0), 0);
      const rating = totalReviews
        ? reviewed.reduce((sum, coach) => sum + (coach.rating as number) * (coach.total_reviews ?? 0), 0) / totalReviews
        : null;
      return {
        name,
        slug: academySlug(name),
        coachIds: members.map((coach) => coach.id).filter((id): id is string => Boolean(id)),
        coachCount: members.length,
        verifiedCount: members.filter((coach) => coach.is_verified).length,
        sports: [...new Set(members.map(getSport))].sort(),
        location,
        photos: [...new Set(members.map((coach) => coach.profile_image_url || coach.image_url || ""))]
          .filter(Boolean)
          .slice(0, 3),
        rating,
        totalReviews,
      };
    })
    .sort((a, b) => b.coachCount - a.coachCount || a.name.localeCompare(b.name));
};

/** Path of an academy's organization page (ROUTES.ORGANIZATION). */
export const organizationPath = (company: string | null | undefined): string => `/organizations/${academySlug(company)}`;

export const initialsOf = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

export const sportLabel = (sport: string) => `${sport.charAt(0).toUpperCase()}${sport.slice(1)}`;

/** Rating shown for an organization, or null while it has too few reviews (same rule as coaches). */
export const organizationRatingLabel = (organization: Pick<CoachOrganization, "rating" | "totalReviews">) =>
  organization.rating !== null && isPublicCoachRatingVisible(organization.totalReviews, organization.rating)
    ? organization.rating.toFixed(1)
    : null;

type OrgMembership = { name: string; slug: string; memberIds: string[] };

/**
 * Organizations an admin set up (ATH-90) win over the free-text academy: their coaches are
 * grouped under the org's name, and other coaches who typed the same academy are left out
 * of that org.
 */
export const applyOrganizations = <T extends { id?: string; company?: string | null }>(
  coaches: T[],
  organizations: OrgMembership[]
): T[] => {
  if (!organizations.length) return coaches;
  const byCoach = new Map<string, string>();
  const taken = new Set<string>();
  organizations.forEach((org) => {
    org.memberIds.forEach((id) => byCoach.set(id, org.name));
    taken.add(org.slug);
    taken.add(academySlug(org.name));
  });
  return coaches.map((coach) => {
    const orgName = coach?.id ? byCoach.get(coach.id) : undefined;
    if (orgName) return { ...coach, company: orgName };
    if (coach && taken.has(academySlug(coach.company))) return { ...coach, company: null };
    return coach;
  });
};

/** The org an admin set up for this page slug, if any. */
export const findOrganization = <T extends { name: string; slug: string }>(organizations: T[], slug: string) =>
  organizations.find((org) => org.slug === slug || academySlug(org.name) === slug);
