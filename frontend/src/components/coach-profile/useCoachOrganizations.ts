import { useMemo } from "react";
import { usePublicOrganizations } from "@/hooks/useOrganizations";
import type { Brand } from "@/utils/brands";

export type ProfileOrganization = Pick<Brand, "id" | "name" | "logo_url"> & { slug: string };

const NONE: ProfileOrganization[] = [];

/**
 * Organizations a coach belongs to, with logos from organizations.logo_url. Reads
 * get_organizations_public, which only lists members the org shows on its page
 * (organization_coaches.shown) who are listed and not deactivated.
 */
export const useCoachOrganizations = (coachId: string | undefined): ProfileOrganization[] => {
  const { data } = usePublicOrganizations();
  return useMemo(() => {
    if (!coachId || !data) return NONE;
    return data
      .filter((org) => org.coachIds.includes(coachId))
      .map((org) => ({ id: org.id, name: org.name, slug: org.slug, logo_url: org.logoUrl }));
  }, [coachId, data]);
};
