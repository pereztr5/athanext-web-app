/**
 * Pick days and times with one coach (ATH-73 / WC4 #23). Desktop keeps the compact week grid.
 * Phone uses the calmer tile row, full-width time rows, and 1-on-1-only request copy.
 */
import { Fragment, type ReactNode, type TouchEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Clock, Info, MapPin, User, UserCheck, Users, Video, X } from "lucide-react";
import { BrandPill } from "@/components/brand";
import { bookAPI, type BookableSession, type BookingCoach } from "@/api/book";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  bookableEnd,
  bookableStart,
  money,
  pillarCopy,
  sessionsByDay,
  type BookFormat,
} from "@/utils/booking";
import { feeFor, type PlanFees } from "@/utils/bookPlan";
import { addDaysISO, formatClock, formatDayISO, plural } from "@/utils/schedule";
import { formatInstantSpan } from "@/utils/viewerTime";
import { card, dayTile, dayTileNumber, dayTileWeekday, iconButton, meta, primaryButton, segButton, segGroup, textButton, timeTile, timeTileNote } from "@/components/schedule/styles";

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
  fees,
  useCredits,
  athleteFirst,
  footer,
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
  fees?: PlanFees;
  useCredits?: boolean;
  /** Parent accounts: "Just Ava and Riley". Self-managed: "Just you and Riley". */
  athleteFirst?: string | null;
  footer?: ReactNode;
}) => {
  const isMobile = useIsMobile();
  const [weekStart, setWeekStart] = useState(todayISO);
  const [day, setDay] = useState<string | null>(null);
  const [format, setFormat] = useState<BookFormat>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const lastStart = addDaysISO(todayISO, 21);
  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i)), [weekStart]);
  const tileTouch = useRef<{ x: number; y: number } | null>(null);
  const timesTouch = useRef<{ x: number; y: number } | null>(null);

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
  const phoneFormat: BookFormat = isMobile ? "all" : hasGroups ? format : "all";
  const byDay = useMemo(() => sessionsByDay(all, dates, timeZone, phoneFormat), [all, dates, timeZone, phoneFormat]);

  const firstOpen = dates.find((d) => (byDay.get(d) ?? []).some((s) => !s.myStatus));
  const selectedDay = day && (byDay.get(day) ?? []).length ? day : firstOpen ?? null;
  const items = selectedDay ? byDay.get(selectedDay) ?? [] : [];
  const pickedIds = new Set(picked.map((s) => s.id));
  const showDetails = alwaysShowDetails || !coach.isClient;
  const first = coach.name.split(" ")[0];
  const openDays = dates.filter((d) => (byDay.get(d) ?? []).some((s) => !s.myStatus));
  const weekLabel =
    weekStart <= todayISO
      ? `This week · ${formatDayISO(weekStart, { month: "short", day: "numeric" })} to ${formatDayISO(dates[6], { month: "short", day: "numeric" })}`
      : `Next week · ${formatDayISO(weekStart, { month: "short", day: "numeric" })} to ${formatDayISO(dates[6], { month: "short", day: "numeric" })}`;

  const shiftWeek = (dir: 1 | -1) => {
    setWeekStart((w) => {
      const next = addDaysISO(w, 7 * dir);
      if (next < todayISO) return todayISO;
      if (next > lastStart) return w;
      return next;
    });
    setDay(null);
    setOpenId(null);
  };

  const stepOpenDay = (dir: 1 | -1) => {
    if (!selectedDay) {
      if (dir > 0) shiftWeek(1);
      else if (weekStart > todayISO) shiftWeek(-1);
      return;
    }
    const idx = openDays.indexOf(selectedDay);
    if (dir > 0) {
      if (idx >= 0 && idx < openDays.length - 1) {
        setDay(openDays[idx + 1]!);
        setOpenId(null);
        return;
      }
      if (weekStart < lastStart) {
        const next = addDaysISO(weekStart, 7);
        setWeekStart(next > lastStart ? weekStart : next);
        setDay(null);
        setOpenId(null);
      }
      return;
    }
    if (idx > 0) {
      setDay(openDays[idx - 1]!);
      setOpenId(null);
      return;
    }
    if (weekStart > todayISO) {
      const prev = addDaysISO(weekStart, -7);
      setWeekStart(prev < todayISO ? todayISO : prev);
      setDay(null);
      setOpenId(null);
    }
  };

  const onSwipe = (
    ref: typeof tileTouch,
    e: TouchEvent,
    axis: "x",
    onLeft: () => void,
    onRight: () => void
  ) => {
    const start = ref.current;
    if (!start) return;
    const dx = e.changedTouches[0]!.clientX - start.x;
    const dy = e.changedTouches[0]!.clientY - start.y;
    ref.current = null;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    if (axis === "x") (dx < 0 ? onLeft : onRight)();
  };

  const tap = (s: BookableSession) => {
    if (lockedBy) return;
    if (pickedIds.has(s.id) || !showDetails) {
      onToggle(s);
      setOpenId(null);
      return;
    }
    setOpenId((cur) => (cur === s.id ? null : s.id));
  };

  const notices = (
    <>
      {coach.needsRequest ? (
        <p className="flex items-start gap-2.5 rounded-[8px] bg-[#F4F4EB] px-3.5 py-3 text-[12px] leading-[14px] text-[#767980]">
          <UserCheck className="size-4 flex-none" strokeWidth={1.5} aria-hidden="true" />
          {first} approves new families first. Tap a time to see the details, then request it. You're only charged if {first}{" "}
          accepts.
        </p>
      ) : null}
      {lockedBy ? (
        <p className="flex items-start gap-2.5 rounded-[8px] bg-[#F4F4EB] px-3.5 py-3 text-[12px] leading-[14px] text-[#767980]">
          <Info className="size-4 flex-none" strokeWidth={1.5} aria-hidden="true" />
          You have times picked with {lockedBy}. Book those first, or clear them, to pick times with {first}.
        </p>
      ) : null}
    </>
  );

  const requestBlock = isMobile ? (
    <div className="flex flex-col gap-1.5 pt-1">
      <button type="button" className={cn(textButton, "self-start")} onClick={onRequestTime}>
        Request a different time
      </button>
      <p className={meta}>For 1-on-1 sessions only. Group times are fixed on the schedule.</p>
    </div>
  ) : (
    <div className="flex items-center gap-2.5 rounded-[10px] border border-dashed border-[#C1C1B8] px-3 py-2.5">
      <Clock className="size-4 flex-none text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
      <span className="grow text-[14px] text-[#484D56]">Don't see a time that works?</span>
      <button type="button" className={textButton} onClick={onRequestTime}>
        Request a time
      </button>
    </div>
  );

  if (isMobile) {
    const openCount = items.filter((s) => !s.myStatus).length;
    return (
      <section className={cn(card, "gap-4")}>
        {notices}
        <p className={cn(meta, "text-center")}>{weekLabel}</p>
        <div
          className="flex items-center gap-1"
          onTouchStart={(e) => {
            tileTouch.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
          }}
          onTouchEnd={(e) => onSwipe(tileTouch, e, "x", () => shiftWeek(1), () => shiftWeek(-1))}
        >
          <button
            type="button"
            className={cn(iconButton, "size-11 shrink-0 bg-[#F7F7F0]")}
            aria-label="Previous open day"
            disabled={weekStart <= todayISO && openDays[0] === selectedDay}
            onClick={() => stepOpenDay(-1)}
          >
            <ChevronLeft strokeWidth={1.5} />
          </button>
          <div className="grid min-w-0 flex-1 grid-cols-7 gap-1" role="group" aria-label="Days">
            {dates.map((d) => {
              const list = byDay.get(d) ?? [];
              const hasOpen = list.some((s) => !s.myStatus);
              const on = d === selectedDay;
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  disabled={!hasOpen}
                  onClick={() => {
                    setDay(d);
                    setOpenId(null);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-[10px] border py-1.5",
                    on ? "border-[#0054B4] bg-[#E5EDF7]" : "border-[#EAEADF] bg-[#F7F7F0]",
                    !hasOpen && "opacity-40"
                  )}
                >
                  <small className={cn("text-[9px] font-semibold uppercase", on ? "text-[#0054B4]" : "text-[#767980]")}>
                    {formatDayISO(d, { month: "short" })}
                  </small>
                  <b className="text-[15px] font-bold leading-[16px]">{formatDayISO(d, { day: "numeric" })}</b>
                  <em className={cn("text-[9px] font-medium not-italic", on ? "text-[#0054B4]" : "text-[#767980]")}>
                    {formatDayISO(d, { weekday: "short" }).toUpperCase()}
                  </em>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className={cn(iconButton, "size-11 shrink-0 bg-[#F7F7F0]")}
            aria-label="Next open day"
            disabled={weekStart >= lastStart && openDays[openDays.length - 1] === selectedDay}
            onClick={() => stepOpenDay(1)}
          >
            <ChevronRight strokeWidth={1.5} />
          </button>
        </div>

        {format !== "all" && hasGroups ? (
          <p className={meta}>
            Showing {format === "group" ? "group" : "1-on-1"} only ·{" "}
            <button type="button" className={textButton} onClick={() => setFormat("all")}>
              Show all
            </button>
          </p>
        ) : null}

        {query.isLoading ? (
          <p className={meta}>Loading times…</p>
        ) : selectedDay ? (
          <div
            className="flex flex-col gap-3"
            onTouchStart={(e) => {
              timesTouch.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
            }}
            onTouchEnd={(e) => onSwipe(timesTouch, e, "x", () => stepOpenDay(1), () => stepOpenDay(-1))}
          >
            <h3 className="text-[15px] font-medium text-[#1A202C]">
              {formatDayISO(selectedDay, { weekday: "long" })} · {plural(openCount, "open time")}
            </h3>
            <div className="flex flex-col gap-2">
              {items.map((s) => {
                const start = bookableStart(s);
                const group = s.sessionType === "group";
                const on = pickedIds.has(s.id);
                const place = s.location === "online" ? "Video call" : s.place || coach.locations[0] || "In person";
                if (s.myStatus) {
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 rounded-[12px] border border-dashed border-[#EAEADF] px-3.5 py-3 text-[#A3A6AB]"
                    >
                      <b className="text-[18px] font-semibold tabular-nums">{formatClock(start, timeZone)}</b>
                      <span className="grow text-[13px]">{s.myStatus === "requested" ? "Requested" : "Booked"}</span>
                    </div>
                  );
                }
                const fee = feeFor(s.price, coach.id, fees);
                const credit = !group && Boolean(useCredits && coach.credits > 0);
                return (
                  <Fragment key={s.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      disabled={Boolean(lockedBy)}
                      onClick={() => tap(s)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[12px] border px-3.5 py-3 text-left",
                        on ? "border-[#0054B4] bg-[#E5EDF7]" : group ? "border-[#A9D4E0] bg-[#E7F4F8]" : "border-[#EAEADF] bg-[#F7F7F0]"
                      )}
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <b className="text-[18px] font-semibold tabular-nums text-[#1A202C]">{formatClock(start, timeZone)}</b>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <BrandPill tone={group ? "teal" : "blue"}>{group ? "Group" : "1-on-1"}</BrandPill>
                          <span className={meta}>
                            {group ? s.sessionName : `${s.durationMinutes} min`} · {place}
                            {group ? ` · ${s.capacity - s.bookedCount} left` : ""}
                          </span>
                        </span>
                        <span className="text-[13px] font-medium text-[#1A202C]">
                          {credit ? "1 credit" : money(s.price + (credit ? 0 : fee))}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full border",
                          on ? "border-[#0054B4] bg-[#0054B4] text-white" : "border-[#C1C1B8] text-transparent"
                        )}
                        aria-hidden="true"
                      >
                        <Check className="size-3.5" strokeWidth={2.5} />
                      </span>
                    </button>
                    {showDetails && !on && openId === s.id ? (
                      <SessionDetails
                        session={s}
                        coach={coach}
                        pillar={pillar}
                        timeZone={timeZone}
                        fees={fees}
                        useCredits={useCredits}
                        athleteFirst={athleteFirst}
                        col={0}
                        onClose={() => setOpenId(null)}
                        onAdd={() => {
                          onToggle(s);
                          setOpenId(null);
                        }}
                      />
                    ) : null}
                  </Fragment>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-[14px] text-[#767980]">No open times these 7 days. Try the next week, or request a different time below.</p>
        )}
        {requestBlock}
        {footer}
      </section>
    );
  }

  return (
    <section className={card}>
      {notices}

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
          <div className={cn(segGroup, "w-fit")} role="group" aria-label="Session type">
            {FORMATS.map(([v, l]) => (
              <button key={v} type="button" className={cn(segButton(format === v), "flex-none")} aria-pressed={format === v} onClick={() => setFormat(v)}>
                {l}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[20px] font-medium leading-[24px] tracking-[-0.04em] text-[#1A202C]">Pick days and times</h2>
        <span className="flex items-center gap-2">
          <button
            type="button"
            className={cn(iconButton, "size-[30px] bg-[#F7F7F0]")}
            aria-label="Previous week"
            disabled={weekStart <= todayISO}
            onClick={() => shiftWeek(-1)}
          >
            <ChevronLeft strokeWidth={1.5} />
          </button>
          <span className={meta}>
            {formatDayISO(weekStart, { month: "short", day: "numeric" })} to {formatDayISO(dates[6], { month: "short", day: "numeric" })}
          </span>
          <button
            type="button"
            className={cn(iconButton, "size-[30px] bg-[#F7F7F0]")}
            aria-label="Next week"
            disabled={weekStart >= lastStart}
            onClick={() => shiftWeek(1)}
          >
            <ChevronRight strokeWidth={1.5} />
          </button>
        </span>
      </div>

      <div className="grid grid-cols-7 gap-2" role="group" aria-label="Days">
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
              onClick={() => {
                setDay(d);
                setOpenId(null);
              }}
              className={dayTile(on)}
            >
              <small className={dayTileWeekday(on)}>{formatDayISO(d, { weekday: "short" })}</small>
              <b className={dayTileNumber}>{formatDayISO(d, { day: "numeric" })}</b>
              {pickedCount ? (
                <em className={cn("min-w-4 rounded-[8px] px-1 text-center text-[10px] font-bold not-italic leading-[14px]", on ? "bg-[#F1F1E6] text-[#0054B4]" : "bg-[#0054B4] text-[#F1F1E6]")}>
                  {pickedCount}
                </em>
              ) : (
                <span className="flex h-[5px] gap-[3px]" aria-hidden="true">
                  {list.some((s) => !s.myStatus && s.sessionType === "group") ? <i className={cn("size-[5px] rounded-full", on ? "bg-[#9FD9EA]" : "bg-[#117A96]")} /> : null}
                  {list.some((s) => !s.myStatus && s.sessionType === "individual") ? <i className={cn("size-[5px] rounded-full", on ? "bg-[#F1F1E6]" : "bg-[#0054B4]")} /> : null}
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
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {items.map((s, i) => {
              const start = bookableStart(s);
              if (s.myStatus) {
                return (
                  <span
                    key={s.id}
                    className="flex h-[58px] flex-col items-center justify-center gap-0.5 rounded-[12px] border border-dashed border-[#EAEADF] text-[16px] font-semibold tabular-nums text-[#A3A6AB]"
                  >
                    {formatClock(start, timeZone)}
                    <small className="text-[11px] font-medium">{s.myStatus === "requested" ? "Requested" : "Booked"}</small>
                  </span>
                );
              }
              const on = pickedIds.has(s.id);
              const group = s.sessionType === "group";
              const open = showDetails && !on && openId === s.id;
              return (
                <Fragment key={s.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-expanded={showDetails && !on ? open : undefined}
                    disabled={Boolean(lockedBy)}
                    onClick={() => tap(s)}
                    className={cn(timeTile(on, group), "h-[58px]", open && (group ? "border-2 border-[#117A96]" : "border-2 border-[#0054B4]"))}
                  >
                    {formatClock(start, timeZone)}
                    <small className={timeTileNote(on, group)}>
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
                  {open ? (
                    <SessionDetails
                      session={s}
                      coach={coach}
                      pillar={pillar}
                      timeZone={timeZone}
                      fees={fees}
                      useCredits={useCredits}
                      athleteFirst={athleteFirst}
                      col={i}
                      onClose={() => setOpenId(null)}
                      onAdd={() => {
                        onToggle(s);
                        setOpenId(null);
                      }}
                    />
                  ) : null}
                </Fragment>
              );
            })}
          </div>
          {showDetails && !openId ? (
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

      {requestBlock}
      {footer}
    </section>
  );
};

const SessionDetails = ({
  session,
  coach,
  pillar,
  timeZone,
  fees,
  useCredits,
  athleteFirst,
  col,
  onClose,
  onAdd,
}: {
  session: BookableSession;
  coach: BookingCoach;
  pillar: string | null;
  timeZone: string;
  fees?: PlanFees;
  useCredits?: boolean;
  athleteFirst?: string | null;
  col: number;
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
  const credit = !group && Boolean(useCredits && coach.credits > 0);
  const fee = credit ? 0 : feeFor(session.price, coach.id, fees);
  const who = athleteFirst || "you";
  const ages = session.details.ages ? `Ages ${session.details.ages}, any level` : "Any level";
  const row = (Icon: typeof Clock, a: string, b: string) => (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-[2px] size-4 flex-none text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
      <span className="flex flex-col gap-1">
        <b className="text-[14px] font-medium">{a}</b>
        <span className={meta}>{b}</span>
      </span>
    </div>
  );
  return (
    <div
      role="region"
      aria-label="Session details"
      className={cn(
        "relative col-span-full mt-0.5 flex flex-col gap-3 rounded-[14px] border-2 p-4 [--i2:var(--i2)]",
        group ? "border-[#117A96] bg-[#F4FAFC]" : "border-[#0054B4] bg-[#F7F7F0]"
      )}
      style={{ ["--i2" as string]: col % 2, ["--i4" as string]: col % 4 }}
    >
      <i
        aria-hidden="true"
        className={cn(
          "absolute -top-[9px] size-3.5 rotate-45 border-l-2 border-t-2 bg-inherit",
          group ? "border-[#117A96]" : "border-[#0054B4]",
          "left-[calc((var(--i2)+0.5)*50%-7px)] md:left-[calc((var(--i4)+0.5)*25%-7px)]"
        )}
      />
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
      <div className="flex flex-col gap-2.5 rounded-[8px] border border-[#EAEADF] bg-[#F7F7F0] p-3">
        {row(Clock, formatInstantSpan(start, end, timeZone), `${session.durationMinutes} minutes`)}
        {row(
          online ? Video : MapPin,
          online ? "Video call" : session.place || coach.locations[0] || "In person",
          online ? "The link comes with your confirmation" : "Exact spot and parking come with your confirmation"
        )}
        {group
          ? row(
              Users,
              `${session.bookedCount} of ${session.capacity} booked`,
              `${plural(session.capacity - session.bookedCount, "spot")} left · ${session.details.ages ? `ages ${session.details.ages}` : "all ages"} · ${session.details.level ?? "All levels"}`
            )
          : row(User, `Just ${who} and ${first}`, ages)}
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
      <div className="flex items-center justify-between gap-3">
        <span className="flex flex-col gap-1">
          <b className="text-[28px] font-bold leading-[30px] tracking-[-0.05em]">{credit ? "1 credit" : money(session.price + fee)}</b>
          <span className={meta}>
            {group ? "Per athlete. " : ""}
            {fee ? `Includes ${money(fee)} platform fee. ` : ""}
            {coach.needsRequest ? `Charged only if ${first} accepts` : "Charged when you check out"}
          </span>
        </span>
        <button type="button" className={cn(primaryButton, "h-[44px]")} onClick={onAdd}>
          {coach.needsRequest ? "Request" : "Add"}
        </button>
      </div>
    </div>
  );
};
