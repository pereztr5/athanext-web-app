import { Link } from "react-router-dom";
import { BadgeCheck, Building2, MapPin } from "lucide-react";
import { BrandPill, BrandStar } from "@/components/brand";
import { FreeIntroPill } from "@/components/intro-calls";
import { primaryButton, smallButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { organizationPath } from "@/utils/coachAcademy";

export interface BrowseCoachCardProps {
  name: string;
  photoUrl?: string | null;
  verified?: boolean;
  role: string;
  /** Formatted rating ("4.9"), or null while the coach has too few reviews to show one. */
  rating: string | null;
  reviewCount: number;
  area: string;
  pillars: string[];
  agePill: string;
  /** Dollars for one 1-on-1 session. */
  price: number | null;
  academy: string;
  isMine: boolean;
  freeIntro?: boolean;
  onOpen: () => void;
}

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("") || "?";

/**
 * Coach card in Browse (Working Copy `.ccard2`): the whole card opens the profile. Name and
 * badge, role, rating and area, pillar and age pills, then "From $X" over the academy line
 * and a full-width View profile.
 */
export const BrowseCoachCard = ({
  name,
  photoUrl,
  verified,
  role,
  rating,
  reviewCount,
  area,
  pillars,
  agePill,
  price,
  academy,
  isMine,
  freeIntro,
  onOpen,
}: BrowseCoachCardProps) => (
  <article
    role="link"
    tabIndex={0}
    aria-label={`View ${name}'s profile`}
    onClick={onOpen}
    onKeyDown={(event) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpen();
      }
    }}
    className="flex min-w-0 cursor-pointer flex-col gap-[14px] rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] p-[22px] transition-colors hover:border-[#99BBE1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]"
  >
    <div className="flex min-w-0 items-start gap-3">
      <span
        className={cn(
          "relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-[14px] font-medium tracking-[-0.03em]",
          academy ? "bg-[#E7F4F8] text-[#1599BC]" : "bg-[#E5EDF7] text-[#0054B4]"
        )}
      >
        {photoUrl ? <img src={photoUrl} alt="" className="absolute inset-0 size-full object-cover" /> : initialsOf(name)}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="flex min-w-0 items-center gap-1.5 text-[18px] font-semibold leading-[22px] tracking-[-0.03em] text-[#1A202C]">
          <span className="truncate">{name}</span>
          {verified ? <BadgeCheck className="size-4 shrink-0 text-[#0054B4]" strokeWidth={1.75} aria-label="Verified" /> : null}
        </h2>
        <span className="truncate text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">{role}</span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">
          {rating ? (
            <>
              <BrandStar size={13} />
              <b className="font-semibold text-[#1A202C]">{rating}</b>
              <span>({reviewCount})</span>
              {area ? <span className="mx-1 size-[3px] shrink-0 rounded-full bg-[#A3A6AB]" aria-hidden="true" /> : null}
            </>
          ) : null}
          {area ? (
            <span className="inline-flex min-w-0 max-w-full items-center gap-1">
              <MapPin className="size-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <span className="truncate">{area}</span>
            </span>
          ) : null}
        </span>
      </div>
    </div>

    {pillars.length || agePill || freeIntro ? (
      <div className="flex flex-wrap gap-1.5">
        {pillars.map((pillar) => (
          <BrandPill key={pillar} tone="neutral">
            {pillar}
          </BrandPill>
        ))}
        {agePill ? <BrandPill tone="teal">{agePill}</BrandPill> : null}
        <FreeIntroPill enabled={Boolean(freeIntro)} />
      </div>
    ) : null}

    <div className="mt-auto flex flex-col gap-3 border-t border-[#EAEADF] pt-3">
      <div className="flex min-w-0 flex-col gap-1 text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">
        {price ? (
          <span className="whitespace-nowrap">
            From <b className="text-[14px] font-medium text-[#1A202C]">${Math.round(price).toLocaleString("en-US")}</b>
          </span>
        ) : null}
        <span className="min-w-0 overflow-hidden">
          {academy ? (
            <Link
              to={organizationPath(academy)}
              onClick={(event) => event.stopPropagation()}
              className="inline-flex max-w-full items-center gap-1 font-medium text-[#0054B4] hover:text-[#004390] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]"
            >
              <Building2 className="size-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <span className="truncate">{academy}</span>
            </Link>
          ) : isMine ? (
            <BrandPill tone="green">Your coach</BrandPill>
          ) : (
            "Independent coach"
          )}
        </span>
      </div>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
        className={cn(primaryButton, smallButton, "w-full")}
      >
        View profile
      </button>
    </div>
  </article>
);
