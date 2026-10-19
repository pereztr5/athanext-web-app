/** Step 2 of Book {athlete}: a week of days, then times (open 1-on-1s, groups with space, taken times). */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Globe, User, Users, X } from "@/components/icons";
import {
  dayTile, dayTileNumber, dayTileWeekday, meta, primaryButton, timeTile, timeTileNote,
} from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { getZonedISODate } from "@/utils/dateHelpers";
import { addDaysISO, formatDayISO, timeZonePillLabel } from "@/utils/schedule";
import { fetchBookWeek } from "./bookWeek";
import { byStart, clock, viewerDay, type BookTime } from "./bookHelpers";

const boxButton =
  "inline-flex size-[30px] flex-none items-center justify-center rounded-control border border-light-525 bg-light-300 text-dark disabled:bg-light-400 disabled:border-light-525 disabled:text-dark-200 [&>svg]:size-4";

export const PickTimes = ({
  athleteId,
  timeZone,
  picked,
  summary,
  onToggle,
  onContinue,
}: {
  athleteId: string;
  timeZone: string;
  picked: BookTime[];
  summary: string;
  onToggle: (time: BookTime) => void;
  onContinue: () => void;
}) => {
  const today = getZonedISODate(new Date(), timeZone);
  const [start, setStart] = useState(today);
  const [day, setDay] = useState<string | null>(null);
  const week = useQuery({
    queryKey: ["roster-book-week", athleteId, start],
    // One day early so viewers ahead of Eastern time still see the first evening.
    queryFn: () => fetchBookWeek(athleteId, addDaysISO(start, -1)),
  });

  const days = useMemo(() => {
    const items = week.data ?? [];
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDaysISO(start, i);
      const times = items.filter((t) => viewerDay(t, timeZone) === date).sort(byStart);
      return {
        date,
        times,
        open: times.some((t) => t.kind !== "taken"),
        group: times.some((t) => t.kind === "group"),
        single: times.some((t) => t.kind === "open"),
        picked: picked.filter((t) => viewerDay(t, timeZone) === date).length,
      };
    });
  }, [week.data, start, timeZone, picked]);

  const current = days.find((d) => d.date === day && d.open) ?? days.find((d) => d.open) ?? null;
  const pickedIds = new Set(picked.map((t) => t.id));

  const move = (by: number) => {
    const next = addDaysISO(start, by);
    setStart(next < today ? today : next);
    setDay(null);
  };

  return (
    <>
      <div className="flex flex-col gap-4 px-5 pb-4 sm:px-[25px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-subtitle">Pick days and times</span>
          <div className="flex items-center gap-2.5">
            <button type="button" className={boxButton} aria-label="Previous week" disabled={start <= today} onClick={() => move(-7)}>
              <ChevronLeft strokeWidth={1.5} aria-hidden="true" />
            </button>
            <span className={cn(meta, "hidden sm:inline")}>
              {formatDayISO(start, { month: "short", day: "numeric" })} to {formatDayISO(addDaysISO(start, 6), { month: "short", day: "numeric" })}
            </span>
            <button type="button" className={boxButton} aria-label="Next week" onClick={() => move(7)}>
              <ChevronRight strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {days.map((d) => {
            const on = current?.date === d.date;
            return (
              <button
                key={d.date}
                type="button"
                className={dayTile(on)}
                aria-pressed={on}
                disabled={!d.open}
                aria-label={formatDayISO(d.date, { weekday: "long", month: "long", day: "numeric" })}
                onClick={() => setDay(d.date)}
              >
                <small className={dayTileWeekday(on)}>{formatDayISO(d.date, { weekday: "short" })}</small>
                <b className={dayTileNumber}>{formatDayISO(d.date, { day: "numeric" })}</b>
                {d.picked ? (
                  <em className={cn("min-w-4 rounded-pill px-1 text-center text-label-xsm not-italic", on ? "bg-light text-primary" : "bg-primary text-light")}>
                    {d.picked}
                  </em>
                ) : (
                  <span className="flex h-[5px] gap-[3px]">
                    {d.group ? <i className={cn("size-[5px] rounded-full", on ? "bg-secondary-200" : "bg-secondary-600")} /> : null}
                    {d.single ? <i className={cn("size-[5px] rounded-full", on ? "bg-light" : "bg-primary")} /> : null}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {week.isLoading ? (
          <p className={meta}>Finding open times…</p>
        ) : current ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-subtitle">
                {formatDayISO(current.date, { weekday: "long", month: "long", day: "numeric" })}
              </span>
              <span className={cn(meta, "inline-flex items-center gap-1")}>
                <Globe className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                {timeZonePillLabel(timeZone)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {current.times.map((t) => {
                if (t.kind === "taken") {
                  return (
                    <button key={t.id} type="button" disabled className={cn(timeTile(false), "h-[58px]")}>
                      <span>{clock(t, timeZone)}</span>
                      <small className={timeTileNote(false)}>
                        {t.title ? `${t.title} · ${t.booked} of ${t.cap}` : `Booked · ${t.takenBy ?? "taken"}`}
                      </small>
                    </button>
                  );
                }
                const on = pickedIds.has(t.id);
                const group = t.kind === "group";
                return (
                  <button key={t.id} type="button" aria-pressed={on} className={cn(timeTile(on, group), "h-[58px]")} onClick={() => onToggle(t)}>
                    <span>{clock(t, timeZone)}</span>
                    <small className={cn(timeTileNote(on, group), "max-w-full truncate px-1")}>
                      {on ? (
                        <><Check aria-hidden="true" />Selected</>
                      ) : group ? (
                        <><Users aria-hidden="true" />{t.title ?? "Group"} · {t.booked} of {t.cap}</>
                      ) : (
                        <><User aria-hidden="true" />Open</>
                      )}
                    </small>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-body-m text-dark-300">No open times or groups these 7 days. Try the next week.</p>
        )}

        <span className="inline-flex gap-3.5 text-caption text-dark-300">
          <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-secondary-600" />Group</span>
          <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-primary" />1-on-1</span>
        </span>
      </div>

      <div className="sticky bottom-0 flex flex-col gap-2.5 border-t border-light-525 bg-light-300 px-5 py-4 sm:px-[25px]">
        {picked.length ? (
          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {[...picked].sort(byStart).map((t) => (
              <button
                key={t.id}
                type="button"
                aria-label={`Remove ${formatDayISO(viewerDay(t, timeZone), { weekday: "short", day: "numeric" })} at ${clock(t, timeZone)}`}
                className="inline-flex h-[30px] flex-none items-center gap-1.5 rounded-control border border-primary-300 bg-primary-50 px-2.5 text-label-sm text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                onClick={() => onToggle(t)}
              >
                {formatDayISO(viewerDay(t, timeZone), { weekday: "short", day: "numeric" })} · {clock(t, timeZone).replace(":00", "")}
                <X className="size-3 opacity-70" aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <span className={meta}>{picked.length ? summary : "Tap one or more times"}</span>
          <button type="button" className={primaryButton} disabled={!picked.length} onClick={onContinue}>Continue</button>
        </div>
      </div>
    </>
  );
};
