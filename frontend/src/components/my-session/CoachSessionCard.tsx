import type { ReactNode } from "react";
import { Children, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, History, Info, PlayCircle } from "lucide-react";

import { BrandPill } from "@/components/brand";
import { primaryButton, secondaryButton, textButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import type { UISession } from "@/types/my-sessions";
import { plural } from "@/utils/schedule";
import { getInitialsFromName } from "@/utils/sessionFormatting";
import { coachSessionTitle, type CoachCardKind, type OccurrenceInfo } from "./coachSessions";

/** Coach My Sessions (Working Copy `c-sessions`): sections, cards and the athlete face stack. */

const startsIn = (start: string, now: Date) => {
  const ms = new Date(start).getTime() - now.getTime();
  if (ms <= 0) return "";
  const h = Math.floor(ms / 36e5);
  const d = Math.floor(h / 24);
  const mn = Math.floor(ms / 6e4) % 60;
  return d ? `Starts in ${d}d ${h % 24}h` : h ? `Starts in ${h}h ${mn}m` : `Starts in ${mn}m`;
};

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_FACES = 5;

const realPhoto = (url?: string | null) => (url && !url.includes("dicebear.com") ? url : null);

const capClass = "text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]";

const Fact = ({ label, value, className }: { label: string; value: string; className?: string }) => (
  <div className={cn("flex min-w-0 flex-col gap-1 text-[14px] leading-[18px] tracking-[-0.03em] text-[#1A202C]", className)}>
    <span className={capClass}>{label}</span>
    <span className="[overflow-wrap:anywhere]">{value}</span>
  </div>
);

const Face = ({ name, children, more = false }: { name: string; children: ReactNode; more?: boolean }) => (
  <span
    role="listitem"
    tabIndex={0}
    aria-label={name}
    className={cn(
      "group/face relative -ml-2 inline-flex size-8 flex-none cursor-default items-center justify-center rounded-full border-2 border-[#F7F7F0] text-[11px] font-semibold tracking-[-0.03em] outline-none transition-[margin-left,transform] duration-200 ease-out first:ml-0 hover:z-[2] hover:-translate-y-0.5 hover:border-[#0054B4] focus-visible:z-[2] focus-visible:-translate-y-0.5 focus-visible:border-[#0054B4] group-hover/stack:ml-1.5 group-focus-within/stack:ml-1.5 group-hover/stack:first:ml-0 group-focus-within/stack:first:ml-0 motion-reduce:transition-none",
      more ? "bg-[#F4F4EB] text-[#767980]" : "bg-[#F1F1E6] text-[#484D56]"
    )}
  >
    {children}
    <span
      aria-hidden="true"
      className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 max-w-[260px] -translate-x-1/2 translate-y-1 truncate whitespace-nowrap rounded-[8px] border border-[#EAEADF] bg-[#F7F7F0] px-2.5 py-1.5 text-[12px] font-medium leading-4 tracking-[-0.03em] text-[#1A202C] opacity-0 shadow-[0_0_15px_rgba(0,0,0,0.05)] transition-[opacity,transform] duration-150 group-hover/face:translate-y-0 group-hover/face:opacity-100 group-focus-visible/face:translate-y-0 group-focus-visible/face:opacity-100 motion-reduce:transition-none"
    >
      {name}
    </span>
  </span>
);

const FaceStack = ({ athletes, total }: { athletes: { id: string; name: string; avatar?: string | null }[]; total: number }) => {
  const shown = athletes.slice(0, MAX_FACES);
  const extra = Math.max(total - shown.length, 0);
  const extraNames = athletes.slice(MAX_FACES).map((a) => a.name).join(", ") || plural(extra, "more athlete", "more athletes");
  return (
    <div className="group/stack flex items-center pt-0.5" role="list" aria-label="Athletes">
      {shown.map((athlete) => {
        const photo = realPhoto(athlete.avatar);
        return (
          <Face key={athlete.id} name={athlete.name}>
            {photo ? <img src={photo} alt="" className="size-full rounded-full object-cover" /> : getInitialsFromName(athlete.name)}
          </Face>
        );
      })}
      {extra > 0 ? (
        <Face name={extraNames} more>
          +{extra}
        </Face>
      ) : null}
    </div>
  );
};

export const CoachSessionCard = ({
  session,
  kind,
  now,
  date,
  time,
  location,
  price,
  info,
  hasFeedback,
  onViewDetails,
}: {
  session: UISession;
  kind: CoachCardKind;
  now: Date;
  date: string;
  time: string;
  location: string;
  price: string;
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
  const countLabel = total ? `${plural(total, "athlete")}${capacity ? ` of ${capacity}` : ""}` : "No athletes yet";
  const feedbackHref = `${ROUTES.COACH_SESSION_FEEDBACK}?slotId=${session.occurrenceId || session.id}`;
  const detailsPrimary = kind === "up" || (kind === "past" && !due);
  const buttonWidth = "flex-1 md:flex-none";

  return (
    <div className="flex flex-col gap-4 rounded-[12px] border border-[#EAEADF] bg-[#F7F7F0] p-4 text-left font-sans text-[#1A202C] md:px-5 md:py-[18px]">
      <div className="flex items-start gap-2.5 md:gap-4">
        <div className="flex min-w-0 grow flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[17px] font-semibold leading-[18px] tracking-[-0.02em]">{coachSessionTitle(session, pillar)}</span>
            <BrandPill tone={group ? "teal" : "blue"}>{group ? "Group" : "Individual"}</BrandPill>
            {soon ? <BrandPill tone="amber">{soon}</BrandPill> : null}
            {kind === "now" ? <BrandPill tone="green">In progress</BrandPill> : null}
            {due ? <BrandPill tone="amber">Feedback due</BrandPill> : null}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Fact label="Date" value={date} />
            <Fact label="Time" value={time} />
            <Fact label="Location" value={location} className="col-span-2 md:col-span-1" />
          </div>
        </div>
        <div className="flex flex-none flex-col items-end gap-0.5">
          <b className="text-[17px] font-bold leading-[18px] tracking-[-0.02em] md:text-[20px]">{price}</b>
          <span className={capClass}>per athlete</span>
        </div>
      </div>
      <div className="flex flex-col items-stretch justify-between gap-3 border-t border-[#EAEADF] pt-3.5 md:flex-row md:items-end">
        <div className="flex flex-col gap-1.5">
          <span className={capClass}>{countLabel}</span>
          {total > 0 ? <FaceStack athletes={session.athletes ?? []} total={total} /> : null}
        </div>
        <div className="flex w-full gap-2 md:w-auto">
          {kind !== "up" ? (
            <Link
              to={feedbackHref}
              className={cn(kind === "now" || due ? primaryButton : secondaryButton, buttonWidth)}
            >
              {kind === "now" ? "Check in" : hasFeedback ? "Edit feedback" : "Add feedback"}
            </Link>
          ) : null}
          <button
            type="button"
            onClick={onViewDetails}
            className={cn(detailsPrimary ? primaryButton : secondaryButton, buttonWidth)}
          >
            View details
          </button>
        </div>
      </div>
    </div>
  );
};

const PAGE = 5;

const SECTION_ICONS = {
  now: { Icon: PlayCircle, tone: "bg-[#E5EDF7] text-[#0054B4]" },
  up: { Icon: CalendarCheck, tone: "bg-[#E7F4F8] text-[#117A96]" },
  past: { Icon: History, tone: "bg-[#F4F4EB] text-[#484D56]" },
} as const;

export const CoachSessionSection = ({
  kind,
  title,
  empty,
  children,
}: {
  kind: CoachCardKind;
  title: string;
  empty: string;
  children: ReactNode;
}) => {
  const [limit, setLimit] = useState(PAGE);
  const items = Children.toArray(children);
  const { Icon, tone } = SECTION_ICONS[kind];
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span className={cn("inline-flex size-8 flex-none items-center justify-center rounded-[8px]", tone)} aria-hidden="true">
          <Icon className="size-[17px]" strokeWidth={1.5} />
        </span>
        <h2 className="text-[20px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]">{title}</h2>
        <span className="inline-flex h-[22px] min-w-6 items-center justify-center rounded-[11px] bg-[#F4F4EB] px-[7px] text-[12px] font-semibold tracking-[-0.03em] text-[#484D56]">
          {items.length}
        </span>
      </div>
      {items.length ? (
        <div className="flex flex-col gap-3">{items.slice(0, limit)}</div>
      ) : (
        <div className="flex items-center gap-2 rounded-[12px] border border-dashed border-[#EAEADF] p-4 text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
          <Info className="size-4 flex-none" strokeWidth={1.5} aria-hidden="true" />
          <span>{empty}</span>
        </div>
      )}
      {items.length > limit ? (
        <button type="button" className={cn(textButton, "self-start")} onClick={() => setLimit((l) => l + PAGE)}>
          Show {Math.min(PAGE, items.length - limit)} more
        </button>
      ) : null}
    </section>
  );
};
