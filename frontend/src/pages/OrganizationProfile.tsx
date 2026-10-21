import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft } from "@/components/icons";
import { Banner } from "@/components/ui/banner";
import { Skeleton } from "@/components/ui/skeleton";
import { coachesAPI } from "@/api/coaches";
import type { PublicOrganization } from "@/api/organizations";
import { useRole } from "@/hooks/useRole";
import { ROUTES } from "@/routes";
import { OrgFamilyPage } from "@/components/organization/OrgFamilyPage";
import { useMyOrganization, usePublicOrganizations } from "@/hooks/useOrganizations";
import {
  academySlug,
  applyOrganizations,
  buildOrganizations,
  findOrganization,
  sportLabel,
} from "@/utils/coachAcademy";
import { getCoachSport } from "@/utils/coachSport";

type PublicCoach = {
  id: string;
  name: string;
  slug?: string | null;
  company?: string | null;
  coach_position?: string | null;
  positions?: string[] | null;
  locations?: string[] | null;
  rating?: number | null;
  total_reviews?: number | null;
  is_verified?: boolean | null;
  profile_image_url?: string | null;
  image_url?: string | null;
  sport_type?: string | null;
  sport?: string | null;
  session_types?: string[] | null;
  specialties?: string[] | null;
  hourly_rate?: number | null;
  age_min?: number | null;
  age_max?: number | null;
};

const card = "flex min-w-0 flex-col gap-5 rounded-card border border-light-525 bg-light-300 px-[25px] pb-[25px] pt-[30px]";

/**
 * Organization landing page (ATH-63). An organization is the set of coaches
 * that list the same academy, so everything here is derived from them.
 */
const OrganizationProfile = () => {
  const { slug = "" } = useParams();
  const { isAuthenticated } = useRole();
  const { data: myOrg } = useMyOrganization();

  const { data: coaches = [], isLoading } = useQuery({
    queryKey: ["coaches-public"],
    queryFn: async () => {
      const response = await coachesAPI.getPublicCoaches();
      if (response.error) throw new Error(response.error.message);
      return (response.data ?? []) as unknown as PublicCoach[];
    },
  });

  const { data: orgPages = [], isLoading: orgsLoading } = usePublicOrganizations();
  const orgPage = findOrganization(orgPages, slug);
  const members = useMemo(
    () => applyOrganizations(coaches, orgPages).filter((coach) => academySlug(coach.company) === slug),
    [coaches, orgPages, slug]
  );
  const organization = useMemo(() => buildOrganizations(members, getCoachSport)[0], [members]);

  const shell = isAuthenticated
    ? "overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12"
    : "min-h-screen w-full overflow-x-hidden bg-app-background px-4 pb-20 pt-6 md:px-10";
  const backLink = (
    <Link
      to={`${ROUTES.COACHES}?view=organizations`}
      className="inline-flex w-fit items-center gap-1 text-label-sm text-dark-300 hover:text-dark"
    >
      <ArrowLeft className="size-4" strokeWidth={1.5} />
      Back to organizations
    </Link>
  );

  if (isLoading || orgsLoading) {
    return (
      <div className={shell}>
        <div className="mx-auto flex w-full max-w-wrapper flex-col gap-6" aria-busy="true" aria-label="Loading organization">
          <Skeleton className="h-[88px] w-full rounded-card" />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[120px] rounded-card" />
            ))}
          </div>
          <Skeleton className="h-[220px] w-full rounded-card" />
        </div>
      </div>
    );
  }

  if (orgPage) {
    const shown = orgPage.coachIds
      .map((id) => coaches.find((coach) => coach.id === id))
      .filter((coach): coach is PublicCoach => Boolean(coach));
    const preview = myOrg?.slug === orgPage.slug;
    return (
      <div className={shell}>
        <div className="mx-auto flex w-full max-w-wrapper flex-col gap-6">
          {preview ? (
            <div className="flex w-full flex-col gap-4">
              <Link
                to={ROUTES.MY_ORGANIZATION}
                className="inline-flex w-fit items-center gap-1 text-label-sm text-dark-300 hover:text-dark"
              >
                <ChevronLeft className="size-4" strokeWidth={1.5} aria-hidden="true" />
                Organization page
              </Link>
              <Banner tone="neutral">This is what families see.</Banner>
            </div>
          ) : (
            backLink
          )}
          <OrgFamilyPage org={orgPage} coaches={shown} preview={preview} />
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className={shell}>
        <div className="mx-auto flex w-full max-w-wrapper flex-col gap-6">
          {backLink}
          <div className={`${card} items-center text-center`}>
            <p className="text-card-title text-dark">Organization not found</p>
            <p className="text-body-m text-dark-300">
              No coaches list this academy right now.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const fromCoaches: PublicOrganization = {
    id: organization.slug,
    name: organization.name,
    slug: organization.slug,
    line: [organization.location, organization.sports.map(sportLabel).join(", ")].filter(Boolean).join(" · "),
    about: "",
    logoUrl: null,
    pricing: [],
    coachIds: members.map((coach) => coach.id),
    memberIds: members.map((coach) => coach.id),
  };

  return (
    <div className={shell}>
      <div className="mx-auto flex w-full max-w-wrapper flex-col gap-6">
        {backLink}
        <OrgFamilyPage org={fromCoaches} coaches={members} messageCoachId={members[0]?.id} />
      </div>
    </div>
  );
};

export default OrganizationProfile;
