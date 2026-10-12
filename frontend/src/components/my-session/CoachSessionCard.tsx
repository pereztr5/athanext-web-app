/**
 * Coach My Sessions (Working Copy 4 / coach2 `c-sessions`): compact date-tile rows.
 */
import type { ReactNode } from "react";
import { Children, useState } from "react";
import { ChevronRight, Info, User, Users } from "lucide-react";

import { BrandPill } from "@/components/brand";
import { textButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import type { UISession } from "@/types/my-sessions";
import { formatDayISO, plural } from "@/utils/schedule";
import { coachSessionTitle, type CoachCardKind, type OccurrenceInfo } from "./coachSessions";

const startsIn = (start: string, now: Date) => {
  const ms = new Date(start).getTime() - now.getTime();
  if (ms <= 0) return "";
  const h = Math.floor(ms / 36e5);
  const d = Math.floor(h / 24);
  const mn = Math.floor(ms / 6e4) % 60;
  return d ? `Starts in ${d}d ${h % 24}h` : h ? `Starts in ${h}h ${mn}m` : `Starts in ${mn}m`;
};

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/** Three-line date tile: month, day number, weekday (WC4 `.dt`). */
export const SessionDateTile = ({ day, size = "sm" }: { day: string; size?: "sm" | "lg" }) => (
  <span
    className={cn(
      "flex flex-none flex-col items-center justify-center gap-0.5 rounded-[8px] border border-[#EAEADF] bg-[#F7F7F0]",
      size === "lg" ? "h-[68px] w-[64px]" : "h-[54px] w-[44px]"
    )}
  >
    <small
      className={cn(
        "font-semibold uppercase text-[#0054B4]",
        size === "lg" ? "text-[12px] leading-[12px] tracking-[0.02em]" : "text-[10px] leading-[11px]"
      )}
    >
      {formatDayISO(day, { month: "short" })}
    </small>
    <b
      className={cn(
        "font-bold tracking-[-0.05em] text-[#1A202C]",
        size === "lg" ? "text-[28px] leading-[28px]" : "text-[18px] leading-[18px]"
      )}
    >
      {formatDayISO(day, { day: "numeric" })}
    </b>
    <em
      className={cn(
        "font-medium not-italic text-[#767980]",
        size === "lg" ? "text-[11px] leading-[12px]" : "text-[10px] leading-[11px]"
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
  onViewDetails,
}: {
  session: UISession;
  kind: CoachCardKind;
  now: Date;
  dayISO: string;
  time: string;
  location: string;
  info?: OccurrenceInfo;
  hasFeedback: boolean;
  onViewDetails: () => void;
}) => {
  const group = session.type === "group";
  const pillar = info?.pillar ?? session.pillarSlot ?? null;
  const soon = kind === "up" && new Date(session.start).getTime() - now.getTime() <= THREE_DAYS_MS ? startsIn(session.start, now) : "";
  const due = kind === "past" && !hasFeedback;
  const total = Number(session.totalAthletes ?? session.athletes?.length ?? 0) || 0;
  const capacity = group && info?.capacity ? info.capacity : null;
  const countBit = group ? `, ${total} of ${capacity ?? "—"}` : total ? `, ${plural(total, "athlete")}` : "";

  const tag = due ? (
    <BrandPill tone="amber">Notes due</BrandPill>
  ) : kind === "now" ? (
    <BrandPill tone="blue">Now</BrandPill>
  ) : soon ? (
    <BrandPill tone="amber">{soon}</BrandPill>
  ) : group ? (
    <BrandPill tone="teal">
      <Users className="size-3" strokeWidth={1.5} aria-hidden="true" />
      Group
    </BrandPill>
  ) : (
    <BrandPill tone="neutral">
      <User className="size-3" strokeWidth={1.5} aria-hidden="true" />
      1-on-1
    </BrandPill>
  );

  return (
    <button
      type="button"
      onClick={onViewDetails}
      className="flex w-full items-center gap-3.5 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-3.5 py-3 text-left hover:border-[#C1C1B8]"
    >
      <SessionDateTile day={dayISO} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]">
          {coachSessionTitle(session, pillar)}
        </span>
        <span className="truncate text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">
          {time}, {location}
          {countBit}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {tag}
        <ChevronRight className="size-4 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
      </span>
    </button>
  );
};

const PAGE = 20;

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
    <div className="flex flex-col gap-2">
      {items.length ? (
        <>
          <div className="flex flex-col gap-2">{items.slice(0, limit)}</div>
          {items.length > limit ? (
            <button type="button" className={cn(textButton, "self-center")} onClick={() => setLimit((l) => l + PAGE)}>
              Show {Math.min(PAGE, items.length - limit)} more of {items.length}
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
