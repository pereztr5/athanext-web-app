/**
 * Coach My Sessions (Working Copy 4 hybrid `.ms-hc`): date tile, pill row, athlete-first
 * title, clock/place lines, face stack, price, and View / Check in / feedback actions.
 */
import type { ReactNode } from "react";
import { Children, useState } from "react";
import { Clock, Info, MapPin, User, Users, Video } from "@/components/icons";
import { BrandPill } from "@/components/brand";
import { primaryButton, secondaryButton, smallButton, textButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import type { UISession } from "@/types/my-sessions";
import { formatDayISO } from "@/utils/schedule";
import { getZonedISODate } from "@/utils/dateHelpers";
import type { CoachCardKind, OccurrenceInfo } from "./coachSessions";

const startsIn = (start: string, now: Date) => {
  const ms = new Date(start).getTime() - now.getTime();
  if (ms <= 0) return "";
  const h = Math.floor(ms / 36e5);
  const d = Math.floor(h / 24);
  const mn = Math.floor(ms / 6e4) % 60;
  return d ? `Starts in ${d}d ${h % 24}h` : h ? `Starts in ${h}h ${mn}m` : `Starts in ${mn}m`;
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/** Three-line date tile: month, day number, weekday (WC4 `.ms-dt`). */
export const SessionDateTile = ({ day, size = "lg" }: { day: string; size?: "sm" | "lg" }) => (
  <span
    className={cn(
      "flex flex-none flex-col items-center justify-center gap-1 rounded-control border border-light-525 bg-light-50",
      size === "lg" ? "h-[72px] w-[56px]" : "h-[54px] w-[44px]",
    )}
    aria-label={formatDayISO(day, { weekday: "long", month: "long", day: "numeric" })}
  >
    <small
      className={cn(
        "text-label-xsm text-primary",
      )}
    >
      {formatDayISO(day, { month: "short" })}
    </small>
    <b
      className={cn(
        "tabular-nums text-dark",
        size === "lg" ? "text-section" : "text-subtitle",
      )}
    >
      {formatDayISO(day, { day: "numeric" })}
    </b>
    <em
      className={cn(
        "text-label-xsm not-italic text-dark-300",
      )}
    >
      {formatDayISO(day, { weekday: "short" })}
    </em>
  </span>
);

export const CoachSessionCard = ({
  session,
  kind,
  now,
  dayISO,
  time,
  location,
  info,
  hasFeedback,
  timeZone,
  timeZoneAbbr,
  onViewDetails,
  onCheckIn,
  onFeedback,
}: {
  session: UISession;
  kind: CoachCardKind;
  now: Date;
  dayISO: string;
  time: string;
  location: string;
  info?: OccurrenceInfo;
  hasFeedback: boolean;
  timeZone: string;
  timeZoneAbbr?: string;
  onViewDetails: () => void;
  onCheckIn?: () => void;
  onFeedback?: () => void;
}) => {
  const group = session.type === "group";
  const pillar = info?.pillar ?? session.pillarSlot ?? null;
  const athletes = session.athletes ?? [];
  const total = Number(session.totalAthletes ?? athletes.length) || athletes.length;
  const capacity = group && info?.capacity ? info.capacity : null;
  const due = kind === "past" && !hasFeedback && total > 0;
  const startMs = new Date(session.start).getTime() - now.getTime();
  const todayISO = getZonedISODate(now, timeZone);
  const daysOut = Math.round(
    (Date.parse(`${dayISO}T12:00:00Z`) - Date.parse(`${todayISO}T12:00:00Z`)) / 864e5,
  );
  // Calendar days, not elapsed hours: the pill shows only when the session is 3 days out or less.
  const startsLabel = kind === "up" && startMs > 0 && daysOut <= 3 ? startsIn(session.start, now) : "";

  const athleteTitle =
    athletes[0]?.name ||
    session.athleteNames?.[0] ||
    (session.athleteNamesDisplay && session.athleteNamesDisplay !== "No athletes"
      ? session.athleteNamesDisplay.split(",")[0]?.trim()
      : null);
  const title = group
    ? session.title?.trim() && !/^upcoming\b/i.test(session.title.trim())
      ? session.title.trim()
      : "Group session"
    : `1-on-1 with ${athleteTitle ? firstName(athleteTitle) : "athlete"}`;

  const whoTxt =
    total <= 0
      ? "No athletes yet"
      : group
        ? capacity ? `${total} of ${capacity} athletes` : `${total} ${total === 1 ? "athlete" : "athletes"}`
        : `1 athlete`;

  const statusPill =
    kind === "now" ? (
      <BrandPill tone="green">In progress</BrandPill>
    ) : kind === "past" ? (
      total <= 0 ? null : due ? (
        <BrandPill tone="amber">Feedback due</BrandPill>
      ) : (
        <BrandPill tone="green">Feedback sent</BrandPill>
      )
    ) : startsLabel ? (
      <BrandPill tone="amber">{startsLabel}</BrandPill>
    ) : null;

  const faces = athletes.slice(0, 5);
  const extra = Math.max(0, total - faces.length);
  const placeOnline = location === "Online" || location === "Video call" || session.location === "online";
  const tz = timeZoneAbbr ? ` ${timeZoneAbbr}` : "";
  const dateLine = `${formatDayISO(dayISO, { weekday: "short", month: "short", day: "numeric" })} · ${time}${tz}`;

  const viewPrimary = kind === "up" || (kind === "past" && !due);
  const viewBtn = (
    <button type="button" className={cn(viewPrimary ? primaryButton : secondaryButton, smallButton)} onClick={onViewDetails}>
      View details
    </button>
  );
  const acts =
    kind === "now" ? (
      <>
        {onCheckIn ? (
          <button type="button" className={cn(primaryButton, smallButton)} onClick={onCheckIn}>
            Check in
          </button>
        ) : null}
        {viewBtn}
      </>
    ) : kind === "past" ? (
      <>
        {total > 0 && onFeedback ? (
          <button
            type="button"
            className={cn(due ? primaryButton : secondaryButton, smallButton)}
            onClick={onFeedback}
          >
            {due ? "Add feedback" : "Edit feedback"}
          </button>
        ) : null}
        {viewBtn}
      </>
    ) : (
      viewBtn
    );

  return (
    <div className="flex flex-wrap items-stretch gap-3 rounded-card border border-light-525 bg-light-300 p-4 md:flex-nowrap md:gap-4">
      <SessionDateTile day={dayISO} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap gap-1.5">
          <BrandPill tone={group ? "teal" : "blue"}>
            {group ? <Users className="size-3" strokeWidth={1.5} aria-hidden="true" /> : <User className="size-3" strokeWidth={1.5} aria-hidden="true" />}
            {group ? "Group" : "Individual"}
          </BrandPill>
          {pillar ? <BrandPill tone="neutral">{pillar}</BrandPill> : null}
          {statusPill}
        </div>
        <span className="text-subtitle text-dark">{title}</span>
        <span className="flex flex-wrap gap-x-3.5 gap-y-1 text-caption text-dark-300">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3 flex-none" strokeWidth={1.5} aria-hidden="true" />
            {dateLine}
          </span>
          <span className="inline-flex items-center gap-1">
            {placeOnline ? (
              <Video className="size-3 flex-none" strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <MapPin className="size-3 flex-none" strokeWidth={1.5} aria-hidden="true" />
            )}
            {location}
          </span>
        </span>
        <div className="flex items-center gap-2.5 pt-1">
          {faces.length ? (
            <div className="flex" role="list" aria-label="Athletes">
              {faces.map((a, i) => (
                <span
                  key={a.id || `${a.name}-${i}`}
                  role="listitem"
                  title={a.name}
                  className={cn(
                    "flex size-7 items-center justify-center overflow-hidden rounded-full border-2 border-light-300 bg-primary-50 text-label-xsm text-primary",
                    i > 0 && "-ml-1.5",
                  )}
                >
                  {a.avatar ? <img src={a.avatar} alt="" className="size-full object-cover" /> : initials(a.name)}
                </span>
              ))}
              {extra > 0 ? (
                <span
                  className="-ml-1.5 flex size-7 items-center justify-center rounded-full border-2 border-light-300 bg-light-525 text-label-xsm text-dark-400"
                  title={`+${extra} more`}
                >
                  +{extra}
                </span>
              ) : null}
            </div>
          ) : null}
          <span className="text-caption text-dark-300">{whoTxt}</span>
        </div>
      </div>
      <div className="flex w-full flex-col gap-2.5 md:w-auto md:items-end md:justify-between">
        <div className="flex items-baseline gap-1 md:flex-col md:items-end md:gap-0">
          <b className="text-card-title tabular-nums text-dark">
            ${Math.round(Number(session.rate) || 0)}
          </b>
          <span className="text-caption text-dark-300">per athlete</span>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end [&_button]:flex-1 md:[&_button]:flex-none">{acts}</div>
      </div>
    </div>
  );
};

const PAGE = 5;

export const CoachSessionList = ({
  empty,
  children,
}: {
  empty: string;
  children: ReactNode;
}) => {
  const [limit, setLimit] = useState(PAGE);
  const items = Children.toArray(children);
  return (
    <div className="flex flex-col gap-3">
      {items.length ? (
        <>
          <div className="flex flex-col gap-3">{items.slice(0, limit)}</div>
          {items.length > limit ? (
            <button type="button" className={cn(textButton, "self-start")} onClick={() => setLimit((l) => l + PAGE)}>
              Show {Math.min(PAGE, items.length - limit)} more
            </button>
          ) : null}
        </>
      ) : (
        <div className="flex items-center gap-2 rounded-card border border-dashed border-light-600 p-4 text-body-m text-dark-300">
          <Info className="size-4 flex-none" strokeWidth={1.5} aria-hidden="true" />
          <span>{empty}</span>
        </div>
      )}
    </div>
  );
};

const SECTION_TONE = {
  blue: "border-primary-300 bg-primary-50 text-primary",
  teal: "border-secondary-300 bg-secondary-50 text-secondary-700",
  neutral: "border-light-525 bg-light-400 text-dark-300",
} as const;

/** One stacked list on coach My sessions: icon, title, count, then cards or an empty line. */
export const CoachSessionSection = ({
  icon,
  tone,
  title,
  count,
  empty,
  children,
}: {
  icon: ReactNode;
  tone: keyof typeof SECTION_TONE;
  title: string;
  count: number;
  empty: string;
  children: ReactNode;
}) => (
  <section className="flex flex-col gap-3">
    <div className="flex items-center gap-2.5">
      <span className={cn("flex size-8 flex-none items-center justify-center rounded-control border [&>svg]:size-4", SECTION_TONE[tone])}>
        {icon}
      </span>
      <h2 className="text-card-title text-dark">{title}</h2>
      <BrandPill tone="neutral">{count}</BrandPill>
    </div>
    <CoachSessionList empty={empty}>{children}</CoachSessionList>
  </section>
);
