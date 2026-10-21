import { Link } from "react-router-dom";
import { BadgeCheck, Building2, MapPin } from "@/components/icons";
import { BrandPill, BrandStar } from "@/components/brand";
import { FreeIntroPill } from "@/components/intro-calls";
import { primaryButton, smallButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";

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
  /** The page of the organization that shows this coach. Without one the academy is plain text. */
  academyTo?: string | null;
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
  academyTo,
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
    className="flex min-w-0 cursor-pointer flex-col gap-[14px] rounded-card border border-light-525 bg-light-300 p-[22px] transition-colors hover:border-primary-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
  >
    <div className="flex min-w-0 items-start gap-3">
      <span
        className={cn(
          "relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-light-550 text-label-sm",
          academy ? "bg-secondary-50 text-secondary" : "bg-primary-50 text-primary"
        )}
      >
        {photoUrl ? <img src={photoUrl} alt="" className="absolute inset-0 size-full object-cover" /> : initialsOf(name)}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="flex min-w-0 items-center gap-1.5 text-card-title text-dark">
          <span className="truncate">{name}</span>
          {verified ? <BadgeCheck className="size-4 shrink-0 text-primary" strokeWidth={1.75} aria-label="Verified" /> : null}
        </h2>
        <span className="truncate text-caption text-dark-300">{role}</span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-caption text-dark-300">
          {rating ? (
            <>
              <BrandStar size={13} />
              <b className="font-medium text-dark">{rating}</b>
              <span>({reviewCount})</span>
              {area ? <span className="mx-1 size-[3px] shrink-0 rounded-full bg-dark-200" aria-hidden="true" /> : null}
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

    <div className="mt-auto flex flex-col gap-3 border-t border-light-525 pt-3">
      <div className="flex min-w-0 flex-col gap-1 text-caption text-dark-300">
        {price ? (
          <span className="whitespace-nowrap">
            From <b className="text-label-sm text-dark">${Math.round(price).toLocaleString("en-US")}</b>
          </span>
        ) : null}
        <span className="min-w-0 overflow-hidden">
          {academy && academyTo ? (
            <Link
              to={academyTo}
              onClick={(event) => event.stopPropagation()}
              className="inline-flex max-w-full items-center gap-1 font-medium text-primary hover:text-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Building2 className="size-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <span className="truncate">{academy}</span>
            </Link>
          ) : academy ? (
            <span className="inline-flex max-w-full items-center gap-1 font-medium">
              <Building2 className="size-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <span className="truncate">{academy}</span>
            </span>
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
