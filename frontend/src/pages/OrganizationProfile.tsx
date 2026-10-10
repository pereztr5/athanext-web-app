import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, Building2, Calendar, ChevronLeft, Handshake, Info, MapPin, Star, Users } from "lucide-react";
import { BrandStar } from "@/components/brand";
import { Skeleton } from "@/components/ui/skeleton";
import { coachesAPI } from "@/api/coaches";
import { reviewsAPI, type Review } from "@/api/reviews";
import { useBrandsByCoach } from "@/hooks/useBrands";
import { useRole } from "@/hooks/useRole";
import { ROUTES } from "@/routes";
import { organizationPartners } from "@/utils/brands";
import { OrgFamilyPage } from "@/components/organization/OrgFamilyPage";
import { useMyOrganization, usePublicOrganizations } from "@/hooks/useOrganizations";
import {
  academySlug,
  applyOrganizations,
  buildOrganizations,
  findOrganization,
  coachAcademy,
  initialsOf,
  organizationRatingLabel,
  sportLabel,
} from "@/utils/coachAcademy";
import { coachProfilePath } from "@/utils/coachSlug";
import { getCoachSport } from "@/utils/coachSport";
import { publicCoachRatingLabel } from "@/utils/publicRating";

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

const card = "flex min-w-0 flex-col gap-5 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] pb-[25px] pt-[30px]";
const cardTitle = "flex items-center gap-2 text-[20px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]";

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

  const { data: brandsByCoach = {} } = useBrandsByCoach(organization?.coachIds ?? []);
  const partners = organization ? organizationPartners(organization.coachIds, brandsByCoach) : [];

  const { data: reviews = [] } = useQuery({
    queryKey: ["organization-reviews", organization?.coachIds],
    enabled: Boolean(organization?.coachIds.length),
    queryFn: async () => {
      const results = await Promise.all(organization!.coachIds.map((id) => reviewsAPI.getCoachReviews(id)));
      return results
        .flatMap((result) => (result.data ?? []) as Review[])
        .filter((review) => review.review_text?.trim())
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 2);
    },
  });

  const shell = isAuthenticated
    ? "overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12"
    : "mt-[3.8rem] min-h-screen w-full overflow-x-hidden bg-app-background px-4 pb-20 pt-6 md:px-10";
  const backLink = (
    <Link
      to={`${ROUTES.COACHES}?view=organizations`}
      className="inline-flex w-fit items-center gap-1 text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#767980] hover:text-[#1A202C]"
    >
      <ArrowLeft className="size-[15px]" strokeWidth={1.75} />
      Back to organizations
    </Link>
  );

  if (isLoading || orgsLoading) {
    return (
      <div className={shell}>
        <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6" aria-busy="true" aria-label="Loading organization">
          <Skeleton className="h-[88px] w-full rounded-[10px]" />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[120px] rounded-[10px]" />
            ))}
          </div>
          <Skeleton className="h-[220px] w-full rounded-[10px]" />
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
        <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
          {preview ? (
            <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4">
              <Link
                to={ROUTES.MY_ORGANIZATION}
                className="inline-flex w-fit items-center gap-1 text-[14px] font-medium text-[#767980] hover:text-[#1A202C]"
              >
                <ChevronLeft className="size-4" strokeWidth={1.5} aria-hidden="true" />
                Organization page
              </Link>
              <div className="flex items-start gap-[10px] rounded-[8px] bg-[#F4F4EB] px-[14px] py-3 text-[12px] leading-[14px] text-[#767980]">
                <Info className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                <span>This is what families see.</span>
              </div>
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
        <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
          {backLink}
          <div className={`${card} items-center text-center`}>
            <p className="text-[20px] font-medium leading-[24px] tracking-[-0.05em] text-[#1A202C]">Organization not found</p>
            <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
              No coaches list this academy right now.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { name, coachCount, verifiedCount, sports, location, totalReviews } = organization;
  const rating = organizationRatingLabel(organization);
  const directoryLink = `${ROUTES.COACHES}?academy=${encodeURIComponent(name)}`;
  const coachName = (coachId: string) => members.find((coach) => coach.id === coachId)?.name ?? "";
  const stats = [
    { label: "Coaches on staff", value: coachCount, meta: verifiedCount ? `${verifiedCount} verified` : "On AthaNext" },
    { label: "Reviews", value: totalReviews, meta: rating ? `${rating} average rating` : "Not enough reviews yet" },
    { label: "Sports", value: sports.length, meta: sports.map(sportLabel).join(", ") || "—" },
  ];

  return (
    <div className={shell}>
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
        {backLink}

        <header className="flex flex-wrap items-start gap-6">
          <span className="flex size-[88px] shrink-0 items-center justify-center rounded-[10px] bg-[#CCDDF0] text-[28px] font-bold tracking-[-0.03em] text-[#00326C]">
            {initialsOf(name)}
          </span>
          <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-3">
            <h1 className="text-[26px] md:text-[32px] font-bold leading-[26px] md:leading-[34px] tracking-[-0.05em] text-[#1A202C] [text-wrap:balance]">{name}</h1>
            <div className="flex flex-wrap items-center gap-3 text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
              {location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-4" strokeWidth={1.5} aria-hidden="true" />
                  {location}
                </span>
              ) : null}
              {rating ? (
                <span className="inline-flex items-center gap-1 font-medium text-[#1A202C]">
                  <BrandStar size={14} />
                  {rating}
                  <span className="text-[12px] font-normal text-[#767980]">{totalReviews} reviews</span>
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-[6px]">
              {sports.map((sport) => (
                <span key={sport} className="rounded-[4px] bg-[#E5EDF7] px-2 py-[3px] text-[12px] font-medium leading-[13px] text-[#0054B4]">
                  {sportLabel(sport)}
                </span>
              ))}
              {verifiedCount > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-[4px] bg-[#CBE7D1] px-2 py-[3px] text-[12px] font-medium leading-[13px] text-[#1E7431]">
                  <BadgeCheck className="size-3" strokeWidth={2} aria-hidden="true" />
                  Verified coaches
                </span>
              ) : null}
            </div>
          </div>
          <Link
            to={directoryLink}
            className="inline-flex h-[34px] items-center gap-2 rounded-[8px] border border-[#6698D2] bg-[#0054B4] px-4 text-[16px] font-medium tracking-[-0.03em] text-[#F1F1E6]"
          >
            <Calendar className="size-4" strokeWidth={1.5} aria-hidden="true" />
            View sessions
          </Link>
        </header>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className={`${card} gap-[6px]`}>
              <span className="text-[14px] font-medium tracking-[-0.03em] text-[#767980]">{stat.label}</span>
              <span className="text-[32px] font-bold leading-[30px] tracking-[-0.03em] text-[#1A202C] tabular-nums">{stat.value}</span>
              <span className="text-[12px] tracking-[-0.03em] text-[#767980]">{stat.meta}</span>
            </div>
          ))}
        </div>

        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className={cardTitle}>
              <Users className="size-5" strokeWidth={1.5} aria-hidden="true" />
              Coaches
              <span className="rounded-[4px] bg-[#F1F1E6] px-2 py-[3px] text-[12px] font-medium text-[#484D56]">{coachCount}</span>
            </h2>
            <Link to={directoryLink} className="text-[14px] font-medium tracking-[-0.03em] text-[#0054B4] hover:underline">
              See all in directory
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {members.map((coach) => {
              const photo = coach.profile_image_url || coach.image_url;
              const coachRating = publicCoachRatingLabel(coach.rating, coach.total_reviews);
              return (
                <div key={coach.id} className="flex flex-col gap-[10px] rounded-[8px] bg-[#F4F4EB] p-4">
                  {photo ? (
                    <img src={photo} alt="" className="size-10 rounded-full bg-[#C1C1B8] object-cover" />
                  ) : (
                    <span className="flex size-10 items-center justify-center rounded-full bg-[#CCDDF0] text-[14px] font-semibold text-[#00326C]">
                      {initialsOf(coach.name || "Coach")}
                    </span>
                  )}
                  <div className="flex min-w-0 flex-col gap-[6px]">
                    <span className="flex items-center gap-1 truncate text-[16px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]">
                      {coach.name}
                      {coach.is_verified ? (
                        <BadgeCheck className="size-4 shrink-0 fill-[#0054B4] text-white" strokeWidth={2} aria-label="Verified" />
                      ) : null}
                    </span>
                    <span className="truncate text-[12px] tracking-[-0.03em] text-[#767980]">
                      {coach.coach_position || coach.positions?.[0] || "Coach"}
                    </span>
                  </div>
                  <div className="mt-auto flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#484D56]">
                      {coachRating !== "New" ? <BrandStar size={10} /> : null}
                      {coachRating}
                    </span>
                    <Link
                      to={coachProfilePath(coach.slug || coach.id)}
                      className="text-[14px] font-medium tracking-[-0.03em] text-[#0054B4] hover:underline"
                    >
                      Book
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {partners.length > 0 ? (
          <section className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className={cardTitle}>
                <Handshake className="size-5" strokeWidth={1.5} aria-hidden="true" />
                Partners
              </h2>
              <span className="text-[12px] tracking-[-0.03em] text-[#767980]">Brands this organization's coaches work with</span>
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {partners.map((brand) => {
                const inner = (
                  <>
                    {brand.logo_url ? (
                      <img src={brand.logo_url} alt="" className="h-11 w-auto max-w-[120px] object-contain" />
                    ) : (
                      <span className="flex size-11 items-center justify-center rounded-[8px] bg-[#D9D9CF] text-[16px] font-bold text-[#484D56]">
                        {initialsOf(brand.name)}
                      </span>
                    )}
                    <span className="text-[16px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]">{brand.name}</span>
                  </>
                );
                const tileClass = "flex flex-col gap-3 rounded-[8px] bg-[#F4F4EB] p-4";
                return brand.website ? (
                  <a key={brand.id} href={brand.website} target="_blank" rel="noopener noreferrer" className={`${tileClass} hover:bg-[#EAEADF]`}>
                    {inner}
                  </a>
                ) : (
                  <div key={brand.id} className={tileClass}>
                    {inner}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {reviews.length > 0 ? (
          <section className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className={cardTitle}>
                <Star className="size-5" strokeWidth={1.5} aria-hidden="true" />
                Reviews
              </h2>
              {rating ? (
                <span className="inline-flex items-center gap-1 text-[14px] font-medium text-[#1A202C]">
                  <BrandStar size={14} />
                  {rating}
                  <span className="text-[12px] font-normal text-[#767980]">from {totalReviews} reviews</span>
                </span>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {reviews.map((review) => (
                <figure key={review.id} className="flex flex-col gap-[10px] rounded-[8px] bg-[#F4F4EB] px-4 py-[14px]">
                  <blockquote className="text-[14px] leading-[20px] tracking-[-0.03em] text-[#1A202C]">{review.review_text}</blockquote>
                  <figcaption className="text-[12px] tracking-[-0.03em] text-[#767980]">
                    {review.reviewer_name || "Athlete"} · for {coachName(review.coach_id)} ·{" "}
                    {new Date(review.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ) : null}

        <p className="flex items-center gap-2 text-[12px] tracking-[-0.03em] text-[#A3A6AB]">
          <Building2 className="size-4" strokeWidth={1.5} aria-hidden="true" />
          Built from the profiles of coaches who list {coachAcademy(name)}.
        </p>
      </div>
    </div>
  );
};

export default OrganizationProfile;
