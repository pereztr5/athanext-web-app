/**
 * Weekly hours on Schedule settings (Working Copy 4). Saving replaces repeating
 * 1-hour open slots for each hour in the ranges.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Plus, X } from "@/components/icons";
import { scheduleAPI, type ScheduleSeries } from "@/api/schedule";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ALL_START_MINUTES,
  WEEKDAY_NAMES,
  addDaysISO,
  formatMinutes,
  minutesToHHMM,
  weekStartISO,
} from "@/utils/schedule";
import { card, input, primaryButton, secondaryButton, smallButton } from "../styles";
import { CardHeading, caption } from "./shared";
import { useFail } from "./useFail";

type Range = [number, number]; // start minutes, end minutes
type Days = Record<number, Range[]>; // ISO weekday 1..7

const parseHHMM = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Collapse consecutive 60-minute open series into day ranges. */
export const seriesToDays = (series: ScheduleSeries[]): Days => {
  const byDay: Record<number, number[]> = {};
  series
    .filter((s) => s.sessionType === "individual" && s.durationMinutes === 60 && !s.endsOn)
    .forEach((s) => {
      const start = parseHHMM(s.startTime.slice(0, 5));
      (byDay[s.dayOfWeek] ??= []).push(start);
    });
  const days: Days = {};
  for (let d = 1; d <= 7; d++) {
    const starts = [...new Set(byDay[d] ?? [])].sort((a, b) => a - b);
    if (!starts.length) {
      days[d] = [];
      continue;
    }
    const ranges: Range[] = [];
    let from = starts[0];
    let to = starts[0] + 60;
    for (let i = 1; i < starts.length; i++) {
      if (starts[i] === to) {
        to = starts[i] + 60;
      } else {
        ranges.push([from, to]);
        from = starts[i];
        to = starts[i] + 60;
      }
    }
    ranges.push([from, to]);
    days[d] = ranges;
  }
  return days;
};

const DAYS3 = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** "9 am to 5 pm" (WC4 span): drop :00 and shared am/pm on the start. */
const spanLabel = (from: number, to: number): string => {
  const x = formatMinutes(from);
  const y = formatMinutes(to);
  const start = x.slice(-2) === y.slice(-2) ? x.slice(0, -3) : x;
  return `${start} to ${y}`.replace(/:00/g, "");
};

/** Short hours line for My schedule (WC4 `AN.hoursLine`). */
export const hoursLineFromSeries = (series: ScheduleSeries[]): string => {
  const days = seriesToDays(series);
  const on = DAYS3.map((name, i) => ({ name, ranges: days[i + 1] || [] })).filter((x) => x.ranges.length);
  if (!on.length) return "No weekly hours set";
  const first = DAYS3.indexOf(on[0]!.name);
  const last = DAYS3.indexOf(on[on.length - 1]!.name);
  const dayLabel =
    on.length > 1 && on.length === last - first + 1
      ? `${on[0]!.name} to ${on[on.length - 1]!.name}`
      : on.map((x) => x.name).join(", ");
  const same =
    on.every(
      (x) =>
        x.ranges.length === 1 &&
        x.ranges[0]![0] === on[0]!.ranges[0]![0] &&
        x.ranges[0]![1] === on[0]!.ranges[0]![1]
    );
  if (same) return `${dayLabel}, ${spanLabel(on[0]!.ranges[0]![0], on[0]!.ranges[0]![1])}`;
  const hrs = Object.values(days)
    .flat()
    .reduce((n, [a, b]) => n + (b - a) / 60, 0);
  const rounded = Math.round(hrs * 10) / 10;
  return `${dayLabel} · ${rounded} ${rounded === 1 ? "hour" : "hours"} a week`;
};

const emptyDays = (): Days => Object.fromEntries(WEEKDAY_NAMES.map((_, i) => [i + 1, []])) as Days;

const nextDateForWeekday = (weekday: number, fromISO: string): string => {
  const candidate = addDaysISO(weekStartISO(fromISO), weekday - 1);
  return candidate < fromISO ? addDaysISO(candidate, 7) : candidate;
};

export const WeeklyHoursCard = ({
  series,
  today,
  hourlyRate,
  locations,
  loading,
}: {
  series: ScheduleSeries[];
  today: string;
  hourlyRate: number | null;
  locations: string[];
  loading: boolean;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fail = useFail();
  const [days, setDays] = useState<Days>(emptyDays);
  const [editing, setEditing] = useState<number | null>(null);

  useEffect(() => {
    setDays(seriesToDays(series));
  }, [series]);

  const summary = useMemo(() => {
    const on = WEEKDAY_NAMES.map((n, i) => ((days[i + 1] || []).length ? n.slice(0, 3) : null));
    const hrs = Object.values(days)
      .flat()
      .reduce((n, [a, b]) => n + (b - a) / 60, 0);
    const named = on.filter(Boolean) as string[];
    const run =
      named.length && on.indexOf(named[0]) + named.length - 1 === on.lastIndexOf(named[named.length - 1])
        ? `${named[0]}–${named[named.length - 1]}`
        : named.join(", ");
    return `${run || "No days open"} · ${hrs} hours a week`;
  }, [days]);

  const save = useMutation({
    mutationFn: async () => {
      for (const rs of Object.values(days)) {
        for (const [a, b] of rs) {
          if (b <= a) throw new Error("Each end time needs to be after its start time.");
        }
      }
      const openSeries = series.filter((s) => s.sessionType === "individual" && !s.endsOn);
      for (const s of openSeries) {
        await scheduleAPI.stopSeries(s.id);
      }
      const place = locations.find((l) => l !== "Video call") ?? null;
      const rate = hourlyRate || 90;
      for (let d = 1; d <= 7; d++) {
        for (const [from, to] of days[d] || []) {
          for (let m = from; m < to; m += 60) {
            const date = nextDateForWeekday(d, today);
            await scheduleAPI.createSessions({
              sessionType: "individual",
              visibility: "open",
              times: [{ date, start: minutesToHHMM(m) }],
              repeat: "weekly",
              weeks: 1,
              durationMinutes: 60,
              price: rate,
              capacity: 1,
              location: place ? "in-person" : "online",
              place,
            });
          }
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Weekly hours saved", description: "Open slots on your calendar match these hours." });
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
    },
    onError: fail,
  });

  const setRanges = (day: number, ranges: Range[]) => setDays((prev) => ({ ...prev, [day]: ranges }));

  return (
    <section id="weekly-hours" className={card}>
      <CardHeading icon={Clock} title="Weekly hours" />
      <p className={cn(caption, "-mt-2.5")}>
        Open 1-on-1 slots that repeat every week. Saving replaces your current repeating open times.
      </p>
      {loading ? (
        <div className="h-[34px] animate-pulse rounded-control bg-light" />
      ) : (
        <>
          <p className="text-body-m text-dark-400">{summary}</p>
          <div className="flex flex-col gap-2">
            {WEEKDAY_NAMES.map((name, i) => {
              const d = i + 1;
              const rs = days[d] || [];
              const open = editing === d;
              return (
                <div key={name} className="rounded-card border border-light-525 bg-light-400 px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                      onClick={() => setEditing(open ? null : d)}
                    >
                      <span className="text-label-sm text-dark">{name}</span>
                      <span className={caption}>
                        {rs.length
                          ? rs.map(([a, b]) => `${formatMinutes(a)}–${formatMinutes(b)}`).join(", ")
                          : "Off"}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={cn(secondaryButton, smallButton)}
                      onClick={() => setRanges(d, rs.length ? [] : [[16 * 60, 19 * 60]])}
                    >
                      {rs.length ? "Clear" : "Open"}
                    </button>
                  </div>
                  {open ? (
                    <div className="mt-3 flex flex-col gap-2 border-t border-light-525 pt-3">
                      {rs.length === 0 ? <p className="text-body-m text-dark-300">Not available this day.</p> : null}
                      {rs.map(([a, b], idx) => (
                        <div key={idx} className="flex flex-wrap items-center gap-2">
                          <select
                            className={cn(input, "w-[120px]")}
                            value={a}
                            aria-label="From"
                            onChange={(e) => {
                              const next = [...rs] as Range[];
                              next[idx] = [Number(e.target.value), b];
                              setRanges(d, next);
                            }}
                          >
                            {ALL_START_MINUTES.map((m) => (
                              <option key={m} value={m}>{formatMinutes(m)}</option>
                            ))}
                          </select>
                          <span className={caption}>to</span>
                          <select
                            className={cn(input, "w-[120px]", b <= a && "border-error-600 outline outline-1 -outline-offset-1 outline-error-600")}
                            value={b}
                            aria-label="Until"
                            onChange={(e) => {
                              const next = [...rs] as Range[];
                              next[idx] = [a, Number(e.target.value)];
                              setRanges(d, next);
                            }}
                          >
                            {ALL_START_MINUTES.filter((m) => m > a).concat(b > a ? [] : [b]).map((m) => (
                              <option key={m} value={m}>{formatMinutes(m)}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="inline-flex size-[30px] items-center justify-center rounded-control text-dark-300 hover:bg-light-525"
                            aria-label="Remove"
                            onClick={() => setRanges(d, rs.filter((_, j) => j !== idx))}
                          >
                            <X className="size-4" strokeWidth={1.5} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className={cn(secondaryButton, smallButton, "self-start")}
                        onClick={() => {
                          const last = rs[rs.length - 1];
                          const start = last ? Math.min(last[1] + 60, 20 * 60) : 16 * 60;
                          setRanges(d, [...rs, [start, Math.min(start + 120, 22 * 60)]]);
                        }}
                      >
                        <Plus className="size-3.5" strokeWidth={1.5} />
                        Add hours
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <button type="button" className={cn(primaryButton, "self-start")} disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save weekly hours"}
          </button>
        </>
      )}
    </section>
  );
};
