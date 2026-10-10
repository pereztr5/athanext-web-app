import { Link } from "react-router-dom";
import { BadgeCheck, MapPin } from "lucide-react";
import { BrandStar } from "@/components/brand";
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
      className="flex min-w-0 flex-col gap-[14px] rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[18px] pb-5 pt-[22px] transition-colors hover:border-[#C1C1B8] md:px-[25px] md:pb-[25px] md:pt-[30px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]"
    >
      <div className="flex min-w-0 items-center gap-3">
        {page?.logoUrl ? (
          <img src={page.logoUrl} alt="" className="size-14 shrink-0 rounded-[10px] bg-[#F9F9F5] object-contain" />
        ) : (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-[10px] bg-[#E5EDF7] text-[18px] font-medium tracking-[-0.03em] text-[#0054B4]">
            {initialsOf(name)}
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-[6px]">
          <h2 className="truncate text-[16px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]">{name}</h2>
          <p className="flex min-w-0 items-center gap-1 text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">
            {place ? (
              <>
                <MapPin className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
                <span className="truncate">{place}</span>
              </>
            ) : null}
            {verifiedCount > 0 ? (
              <span className="inline-flex shrink-0 items-center gap-[2px]">
                {place ? "·" : null}
                <BadgeCheck className="size-3 fill-[#0054B4] text-white" strokeWidth={2} aria-hidden="true" />
                Verified
              </span>
            ) : null}
          </p>
        </div>
      </div>

      {page?.about ? (
        <p className="line-clamp-2 text-[13px] leading-[18px] tracking-[-0.03em] text-[#484D56]">{page.about}</p>
      ) : null}

      {sports.length > 0 ? (
        <div className="flex flex-wrap gap-[6px]">
          {sports.map((sport) => (
            <span
              key={sport}
              className="rounded-[4px] bg-[#E5EDF7] px-2 py-[3px] text-[12px] font-medium leading-[13px] tracking-[-0.03em] text-[#0054B4]"
            >
              {sportLabel(sport)}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-[10px]">
        <div className="flex items-center gap-2">
          {photos.length > 0 ? (
            <div className="flex -space-x-2" aria-hidden="true">
              {photos.map((photo) => (
                <img
                  key={photo}
                  src={photo}
                  alt=""
                  className="size-7 rounded-full border-2 border-[#F7F7F0] bg-[#C1C1B8] object-cover"
                />
              ))}
            </div>
          ) : null}
          <span className="text-[12px] font-medium leading-[13px] tracking-[-0.03em] text-[#767980]">
            {coachCount} {coachCount === 1 ? "coach" : "coaches"}
          </span>
        </div>
        <span className="flex items-center gap-1 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]">
          {rating ? (
            <>
              <BrandStar size={14} />
              {rating}
              <span className="text-[12px] font-normal text-[#A3A6AB]">({totalReviews})</span>
            </>
          ) : (
            <span className="text-[12px] font-normal text-[#767980]">New</span>
          )}
        </span>
      </div>

      {partners.length > 0 ? (
        <>
          <div className="h-px bg-[#EAEADF]" />
          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-medium leading-[13px] tracking-[-0.03em] text-[#A3A6AB]">Partners</span>
            <div className="flex flex-wrap gap-[6px]">
              {partners.slice(0, 3).map((brand) => (
                <span
                  key={brand.id}
                  className="inline-flex items-center gap-[6px] rounded-[4px] bg-[#F4F4EB] py-[3px] pl-[3px] pr-2 text-[12px] font-medium tracking-[-0.03em] text-[#484D56]"
                >
                  {brand.logo_url ? (
                    <img src={brand.logo_url} alt="" className="size-[18px] rounded-[3px] bg-[#FCFCFA] object-contain" />
                  ) : (
                    <span className="flex size-[18px] items-center justify-center rounded-[3px] bg-[#D9D9CF] text-[10px] font-bold">
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
