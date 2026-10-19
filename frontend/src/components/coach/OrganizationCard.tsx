import { Link } from "react-router-dom";
import { BadgeCheck, MapPin } from "@/components/icons";
import { BrandPill, BrandStar } from "@/components/brand";
import type { Brand } from "@/utils/brands";
import {
  initialsOf,
  organizationPath,
  organizationRatingLabel,
  sportLabel,
  type CoachOrganization,
} from "@/utils/coachAcademy";

export const OrganizationCard = ({
  organization,
  partners,
  page,
}: {
  organization: CoachOrganization;
  /** The page an org owner set up (ATH-90): logo, line and description. */
  page?: { slug: string; line: string; about: string; logoUrl: string | null };
  /** The organization's brands, most shared first. */
  partners: Pick<Brand, "id" | "name" | "logo_url">[];
}) => {
  const { name, coachCount, verifiedCount, sports, location, photos, totalReviews } = organization;
  const rating = organizationRatingLabel(organization);
  const place = page?.line || location;

  return (
    <Link
      to={page ? `/organizations/${page.slug}` : organizationPath(name)}
      aria-label={`Open ${name}`}
      className="flex min-w-0 flex-col gap-3 rounded-card border border-light-525 bg-light-300 px-[18px] pb-5 pt-[22px] transition-colors hover:border-light-600 md:px-[25px] md:pb-[25px] md:pt-[30px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="flex min-w-0 items-center gap-3">
        {page?.logoUrl ? (
          <img src={page.logoUrl} alt="" className="size-14 shrink-0 rounded-card bg-light-200 object-contain" />
        ) : (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-card border border-primary-200 bg-primary-50 text-subtitle text-primary">
            {initialsOf(name)}
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-[6px]">
          <h2 className="truncate text-subtitle text-dark">{name}</h2>
          <p className="flex min-w-0 items-center gap-1 text-caption text-dark-300">
            {place ? (
              <>
                <MapPin className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
                <span className="truncate">{place}</span>
              </>
            ) : null}
            {verifiedCount > 0 ? (
              <span className="inline-flex shrink-0 items-center gap-[2px]">
                {place ? "·" : null}
                <BadgeCheck className="size-3 fill-primary text-light" strokeWidth={2} aria-hidden="true" />
                Verified
              </span>
            ) : null}
          </p>
        </div>
      </div>

      {page?.about ? (
        <p className="line-clamp-2 text-body-m text-dark-400">{page.about}</p>
      ) : null}

      {sports.length > 0 ? (
        <div className="flex flex-wrap gap-[6px]">
          {sports.map((sport) => (
            <BrandPill key={sport} tone="teal">
              {sportLabel(sport)}
            </BrandPill>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          {photos.length > 0 ? (
            <div className="flex -space-x-2" aria-hidden="true">
              {photos.map((photo) => (
                <img
                  key={photo}
                  src={photo}
                  alt=""
                  className="size-7 rounded-full border-2 border-light-300 bg-light-600 object-cover"
                />
              ))}
            </div>
          ) : null}
          <span className="text-label-xsm text-dark-300">
            {coachCount} {coachCount === 1 ? "coach" : "coaches"}
          </span>
        </div>
        <span className="flex items-center gap-1 text-label-sm text-dark">
          {rating ? (
            <>
              <BrandStar size={14} />
              {rating}
              <span className="text-caption text-dark-300">({totalReviews})</span>
            </>
          ) : (
            <span className="text-caption text-dark-300">New</span>
          )}
        </span>
      </div>

      {partners.length > 0 ? (
        <>
          <div className="h-px bg-light-525" />
          <div className="flex flex-col gap-2">
            <span className="text-label-xsm text-dark-300">Partners</span>
            <div className="flex flex-wrap gap-[6px]">
              {partners.slice(0, 3).map((brand) => (
                <span
                  key={brand.id}
                  className="inline-flex items-center gap-[6px] rounded-pill border border-light-525 bg-light-400 py-[3px] pl-[3px] pr-2 text-label-xsm text-dark-400"
                >
                  {brand.logo_url ? (
                    <img src={brand.logo_url} alt="" className="size-[18px] rounded-control bg-light-100 object-contain" />
                  ) : (
                    <span className="flex size-[18px] items-center justify-center rounded-control bg-light-550 text-label-xsm">
                      {initialsOf(brand.name)}
                    </span>
                  )}
                  {brand.name}
                </span>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </Link>
  );
};
