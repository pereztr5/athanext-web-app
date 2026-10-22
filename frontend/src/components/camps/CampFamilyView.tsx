/**
 * The camp page as families see it (mockup "1 · Camp page"). The public sign-up page and the
 * editor's live preview both render this, so the coach checks exactly what families get.
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Calendar, Check, MapPin } from "@/components/icons";
import { BrandPill } from "@/components/brand";
import { cn } from "@/lib/utils";
import { coachProfilePath } from "@/utils/coachSlug";
import { formatCampDates, formatCampMoney, formatCampTimes, perDayLine } from "@/utils/camps";
import { firstName, groupSpotsText, type CampView, type CampViewGroup } from "./campView";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

export const CampAvatar = ({ name, photo, size = 28 }: { name: string; photo: string | null; size?: number }) => (
  <span
    className="inline-flex flex-none items-center justify-center overflow-hidden rounded-full border border-primary-300 bg-primary-50 text-label-xsm text-primary"
    style={{ width: size, height: size }}
    aria-hidden="true"
  >
    {photo ? <img src={photo} alt="" className="size-full object-cover" /> : initials(name)}
  </span>
);

const Fact = ({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) => (
  <div className="flex items-start gap-2.5 text-dark-300">
    <Icon className="mt-[1px] size-4 flex-none" strokeWidth={1.5} aria-hidden="true" />
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="text-label-xsm">{label}</span>
      <b className="break-words text-label-sm text-dark">{value}</b>
    </span>
  </div>
);

/** One group as a radio row. */
export const CampGroupChoice = ({
  group,
  on,
  onPick,
  disabled,
}: {
  group: CampViewGroup;
  on: boolean;
  onPick?: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    role="radio"
    aria-checked={on}
    disabled={group.full || disabled || !onPick}
    onClick={onPick}
    className={cn(
      "flex min-h-[44px] w-full items-center gap-3 rounded-control border px-3.5 py-3 text-left transition-colors disabled:cursor-not-allowed",
      on ? "border-primary bg-primary-50" : "border-light-525 bg-light-300 enabled:hover:bg-light-200",
      group.full && "bg-light-400",
    )}
  >
    <span
      className={cn(
        "flex size-4 flex-none items-center justify-center rounded-full border bg-light-50",
        on ? "border-primary" : "border-dark-250",
      )}
      aria-hidden="true"
    >
      {on ? <span className="size-2 rounded-full bg-primary" /> : null}
    </span>
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-label-sm text-dark">{group.name || "All athletes"}</span>
      <span className="text-caption text-dark-300">
        {[formatCampTimes(group.start, group.end), group.description].filter(Boolean).join(" · ")}
      </span>
    </span>
    <span className={cn("flex-none text-caption", group.full ? "text-error-700" : "text-dark-300")}>{groupSpotsText(group)}</span>
  </button>
);

export const CampFamilyView = ({
  view,
  groupId,
  onGroup,
  compact = false,
  children,
}: {
  view: CampView;
  groupId?: string | null;
  onGroup?: (id: string) => void;
  /** Editor preview: smaller cover, coach profile links off. */
  compact?: boolean;
  /** Below the groups (the public page puts nothing here; the editor shows the fee line). */
  children?: ReactNode;
}) => {
  const coachFirst = firstName(view.coachName);
  const dates = formatCampDates(view.startsOn, view.endsOn);
  const linked = view.linkedCoach;
  const coachLine = linked ? `${coachFirst} and ${linked.name}` : view.coachName;
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-card border border-light-525 bg-light-300">
      <div className={cn("w-full flex-none bg-dark", compact ? "h-[130px]" : "h-[200px] md:h-[260px]")}>
        {view.coverUrl ? (
          <img src={view.coverUrl} alt="" className="size-full object-cover" style={{ objectPosition: "50% 22%" }} />
        ) : null}
      </div>
      <div className={cn("flex flex-col gap-4", compact ? "px-4 py-4" : "px-[18px] pb-5 pt-[22px] md:px-[25px]")}>
        <div className="flex items-center gap-2">
          <span className="flex">
            <CampAvatar name={view.coachName} photo={view.coachPhoto} />
            {linked ? (
              <span className="-ml-2">
                <CampAvatar name={linked.name} photo={linked.photo_url} />
              </span>
            ) : null}
          </span>
          <span className="min-w-0 truncate text-caption text-dark-300">{coachLine}</span>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className={cn("break-words text-dark", compact ? "text-card-title" : "text-page-title-phone md:text-page-title")}>
            {view.name || "Camp name"}
          </h1>
          <div className="flex flex-wrap gap-1">
            <BrandPill tone="teal">Camp</BrandPill>
            {view.tags.map((tag) => (
              <BrandPill key={tag} tone="neutral">
                {tag}
              </BrandPill>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-highlight tabular-nums text-dark">{view.priceCents ? formatCampMoney(view.priceCents) : "$0"}</span>
          <span className="text-caption text-dark-300">
            {view.priceCents ? `${perDayLine(view.priceCents, view.days)} · per athlete` : "Per athlete"}
          </span>
        </div>
        {dates || view.location ? (
          <div className="flex flex-col gap-3 rounded-control bg-light-400 px-4 py-3.5">
            {dates ? <Fact icon={Calendar} label="Dates" value={dates} /> : null}
            {view.location ? <Fact icon={MapPin} label="Location" value={view.location} /> : null}
          </div>
        ) : null}
        {view.groups.length ? (
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Pick a group">
            <span className="text-label-xsm text-dark-300">Pick a group</span>
            {view.groups.map((group) => (
              <CampGroupChoice
                key={group.id}
                group={group}
                on={groupId === group.id}
                onPick={onGroup ? () => onGroup(group.id) : undefined}
              />
            ))}
          </div>
        ) : null}
        {children}
        {view.included.length || linked ? (
          <div className="flex flex-col gap-2">
            <span className="text-label-xsm text-dark-300">Included</span>
            <ul className="flex flex-col gap-2">
              {view.included.map((item, i) => (
                <li key={`${item}-${i}`} className="flex items-start gap-2 text-body-m text-dark">
                  <Check className="mt-[1px] size-4 flex-none text-success-600" strokeWidth={2} aria-hidden="true" />
                  <span className="min-w-0 break-words">{item}</span>
                </li>
              ))}
            </ul>
            {linked ? (
              <div className="flex items-center gap-2.5 rounded-control border border-light-525 bg-light-300 px-2.5 py-2">
                <CampAvatar name={linked.name} photo={linked.photo_url} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="truncate text-label-sm text-dark">{linked.name}</b>
                  <span className="text-caption text-dark-300">On AthaNext</span>
                </span>
                {!compact && linked.slug ? (
                  <Link to={coachProfilePath(linked.slug)} className="text-label-sm text-primary hover:text-primary-600">
                    View profile
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        {view.coachBio ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-label-xsm text-dark-300">About {coachFirst}</span>
            <p className={cn("whitespace-pre-line text-paragraph text-dark", compact && "line-clamp-3")}>{view.coachBio}</p>
            {!compact && view.coachSlug ? (
              <Link to={coachProfilePath(view.coachSlug)} className="self-start text-label-sm text-primary hover:text-primary-600">
                View profile
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
};
