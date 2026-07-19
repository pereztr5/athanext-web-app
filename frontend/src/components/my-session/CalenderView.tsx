import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock4, MapPin, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toLocalISODate } from "@/utils/dateHelpers";
import type { Session } from "@/types/sessions";

type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
  sessions: Session[];
};

type CalenderViewProps = {
  sessions: Session[];
  onSelect?: (session: Session) => void;
};

type ViewMode = "month" | "week" | "day";

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  result.setHours(12, 0, 0, 0);
  return result;
};

const getSafeDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDayKey = (date: Date) => toLocalISODate(date);

const buildSessionsByDay = (sessions: Session[]) => {
  const byDay = new Map<string, Session[]>();

  sessions.forEach((session) => {
    const parsed = getSafeDate(session.start);
    if (!parsed) return;

    const key = formatDayKey(parsed);
    const current = byDay.get(key) ?? [];
    current.push(session);

    current.sort((first, second) => {
      const firstTime = getSafeDate(first.start)?.getTime() ?? 0;
      const secondTime = getSafeDate(second.start)?.getTime() ?? 0;
      return firstTime - secondTime;
    });
    byDay.set(key, current);
  });

  return byDay;
};

const CalenderView = ({ sessions, onSelect }: CalenderViewProps) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1, 12);
  });
  const [activeDate, setActiveDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");

  const sessionsByDay = useMemo(() => buildSessionsByDay(sessions), [sessions]);

  const days = useMemo<CalendarDay[]>(() => {
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1, 12);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 12);

    const startOfCalendar = addDays(startOfMonth, -startOfMonth.getDay());
    const endOfCalendar = addDays(endOfMonth, 6 - endOfMonth.getDay());

    const items: CalendarDay[] = [];
    let cursor = startOfCalendar;

    while (cursor <= endOfCalendar) {
      const key = formatDayKey(cursor);
      items.push({
        date: new Date(cursor),
        isCurrentMonth: cursor.getMonth() === currentMonth.getMonth(),
        sessions: sessionsByDay.get(key) ?? [],
      });
      cursor = addDays(cursor, 1);
    }

    return items;
  }, [currentMonth, sessionsByDay]);

  const chunks = useMemo(() => {
    const list: CalendarDay[][] = [];
    for (let index = 0; index < days.length; index += 7) {
      list.push(days.slice(index, index + 7));
    }
    return list;
  }, [days]);

  const handleMonthChange = (delta: number) => {
    setCurrentMonth(
      (previous) => new Date(previous.getFullYear(), previous.getMonth() + delta, 1, 12)
    );
  };

  const handleNavigate = (delta: number) => {
    if (viewMode === "month") {
      setCurrentMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() + delta, 1, 12));
      setActiveDate((previous) => addDays(new Date(previous), delta * 30));
      return;
    }
    const offset = viewMode === "week" ? delta * 7 : delta;
    setActiveDate((previous) => addDays(new Date(previous), offset));
  };

  const handleSessionClick = (session: Session) => {
    if (!onSelect) return;
    onSelect(session);
  };

  const monthFormatter = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
  const dayFormatter = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const weekFormatter = (() => {
    const start = addDays(new Date(activeDate), -activeDate.getDay());
    const end = addDays(start, 6);
    const startLabel = new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(start);
    const endLabel = new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(end);
    return `${startLabel} - ${endLabel}`;
  })();
  const hasSessions = sessions.some((session) => getSafeDate(session.start));

  const weekDays = useMemo(() => {
    const start = addDays(new Date(activeDate), -activeDate.getDay());
    return Array.from({ length: 7 }).map((_, index) => addDays(start, index));
  }, [activeDate]);

  const dayKey = formatDayKey(activeDate);
  const daySessions = useMemo(
    () => (sessionsByDay.get(dayKey) ?? []).slice().sort((a, b) => {
      const aTime = getSafeDate(a.start)?.getTime() ?? 0;
      const bTime = getSafeDate(b.start)?.getTime() ?? 0;
      return aTime - bTime;
    }),
    [sessionsByDay, dayKey]
  );

  const renderSessionChip = (session: Session) => {
    const startDate = getSafeDate(session.start);
    const endDate = getSafeDate(session.end);
    const timeLabel = startDate
      ? `${startDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}${
          endDate ? ` - ${endDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""
        }`
      : "Time unavailable";
    const isInProgress = session.status === "in-progress";
    const isPast = session.status === "past";
    const borderColor = isInProgress ? "border-emerald-200" : isPast ? "border-rose-200" : "border-blue-200";
    const bgColor = isInProgress
      ? "bg-emerald-50"
      : isPast
      ? "bg-rose-50"
      : "bg-blue-50";

    return (
      <button
        key={session.id}
        type="button"
        onClick={() => handleSessionClick(session)}
        className={cn(
          "w-full text-left rounded-xl border px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200",
          borderColor,
          bgColor
        )}
      >
        <div className="flex items-center gap-2 text-xs text-slate-700">
          <Clock4 className="h-4 w-4" />
          <span>{timeLabel}</span>
        </div>
        <p className="mt-1 text-base font-semibold text-slate-900">{session.title}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-700">
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {session.type}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            {session.location}
          </span>
        </div>
      </button>
    );
  };

  return (
    <Card className="border border-slate-200 rounded-2xl">
      <div className="p-6 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-blue-600" />
              <p className="text-lg font-semibold text-slate-900">Calendar View</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Browse and open your sessions by day. Filters above apply here too.
            </p>
            {!hasSessions && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 w-fit">
                No sessions match the current filters.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {(["month", "week", "day"] as ViewMode[]).map((mode) => (
              <Button
                key={mode}
                variant={viewMode === mode ? "default" : "outline"}
                className="rounded-full text-sm"
                onClick={() => setViewMode(mode)}
                aria-pressed={viewMode === mode}
              >
                {mode === "month" ? "Month" : mode === "week" ? "Week" : "Day"}
              </Button>
            ))}
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              onClick={() => handleNavigate(-1)}
              aria-label="Previous period"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              onClick={() => handleNavigate(1)}
              aria-label="Next period"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {viewMode === "month" && (
          <>
            <div className="grid grid-cols-7 gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {dayLabels.map((label) => (
                <div key={label} className="text-center py-2 rounded-lg bg-slate-100">
                  {label}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {chunks.map((week, index) => (
                <div key={formatDayKey(week[0].date) + index} className="grid grid-cols-7 gap-2">
                  {week.map((day) => {
                    const isToday = formatDayKey(day.date) === formatDayKey(new Date());
                    return (
                      <div
                        key={formatDayKey(day.date)}
                        className={cn(
                          "rounded-xl border bg-white p-3 min-h-[140px] transition focus-within:ring-2 focus-within:ring-blue-200",
                          day.isCurrentMonth ? "border-slate-200" : "border-dashed border-slate-200/70 bg-slate-50",
                          day.sessions.length && "border-blue-200 bg-blue-50/40"
                        )}
                        onClick={() => setActiveDate(new Date(day.date))}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              "text-sm font-semibold",
                              day.isCurrentMonth ? "text-slate-900" : "text-slate-400"
                            )}
                          >
                            {day.date.getDate()}
                          </span>
                          <div className="flex items-center gap-1">
                            {/* {isToday && (
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 rounded-full text-[11px]">
                                Today
                              </Badge>
                            )} */}
                            {day.sessions.length > 0 && (
                              <Badge
                                variant="outline"
                                className="rounded-full border-blue-200 bg-blue-50 text-blue-700 text-[11px]"
                              >
                                {day.sessions.length} {day.sessions.length === 1 ? "session" : "sessions"}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 space-y-2">
                          {day.sessions.length ? (
                            day.sessions.slice(0, 3).map((session) => {
                              const startDate = getSafeDate(session.start);
                              const timeLabel = startDate
                                ? startDate.toLocaleTimeString([], {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })
                                : "Time unavailable";

                              return (
                                <button
                                  key={session.id}
                                  type="button"
                                  className="w-full rounded-lg border border-blue-200 bg-white/80 px-3 py-2 text-left text-sm text-slate-800 hover:border-blue-300 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                                  onClick={() => handleSessionClick(session)}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="font-semibold text-slate-900 line-clamp-1">{session.title}</p>
                                    <span className="text-[11px] text-blue-700 font-medium">{session.type}</span>
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Clock4 className="h-3 w-3" />
                                      {timeLabel}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {session.location}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Users className="h-3 w-3" />
                                      {session.totalAthletes}
                                    </span>
                                  </div>
                                </button>
                              );
                            })
                          ) : (
                            <p className="text-[11px] text-muted-foreground">No sessions</p>
                          )}
                          {day.sessions.length > 3 && (
                            <p className="text-[11px] text-blue-700 font-medium">
                              +{day.sessions.length - 3} more session{day.sessions.length - 3 === 1 ? "" : "s"}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </>
        )}

        {viewMode === "week" && (
          <div className="space-y-4">
            <p className="text-xl font-semibold text-slate-900">{weekFormatter}</p>
            <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
              {weekDays.map((day) => {
                const key = formatDayKey(day);
                const daySessionsList = sessionsByDay.get(key) ?? [];
                const isActive = key === dayKey;
                return (
                  <div
                    key={key}
                    className={cn(
                      "rounded-xl border bg-white p-3 min-h-[220px] flex flex-col gap-3 cursor-pointer",
                      isActive ? "border-blue-400 bg-blue-50/40" : "border-slate-200"
                    )}
                    onClick={() => setActiveDate(new Date(day))}
                  >
                    <div className="space-y-1">
                      <p className="text-xs text-slate-600">{day.toLocaleDateString(undefined, { weekday: "long" })}</p>
                      <p className="text-xl font-bold text-slate-900">{day.getDate()}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {daySessionsList.length} {daySessionsList.length === 1 ? "session" : "sessions"}
                      </p>
                    </div>
                    {isActive && daySessionsList.length > 0 && (
                      <div className="space-y-2">
                        {daySessionsList.map((session) => renderSessionChip(session))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === "day" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
              <p className="text-sm text-blue-800 font-semibold">
                {dayFormatter.format(activeDate)}
              </p>
              <p className="text-xs text-blue-700">
                {daySessions.length} {daySessions.length === 1 ? "session scheduled" : "sessions scheduled"}
              </p>
            </div>
            <div className="space-y-3">
              {daySessions.length ? daySessions.map((session) => renderSessionChip(session)) : (
                <p className="text-sm text-muted-foreground">No sessions for this day.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default CalenderView;
