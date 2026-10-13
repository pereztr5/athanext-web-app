/**
 * Coach My Sessions (Working Copy 4 hybrid `.ms-hc`): date tile, pill row, athlete-first
 * title, clock/place lines, face stack, price, and View / Check in / feedback actions.
 */
import type { ReactNode } from "react";
import { Children, useState } from "react";
import { Clock, Info, MapPin, User, Users, Video } from "lucide-react";
import { BrandPill } from "@/components/brand";
import { primaryButton, secondaryButton, textButton } from "@/components/schedule/styles";
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
      "flex flex-none flex-col items-center justify-center gap-1 rounded-[8px] border border-[#EAEADF] bg-[#FDFDFC]",
      size === "lg" ? "h-[72px] w-[56px]" : "h-[54px] w-[44px]",
    )}
    aria-label={formatDayISO(day, { weekday: "long", month: "long", day: "numeric" })}
  >
    <small
      className={cn(
        "font-semibold uppercase tracking-[-0.03em] text-[#0054B4]",
        size === "lg" ? "text-[12px] leading-[13px]" : "text-[10px] leading-[11px]",
      )}
    >
      {formatDayISO(day, { month: "short" })}
    </small>
    <b
      className={cn(
        "font-bold tracking-[-0.05em] text-[#1A202C]",
        size === "lg" ? "text-[24px] leading-6" : "text-[18px] leading-[18px]",
      )}
    >
      {formatDayISO(day, { day: "numeric" })}
    </b>
    <em
      className={cn(
        "font-medium not-italic tracking-[-0.03em] text-[#767980]",
        size === "lg" ? "text-[12px] leading-[13px]" : "text-[10px] leading-[11px]",
      )}
    >
      {formatDayISO(day, { weekday: "short" }).toUpperCase()}
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
  const soon =
    kind === "up"
      ? startMs > 0 && startMs <= 3 * 36e5
        ? startsIn(session.start, now)
        : daysOut === 1
          ? "Tomorrow"
          : daysOut > 1 && daysOut <= 3
            ? `In ${daysOut} days`
            : ""
      : "";

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
        ? `${total} of ${capacity ?? "—"} athletes`
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
    ) : soon ? (
      <BrandPill tone={startMs > 0 && startMs <= 3 * 36e5 ? "amber" : "neutral"}>{soon}</BrandPill>
    ) : null;

  const faces = athletes.slice(0, 5);
  const extra = Math.max(0, total - faces.length);
  const placeOnline = location === "Online" || location === "Video call" || session.location === "online";
  const tz = timeZoneAbbr ? ` ${timeZoneAbbr}` : "";
  const dateLine = `${formatDayISO(dayISO, { weekday: "short", month: "short", day: "numeric" })} · ${time}${tz}`;

  const viewBtn = (
    <button type="button" className={cn(secondaryButton, "h-9 px-3 text-[13px]")} onClick={onViewDetails}>
      View details
    </button>
  );
  const acts =
    kind === "now" ? (
      <>
        {viewBtn}
        {onCheckIn ? (
          <button type="button" className={cn(primaryButton, "h-9 px-3 text-[13px]")} onClick={onCheckIn}>
            Check in
          </button>
        ) : null}
      </>
    ) : kind === "past" ? (
      <>
        {viewBtn}
        {total > 0 && onFeedback ? (
          <button
            type="button"
            className={cn(due ? primaryButton : secondaryButton, "h-9 px-3 text-[13px]")}
            onClick={onFeedback}
          >
            {due ? "Add feedback" : "Edit feedback"}
          </button>
        ) : null}
      </>
    ) : (
      viewBtn
    );

  return (
    <div className="flex flex-wrap items-stretch gap-3 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] p-4 md:flex-nowrap md:gap-4">
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
        <span className="text-[16px] font-semibold leading-5 tracking-[-0.05em] text-[#1A202C]">{title}</span>
        <span className="flex flex-wrap gap-x-3.5 gap-y-1 text-[12px] leading-4 tracking-[-0.03em] text-[#767980]">
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
                    "flex size-7 items-center justify-center overflow-hidden rounded-full border-2 border-[#F7F7F0] bg-[#E5EDF7] text-[10px] font-semibold text-[#0054B4]",
                    i > 0 && "-ml-1.5",
                  )}
                >
                  {a.avatar ? <img src={a.avatar} alt="" className="size-full object-cover" /> : initials(a.name)}
                </span>
              ))}
              {extra > 0 ? (
                <span
                  className="-ml-1.5 flex size-7 items-center justify-center rounded-full border-2 border-[#F7F7F0] bg-[#EAEADF] text-[10px] font-semibold text-[#484D56]"
                  title={`+${extra} more`}
                >
                  +{extra}
                </span>
              ) : null}
            </div>
          ) : null}
          <span className="text-[12px] text-[#767980]">{whoTxt}</span>
        </div>
      </div>
      <div className="flex w-full flex-col gap-2.5 md:w-auto md:items-end md:justify-between">
        <div className="flex items-baseline gap-1 md:flex-col md:items-end md:gap-0">
          <b className="text-[18px] font-semibold tracking-[-0.05em] text-[#1A202C]">
            ${Math.round(Number(session.rate) || 0)}
          </b>
          <span className="text-[12px] text-[#767980]">per athlete</span>
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
        <div className="flex items-center gap-2 rounded-[12px] border border-dashed border-[#EAEADF] p-4 text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
          <Info className="size-4 flex-none" strokeWidth={1.5} aria-hidden="true" />
          <span>{empty}</span>
        </div>
      )}
    </div>
  );
};

/** @deprecated Prefer CoachSessionList + tags on My Sessions. */
export const CoachSessionSection = ({
  title,
  empty,
  children,
}: {
  kind?: CoachCardKind;
  title: string;
  empty: string;
  children: ReactNode;
}) => (
  <section className="flex flex-col gap-3">
    <h2 className="text-[20px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]">{title}</h2>
    <CoachSessionList empty={empty}>{children}</CoachSessionList>
  </section>
);
