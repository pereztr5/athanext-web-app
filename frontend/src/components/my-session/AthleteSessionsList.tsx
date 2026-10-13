/**
 * Athlete My Sessions (Working Copy 4): Upcoming / Requested / Past / Cancelled tabs,
 * search, type filter, and coach-style hybrid cards (no price; coach once; status pills).
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, CalendarPlus, ChevronRight, Clock, MapPin, Search, User, Users, Video } from "lucide-react";
import { BrandPill } from "@/components/brand";
import { SessionDateTile } from "@/components/my-session/CoachSessionCard";
import { card, input, meta, pageTitle, primaryButton, secondaryButton, segButton, segGroup } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import type { UISession } from "@/types/my-sessions";
import { formatLocationSentence } from "@/utils/sessionFormatting";
import { getZonedISODate } from "@/utils/dateHelpers";
import { addDaysISO, formatDayISO } from "@/utils/schedule";
import { formatInstantSpan, timeZoneAbbreviation } from "@/utils/viewerTime";

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

/** Card title: group name or pillar — coach is not in the title (WC4 #25). */
export const sessionListTitle = (s: UISession) => {
  if (s.type === "group" && s.title) return s.title;
  return s.pillarSlot || (s.type === "group" ? "Group session" : "1-on-1");
};

const coachInitials = (name: string | null | undefined) =>
  (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

const startsInLabel = (start: string, now: number) => {
  const ms = new Date(start).getTime() - now;
  if (ms <= 0) return "";
  const h = Math.floor(ms / 36e5);
  const d = Math.floor(h / 24);
  const mn = Math.floor(ms / 6e4) % 60;
  if (d >= 1) return d === 1 ? "Tomorrow" : `In ${d} days`;
  if (h >= 3) return "Today";
  return h ? `Starts in ${h}h ${mn}m` : `Starts in ${mn}m`;
};

const AthleteSessionCard = ({
  session,
  timeZone,
  onOpen,
}: {
  session: UISession;
  timeZone: string;
  onOpen: (s: UISession) => void;
}) => {
  const start = new Date(session.start);
  const end = new Date(session.end);
  const now = Date.now();
  const dayISO = getZonedISODate(start, timeZone);
  const group = session.type === "group";
  const pillar = session.pillarSlot;
  const title = sessionListTitle(session);
  const online = session.location === "online";
  const place = online ? "Video call" : formatLocationSentence(session.location) || "In person";
  const canceled = session.computedStatus === "canceled" || session.dbStatus === "canceled";
  const past = session.computedStatus === "past" || session.computedStatus === "completed";
  const requested = session.dbStatus === "requested";
  const offered = session.dbStatus === "pending_payment";
  const needsPay = offered || (session.paymentStatus === "unpaid" && !past && !canceled && !requested);
  const feedbackReady = past && Boolean(session.hasSlotFeedback);
  const soon = !past && !canceled && !requested ? startsInLabel(session.start, now) : "";
  const tz = timeZoneAbbreviation(timeZone, start);
  const dateLine = `${formatDayISO(dayISO, { weekday: "short", month: "short", day: "numeric" })} · ${formatInstantSpan(start, end, timeZone)}${tz ? ` ${tz}` : ""}`;

  const actionLabel =
    needsPay && offered ? "Confirm and pay" : needsPay ? "Pay now" : feedbackReady ? "View feedback" : null;

  return (
    <button
      type="button"
      onClick={() => onOpen(session)}
      className={cn(
        "flex w-full flex-wrap items-stretch gap-3 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] p-3.5 text-left hover:border-[#C1C1B8] md:flex-nowrap md:gap-3.5",
        canceled && "opacity-60",
      )}
    >
      <SessionDateTile day={dayISO} />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-wrap gap-1.5">
          <BrandPill tone={group ? "teal" : "blue"}>
            {group ? <Users className="size-3" strokeWidth={1.5} aria-hidden="true" /> : <User className="size-3" strokeWidth={1.5} aria-hidden="true" />}
            {group ? "Group" : "1-on-1"}
          </BrandPill>
          {pillar && title !== pillar ? <BrandPill tone="neutral">{pillar}</BrandPill> : null}
          {canceled ? <BrandPill tone="amber">Cancelled</BrandPill> : null}
          {requested ? <BrandPill tone="amber">Requested</BrandPill> : null}
          {offered ? <BrandPill tone="amber">Offered</BrandPill> : null}
          {!canceled && !requested && !offered && past ? (
            feedbackReady ? <BrandPill tone="green">Feedback ready</BrandPill> : <BrandPill tone="amber">Notes coming</BrandPill>
          ) : null}
          {!canceled && !requested && !offered && !past && soon ? <BrandPill tone="amber">{soon}</BrandPill> : null}
        </span>
        <span className="truncate text-[16px] font-semibold leading-5 tracking-[-0.05em] text-[#1A202C]">{title}</span>
        <span className="flex flex-col gap-1 text-[12px] leading-4 tracking-[-0.03em] text-[#767980]">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3 flex-none" strokeWidth={1.5} aria-hidden="true" />
            {dateLine}
          </span>
          <span className="inline-flex items-center gap-1">
            {online ? (
              <Video className="size-3 flex-none" strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <MapPin className="size-3 flex-none" strokeWidth={1.5} aria-hidden="true" />
            )}
            {place}
          </span>
        </span>
        {session.coachName ? (
          <span className="flex items-center gap-2 pt-0.5 text-[12px] text-[#484D56]">
            <span className="flex size-6 items-center justify-center rounded-full bg-[#E5EDF7] text-[10px] font-semibold text-[#0054B4]">
              {coachInitials(session.coachName)}
            </span>
            {session.coachName}
          </span>
        ) : null}
      </span>
      <span className="flex w-full shrink-0 items-center justify-end gap-2 self-center md:w-auto">
        {actionLabel ? (
          <span className={cn(secondaryButton, "pointer-events-none h-9 px-3 text-[13px]")}>{actionLabel}</span>
        ) : (
          <ChevronRight className="size-4 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
        )}
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
              <div className="flex flex-col gap-2">
                {rows.map((s) => (
                  <AthleteSessionCard key={s.bookingId || s.id} session={s} timeZone={timeZone} onOpen={onOpen} />
                ))}
              </div>
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
