/**
 * Athlete My Sessions (Working Copy `a-sessions`): Upcoming / Requested / Past / Cancelled
 * tabs, search, type filter, and compact date-tile rows.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, CalendarPlus, ChevronRight, Search, User, Users } from "lucide-react";
import { BrandPill } from "@/components/brand";
import { card, input, meta, pageTitle, primaryButton, secondaryButton, segButton, segGroup } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import type { UISession } from "@/types/my-sessions";
import { formatLocationSentence } from "@/utils/sessionFormatting";
import { getZonedISODate } from "@/utils/dateHelpers";
import { addDaysISO, formatDayISO } from "@/utils/schedule";
import { formatInstantSpan } from "@/utils/viewerTime";

type Tab = "up" | "req" | "past" | "cancel";
type Kind = "all" | "individual" | "group";

const groupLabel = (iso: string, today: string, timeZone: string, upcoming: boolean) => {
  const day = getZonedISODate(new Date(iso), timeZone);
  if (upcoming) {
    if (day === today) return "Today";
    if (day <= addDaysISO(today, 7)) return "Next 7 days";
  }
  return formatDayISO(day, { month: "long" });
};

export const sessionListTitle = (s: UISession) => {
  const coach = (s.coachName || "your coach").trim();
  const pillar = s.pillarSlot || (s.type === "group" ? s.title : "1-on-1");
  return s.type === "group" && s.title ? s.title : `${pillar} with ${coach}`;
};

const Row = ({ session, timeZone, onOpen }: { session: UISession; timeZone: string; onOpen: (s: UISession) => void }) => {
  const start = new Date(session.start);
  const end = new Date(session.end);
  const now = Date.now();
  const happening = start.getTime() <= now && end.getTime() > now;
  const group = session.type === "group";
  const place = session.location === "online" ? "Video call" : formatLocationSentence(session.location) || "In person";
  const pill =
    session.computedStatus === "canceled" || session.dbStatus === "canceled" ? (
      <BrandPill tone="amber">Cancelled</BrandPill>
    ) : session.dbStatus === "requested" ? (
      <BrandPill tone="amber">Requested</BrandPill>
    ) : happening ? (
      <BrandPill tone="blue">Now</BrandPill>
    ) : session.computedStatus === "past" || session.computedStatus === "completed" ? (
      session.hasSlotFeedback ? null : <BrandPill tone="sunk">Notes coming</BrandPill>
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
      onClick={() => onOpen(session)}
      className="flex w-full items-center gap-3.5 rounded-[10px] bg-[#F7F7F0] px-3.5 py-3 text-left hover:bg-[#F4F4EB]"
    >
      <span className="flex size-[52px] shrink-0 flex-col items-center justify-center rounded-[8px] bg-[#F4F4EB]">
        <small className="text-[10px] font-medium uppercase leading-[12px] text-[#767980]">
          {formatDayISO(getZonedISODate(start, timeZone), { weekday: "short" })}
        </small>
        <b className="text-[20px] font-bold leading-[22px]">{formatDayISO(getZonedISODate(start, timeZone), { day: "numeric" })}</b>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[14px] font-medium leading-[18px]">{sessionListTitle(session)}</span>
        <span className={cn(meta, "truncate")}>
          {formatInstantSpan(start, end, timeZone)}, {place}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {pill}
        <ChevronRight className="size-4 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
      </span>
    </button>
  );
};

export const AthleteSessionsList = ({
  upcoming,
  past,
  canceled,
  timeZone,
  todayISO,
  athleteFirst,
  isParent,
  onOpen,
}: {
  upcoming: UISession[];
  past: UISession[];
  canceled: UISession[];
  timeZone: string;
  todayISO: string;
  athleteFirst: string;
  isParent: boolean;
  onOpen: (session: UISession) => void;
}) => {
  const [tab, setTab] = useState<Tab>("up");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [limit, setLimit] = useState(20);

  const requested = useMemo(() => upcoming.filter((s) => s.dbStatus === "requested"), [upcoming]);
  const bookedUp = useMemo(() => upcoming.filter((s) => s.dbStatus !== "requested"), [upcoming]);

  const source = tab === "up" ? bookedUp : tab === "req" ? requested : tab === "past" ? past : canceled;
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return source.filter((s) => {
      if (kind !== "all" && s.type !== kind) return false;
      if (!needle) return true;
      const hay = `${sessionListTitle(s)} ${s.pillarSlot ?? ""} ${s.location} ${s.coachName ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [source, tab, q, kind]);

  const shown = filtered.slice(0, limit);
  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, UISession[]>();
    for (const s of shown) {
      const g = groupLabel(s.start, todayISO, timeZone, tab === "up" || tab === "req");
      if (!map.has(g)) {
        order.push(g);
        map.set(g, []);
      }
      map.get(g)!.push(s);
    }
    return order.map((g) => [g, map.get(g)!] as const);
  }, [shown, todayISO, timeZone, tab]);

  const tabs: [Tab, string][] = [
    ["up", `Upcoming ${bookedUp.length}`],
    ...(requested.length ? [["req", `Requested ${requested.length}`] as [Tab, string]] : []),
    ["past", `Past ${past.length}`],
    ["cancel", `Cancelled ${canceled.length}`],
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2.5">
          <h1 className={pageTitle}>My Sessions</h1>
          <p className="text-[14px] leading-[18px] text-[#767980]">
            Everything booked on {isParent ? `${athleteFirst}'s` : "your"} account.
          </p>
        </div>
        <Link to={ROUTES.BOOK} className={primaryButton}>
          <CalendarPlus strokeWidth={1.5} aria-hidden="true" />
          Book a session
        </Link>
      </header>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className={cn(segGroup, "w-fit flex-wrap")} role="tablist" aria-label="Session lists">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={cn(segButton(tab === id), "flex-none")}
              onClick={() => {
                setTab(id);
                setLimit(20);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-2 md:justify-end">
          <label className="relative min-w-[220px] flex-1 md:max-w-[280px]">
            <span className="sr-only">Search sessions</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#A3A6AB]" strokeWidth={1.5} aria-hidden="true" />
            <input
              className={cn(input, "pl-9")}
              placeholder="Search coaches, pillars, places"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setLimit(20);
              }}
            />
          </label>
          <select
            className={cn(input, "w-auto")}
            aria-label="Session type"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as Kind);
              setLimit(20);
            }}
          >
            <option value="all">All types</option>
            <option value="individual">Individual</option>
            <option value="group">Group</option>
          </select>
        </div>
      </div>

      {shown.length ? (
        <div className="flex flex-col gap-1">
          {groups.map(([g, rows]) => (
            <div key={g} className="flex flex-col">
              <span className="px-1 pb-1.5 pt-3 text-[12px] font-medium text-[#767980] first:pt-0">{g}</span>
              {rows.map((s) => (
                <Row key={s.bookingId || s.id} session={s} timeZone={timeZone} onOpen={onOpen} />
              ))}
            </div>
          ))}
          {filtered.length > limit ? (
            <button
              type="button"
              className={cn(secondaryButton, "mt-3 self-center")}
              onClick={() => setLimit((n) => n + 20)}
            >
              Show {Math.min(20, filtered.length - limit)} more of {filtered.length}
            </button>
          ) : null}
        </div>
      ) : (
        <section className={cn(card, "items-center py-10 text-center")}>
          <Calendar className="size-8 text-[#A3A6AB]" strokeWidth={1.5} aria-hidden="true" />
          <span className="text-[16px] font-medium">{q ? "No sessions match" : "Nothing here yet"}</span>
          <p className={meta}>{q ? "Try a different search." : "Sessions you book show up here."}</p>
          {!q && tab === "up" ? (
            <Link to={ROUTES.BOOK} className={primaryButton}>
              Book a session
            </Link>
          ) : null}
        </section>
      )}
    </div>
  );
};
