/**
 * Pick days and times with one coach (ATH-73). Tap as many times as you like across days and
 * weeks; they stay picked. With a coach the family hasn't trained with yet (and always in Book
 * by pillar), tapping a time first shows what the session covers.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Clock, Info, MapPin, User, UserCheck, Users, Video, X } from "lucide-react";
import { BrandPill } from "@/components/brand";
import { bookAPI, type BookableSession, type BookingCoach } from "@/api/book";
import { cn } from "@/lib/utils";
import {
  bookableEnd,
  bookableStart,
  money,
  pillarCopy,
  sessionsByDay,
  type BookFormat,
} from "@/utils/booking";
import { addDaysISO, formatClock, formatDayISO, plural } from "@/utils/schedule";
import { formatInstantSpan } from "@/utils/viewerTime";
import { card, iconButton, meta, primaryButton, segButton, segGroup, textButton } from "@/components/schedule/styles";

const FORMATS: [BookFormat, string][] = [
  ["all", "All"],
  ["group", "Group"],
  ["individual", "1-on-1"],
];

export const TimePicker = ({
  coach,
  pillar,
  picked,
  onToggle,
  alwaysShowDetails,
  timeZone,
  todayISO,
  onRequestTime,
  lockedBy,
}: {
  coach: BookingCoach;
  pillar: string | null;
  picked: BookableSession[];
  onToggle: (session: BookableSession) => void;
  /** Book by pillar shows details for every time. */
  alwaysShowDetails: boolean;
  timeZone: string;
  todayISO: string;
  onRequestTime: () => void;
  /** Name of another coach the family has picks with; times here can't be added until those are done. */
  lockedBy: string | null;
}) => {
  const [weekStart, setWeekStart] = useState(todayISO);
  const [day, setDay] = useState<string | null>(null);
  const [format, setFormat] = useState<BookFormat>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const lastStart = addDaysISO(todayISO, 21);
  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i)), [weekStart]);

  // Stored dates are Eastern, so fetch a day either side of the viewer's week.
  const query = useQuery({
    queryKey: ["bookable-sessions", coach.id, weekStart],
    queryFn: () => bookAPI.sessions(coach.id, addDaysISO(weekStart, -1), addDaysISO(weekStart, 7)),
  });
  const all = useMemo(
    () => (query.data?.sessions ?? []).filter((s) => !pillar || s.sessionType === "individual" || !s.pillar || s.pillar === pillar),
    [query.data, pillar]
  );
  const hasGroups = all.some((s) => s.sessionType === "group");
  const byDay = useMemo(() => sessionsByDay(all, dates, timeZone, hasGroups ? format : "all"), [all, dates, timeZone, format, hasGroups]);

  const firstOpen = dates.find((d) => (byDay.get(d) ?? []).some((s) => !s.myStatus));
  const selectedDay = day && (byDay.get(day) ?? []).length ? day : firstOpen ?? null;
  const items = selectedDay ? byDay.get(selectedDay) ?? [] : [];
  const pickedIds = new Set(picked.map((s) => s.id));
  const showDetails = alwaysShowDetails || !coach.isClient;
  const first = coach.name.split(" ")[0];
  const open = items.find((s) => s.id === openId) ?? null;

  const tap = (s: BookableSession) => {
    if (lockedBy) return;
    if (pickedIds.has(s.id) || !showDetails) {
      onToggle(s);
      setOpenId(null);
      return;
    }
    setOpenId((cur) => (cur === s.id ? null : s.id));
  };

  return (
    <section className={card}>
      {coach.needsRequest ? (
        <p className="flex items-start gap-2 rounded-[8px] bg-[#FCEFDA] px-3 py-2.5 text-[14px] leading-[18px] text-[#906A29]">
          <UserCheck className="mt-[1px] size-4 flex-none" strokeWidth={1.5} aria-hidden="true" />
          {first} approves new families first. Tap a time to see the details, then request it. You're only charged if {first}{" "}
          accepts.
        </p>
      ) : null}
      {lockedBy ? (
        <p className="flex items-start gap-2 rounded-[8px] bg-[#F1F1E6] px-3 py-2.5 text-[14px] leading-[18px] text-[#484D56]">
          <Info className="mt-[1px] size-4 flex-none" strokeWidth={1.5} aria-hidden="true" />
          You have times picked with {lockedBy}. Book those first, or clear them, to pick times with {first}.
        </p>
      ) : null}

      {hasGroups ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-3 text-[12px] text-[#767980]">
            <span className="flex items-center gap-1">
              <i className="size-[8px] rounded-full bg-[#117A96]" aria-hidden="true" />
              Group
            </span>
            <span className="flex items-center gap-1">
              <i className="size-[8px] rounded-full bg-[#0054B4]" aria-hidden="true" />
              1-on-1
            </span>
          </span>
          <div className={cn(segGroup, "w-[240px]")} role="group" aria-label="Session type">
            {FORMATS.map(([v, l]) => (
              <button key={v} type="button" className={segButton(format === v)} aria-pressed={format === v} onClick={() => setFormat(v)}>
                {l}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[18px] font-medium tracking-[-0.04em] text-[#1A202C]">Pick days and times</h2>
        <span className="flex items-center gap-2">
          <button type="button" className={cn(iconButton, "size-[30px]")} aria-label="Previous week" disabled={weekStart <= todayISO} onClick={() => { setWeekStart((w) => (addDaysISO(w, -7) < todayISO ? todayISO : addDaysISO(w, -7))); setDay(null); setOpenId(null); }}>
            <ChevronLeft strokeWidth={1.5} />
          </button>
          <span className={meta}>
            {formatDayISO(weekStart, { month: "short", day: "numeric" })} to {formatDayISO(dates[6], { month: "short", day: "numeric" })}
          </span>
          <button type="button" className={cn(iconButton, "size-[30px]")} aria-label="Next week" disabled={weekStart >= lastStart} onClick={() => { setWeekStart((w) => addDaysISO(w, 7)); setDay(null); setOpenId(null); }}>
            <ChevronRight strokeWidth={1.5} />
          </button>
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Days">
        {dates.map((d) => {
          const list = byDay.get(d) ?? [];
          const openCount = list.filter((s) => !s.myStatus).length;
          const pickedCount = list.filter((s) => pickedIds.has(s.id)).length;
          const on = d === selectedDay;
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              disabled={!list.length}
              aria-label={`${formatDayISO(d, { weekday: "long", month: "long", day: "numeric" })}, ${openCount ? plural(openCount, "open time") : "no open times"}`}
              onClick={() => { setDay(d); setOpenId(null); }}
              className={cn(
                "flex flex-col items-center gap-1 rounded-[8px] border py-2 transition-colors disabled:opacity-40",
                on ? "border-[#6698D2] bg-[#E5EDF7]" : "border-[#EAEADF] bg-[#F4F4EB] hover:bg-[#EAEADF]"
              )}
            >
              <small className="text-[11px] font-medium uppercase text-[#767980]">{formatDayISO(d, { weekday: "short" })}</small>
              <b className={cn("text-[16px] font-semibold", on ? "text-[#0054B4]" : "text-[#1A202C]")}>{formatDayISO(d, { day: "numeric" })}</b>
              {pickedCount ? (
                <em className="rounded-full bg-[#0054B4] px-1.5 text-[10px] font-semibold not-italic text-[#F1F1E6]">{pickedCount}</em>
              ) : (
                <span className="flex h-[6px] gap-[3px]" aria-hidden="true">
                  {list.some((s) => !s.myStatus && s.sessionType === "group") ? <i className="size-[5px] rounded-full bg-[#117A96]" /> : null}
                  {list.some((s) => !s.myStatus && s.sessionType === "individual") ? <i className="size-[5px] rounded-full bg-[#0054B4]" /> : null}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="h-px bg-[#EAEADF]" />

      {query.isLoading ? (
        <p className={meta}>Loading times…</p>
      ) : selectedDay ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-[16px] font-medium">{formatDayISO(selectedDay, { weekday: "long", month: "long", day: "numeric" })}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {items.map((s) => {
              const start = bookableStart(s);
              if (s.myStatus) {
                return (
                  <span key={s.id} className="flex flex-col items-start gap-0.5 rounded-[8px] border border-[#EAEADF] bg-[#F1F1E6] px-3 py-2 opacity-70">
                    <b className="text-[14px] font-medium">{formatClock(start, timeZone)}</b>
                    <small className={meta}>{s.myStatus === "requested" ? "Requested" : "Booked"}</small>
                  </span>
                );
              }
              const on = pickedIds.has(s.id);
              const group = s.sessionType === "group";
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  aria-expanded={showDetails && !on ? openId === s.id : undefined}
                  disabled={Boolean(lockedBy)}
                  onClick={() => tap(s)}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-[8px] border px-3 py-2 text-left transition-colors disabled:opacity-50",
                    on
                      ? "border-[#6698D2] bg-[#E5EDF7]"
                      : openId === s.id
                        ? "border-[#6698D2] bg-[#F9F9F5]"
                        : group
                          ? "border-[#B9DDE7] bg-[#E7F4F8] hover:bg-[#DDEEF3]"
                          : "border-[#EAEADF] bg-[#F4F4EB] hover:bg-[#EAEADF]"
                  )}
                >
                  <b className="text-[14px] font-medium">{formatClock(start, timeZone)}</b>
                  <small className={cn("flex items-center gap-1 text-[12px]", group ? "text-[#117A96]" : "text-[#767980]")}>
                    {on ? (
                      <>
                        <Check className="size-3" strokeWidth={2} aria-hidden="true" />
                        Selected
                      </>
                    ) : group ? (
                      <>
                        <Users className="size-3" strokeWidth={1.5} aria-hidden="true" />
                        Group · {s.capacity - s.bookedCount} of {s.capacity} left
                      </>
                    ) : (
                      <>
                        <User className="size-3" strokeWidth={1.5} aria-hidden="true" />
                        1-on-1
                      </>
                    )}
                  </small>
                </button>
              );
            })}
          </div>
          {open ? (
            <SessionDetails session={open} coach={coach} pillar={pillar} timeZone={timeZone} onClose={() => setOpenId(null)} onAdd={() => { onToggle(open); setOpenId(null); }} />
          ) : showDetails ? (
            <p className={cn(meta, "flex items-center gap-1.5")}>
              <Info className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
              Tap a time to see what the session covers.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-[14px] text-[#767980]">
          No {format === "group" ? "group sessions" : format === "individual" ? "1-on-1 times" : "open times"} these 7 days. Try the next week
          {format !== "all" ? ", switch to All" : ""}, or request a time below.
        </p>
      )}

      <div className="flex items-center gap-2 rounded-[8px] bg-[#F1F1E6] px-3 py-2.5">
        <Clock className="size-4 flex-none text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
        <span className="grow text-[14px] text-[#484D56]">Don't see a time that works?</span>
        <button type="button" className={textButton} onClick={onRequestTime}>
          Request a time
        </button>
      </div>
    </section>
  );
};

const SessionDetails = ({
  session,
  coach,
  pillar,
  timeZone,
  onClose,
  onAdd,
}: {
  session: BookableSession;
  coach: BookingCoach;
  pillar: string | null;
  timeZone: string;
  onClose: () => void;
  onAdd: () => void;
}) => {
  const group = session.sessionType === "group";
  const first = coach.name.split(" ")[0];
  const topic = session.pillar || pillar;
  const copy = pillarCopy(topic);
  const start = bookableStart(session);
  const end = bookableEnd(session);
  const online = session.location === "online";
  const about = session.details.about?.length ? session.details.about : group ? ["Warm-up and skill work", "Game-based practice", "Cool-down and feedback"] : null;
  const row = (Icon: typeof Clock, a: string, b: string) => (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-[2px] size-4 flex-none text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
      <span className="flex flex-col gap-0.5">
        <b className="text-[14px] font-medium">{a}</b>
        <span className={meta}>{b}</span>
      </span>
    </div>
  );
  return (
    <div role="region" aria-label="Session details" className={cn("flex flex-col gap-3 rounded-[10px] border p-4", group ? "border-[#B9DDE7] bg-[#F3FAFC]" : "border-[#6698D2] bg-[#F9F9F5]")}>
      <div className="flex items-start justify-between gap-3">
        <span className="flex flex-col gap-1.5">
          <b className="text-[16px] font-semibold">{group ? session.sessionName : `1-on-1 ${(topic ?? "session").toLowerCase()}`}</b>
          <span className="flex flex-wrap gap-1.5">
            {group ? <BrandPill tone="teal">Group</BrandPill> : <BrandPill tone="neutral">1-on-1</BrandPill>}
            {coach.needsRequest ? <BrandPill tone="amber">Request to book</BrandPill> : null}
          </span>
        </span>
        <button type="button" className={cn(iconButton, "size-[28px]")} aria-label="Close details" onClick={onClose}>
          <X strokeWidth={1.5} />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {row(Clock, formatInstantSpan(start, end, timeZone), `${session.durationMinutes} minutes`)}
        {row(online ? Video : MapPin, online ? "Video call" : session.place || coach.locations[0] || "In person", online ? "The link comes with your confirmation" : "Exact spot comes with your confirmation")}
        {group
          ? row(Users, `${session.bookedCount} of ${session.capacity} booked`, `${plural(session.capacity - session.bookedCount, "spot")} left · ${session.details.ages ? `ages ${session.details.ages}` : "all ages"} · ${session.details.level ?? "All levels"}`)
          : row(User, `Just you and ${first}`, session.details.ages ? `Ages ${session.details.ages}` : "Any level")}
      </div>
      {about ? (
        <ul className="list-disc pl-5 text-[14px] leading-[20px] text-[#484D56]">
          {about.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] leading-[20px] text-[#484D56]">{copy.session}</p>
      )}
      <span className={meta}>Bring: {(session.details.bring ?? copy.bring).toLowerCase()}</span>
      <div className="flex items-center justify-between gap-3 border-t border-[#EAEADF] pt-3">
        <span className="flex flex-col">
          <b className="text-[20px] font-semibold">{money(session.price)}</b>
          <span className={meta}>
            {group ? "Per athlete. " : ""}
            {coach.needsRequest ? `Charged only if ${first} accepts` : "Charged when you check out"}
          </span>
        </span>
        <button type="button" className={primaryButton} onClick={onAdd}>
          {coach.needsRequest ? "Request" : "Add"}
        </button>
      </div>
    </div>
  );
};
