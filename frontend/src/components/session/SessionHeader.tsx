/**
 * Shared session header for the coach session page and check-in/feedback
 * (Working Copy `.fbh` / coach2 session identity).
 */
import type { ReactNode } from "react";
import { ChevronLeft, Clock, MapPin } from "lucide-react";
import { BrandPill } from "@/components/brand";
import { textButton } from "@/components/schedule/styles";
import { SessionDateTile } from "@/components/my-session/CoachSessionCard";
import { cn } from "@/lib/utils";
import { formatDayISO, sessionEnd, sessionStart } from "@/utils/schedule";
import { getZonedISODate } from "@/utils/dateHelpers";
import { formatInstantSpan } from "@/utils/viewerTime";

export type SessionHeaderPerson = {
  name: string;
  imageUrl?: string | null;
  line?: string | null;
};

export type SessionHeaderModel = {
  title: string;
  sessionType: "individual" | "group";
  pillar?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  location: "online" | "in-person";
  place?: string | null;
  statusPills?: ReactNode;
  people?: SessionHeaderPerson[];
  peopleLabel?: string;
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

const caption = "text-[12px] leading-[16px] tracking-[-0.03em] text-[#767980]";

/** Page chrome: Back + title + subtitle + actions (Working Copy `AN.ph`). */
export const SessionPageHeader = ({
  title,
  subtitle,
  actions,
  onBack,
  backLabel = "Back",
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  onBack: () => void;
  backLabel?: string;
}) => (
  <>
    <button type="button" className={cn(textButton, "-mb-1.5 self-start text-[#767980]")} onClick={onBack}>
      <ChevronLeft strokeWidth={1.5} aria-hidden="true" />
      {backLabel}
    </button>
    <header className="flex items-start gap-4">
      <div className="flex min-w-0 grow flex-col gap-1">
        <h1 className="text-[24px] font-bold leading-[1.15] tracking-[-0.05em] text-[#1A202C] md:text-[32px] md:leading-[1.1]">{title}</h1>
        {subtitle ? <span className="text-[14px] leading-[18px] text-[#767980]">{subtitle}</span> : null}
      </div>
      {actions ? <div className="hidden flex-wrap items-center gap-2 md:flex">{actions}</div> : null}
    </header>
  </>
);

/** Session identity card with three-line date tile (shared by session + feedback). */
export const SessionHeader = ({
  session,
  timeZone,
  className,
}: {
  session: SessionHeaderModel;
  timeZone: string;
  className?: string;
}) => {
  const group = session.sessionType === "group";
  const start = sessionStart(session);
  const end = sessionEnd(session);
  const day = getZonedISODate(start, timeZone);
  const where = session.location === "online" ? "Video call" : session.place || "In person";
  const people = session.people ?? [];

  return (
    <section aria-label="Session" className={cn("flex flex-col gap-3.5 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[18px] pb-4 pt-[18px]", className)}>
      <div className="flex flex-wrap gap-1.5">
        {group ? <BrandPill tone="teal">Group</BrandPill> : <BrandPill tone="blue">Individual</BrandPill>}
        {session.pillar ? <BrandPill tone="neutral">{session.pillar}</BrandPill> : null}
        {session.statusPills}
      </div>
      <div className="flex items-center gap-3.5">
        <SessionDateTile day={day} size="lg" />
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[20px] font-semibold leading-[22px] tracking-[-0.05em] text-[#1A202C]">{session.title}</span>
          <span className={cn(caption, "flex items-center gap-1.5")}>
            <Clock className="size-3.5 flex-none" strokeWidth={1.5} aria-hidden="true" />
            {formatDayISO(day, { weekday: "short", month: "short", day: "numeric" })} · {formatInstantSpan(start, end, timeZone)}
          </span>
          <span className={cn(caption, "flex items-center gap-1.5")}>
            <MapPin className="size-3.5 flex-none" strokeWidth={1.5} aria-hidden="true" />
            <span className="truncate">{where}</span>
          </span>
        </div>
      </div>
      {people.length ? (
        <div className="flex items-center gap-2.5 border-t border-[#EAEADF] pt-3.5">
          {group ? (
            <>
              <span className="flex">
                {people.slice(0, 4).map((a, i) => (
                  <span
                    key={`${a.name}-${i}`}
                    className={cn(
                      "flex size-[28px] items-center justify-center overflow-hidden rounded-full border-2 border-[#F7F7F0] bg-[#E5EDF7] text-[10px] font-semibold text-[#0054B4]",
                      i > 0 && "-ml-1.5"
                    )}
                    aria-hidden="true"
                  >
                    {a.imageUrl ? <img src={a.imageUrl} alt="" className="size-full object-cover" /> : initials(a.name)}
                  </span>
                ))}
                {people.length > 4 ? (
                  <span
                    className="-ml-1.5 flex size-[28px] items-center justify-center rounded-full border-2 border-[#F7F7F0] bg-[#F4F4EB] text-[10px] font-semibold text-[#484D56]"
                    aria-hidden="true"
                  >
                    +{people.length - 4}
                  </span>
                ) : null}
              </span>
              <span className={caption}>{session.peopleLabel ?? `${people.length} ${people.length === 1 ? "athlete" : "athletes"}`}</span>
            </>
          ) : (
            <>
              <span className="flex size-8 items-center justify-center overflow-hidden rounded-full bg-[#E5EDF7] text-[11px] font-semibold text-[#0054B4]">
                {people[0].imageUrl ? <img src={people[0].imageUrl} alt="" className="size-full object-cover" /> : initials(people[0].name)}
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-[14px] font-medium text-[#1A202C]">{people[0].name}</span>
                {people[0].line ? <span className={caption}>{people[0].line}</span> : null}
              </span>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
};
