/**
 * Create session week (Working Copy 4 createweek.js): today plus 6 days, week arrows,
 * shared date-tile grid with Add per day (desktop columns, phone cards).
 */
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { scheduleAPI, type ScheduleSession } from "@/api/schedule";
import { CampEditorDialog } from "@/components/camps/CampEditorDialog";
import { SessionDialog } from "@/components/schedule/SessionDialog";
import { AddSessionSheet } from "@/components/schedule/createweek/AddSessionSheet";
import { WeekDayGrid } from "@/components/schedule/WeekDayGrid";
import { PageHeader } from "@/components/ui/page-header";
import { calendarCard, navArrow } from "@/components/schedule/views/styles";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { ROUTES } from "@/routes";
import { cn } from "@/lib/utils";
import {
  addDaysISO,
  formatDayISO,
  layoutDays,
  plural,
  timeZonePillLabel,
} from "@/utils/schedule";
import { isoDateInZone } from "@/utils/viewerTime";

/** Align a day onto a 7-day window that starts on today or today+7k (WC4 week arrows). */
const windowStartForDay = (day: string, today: string): string => {
  if (day <= today) return today;
  let start = today;
  while (addDaysISO(start, 6) < day) start = addDaysISO(start, 7);
  return start;
};

export default function CreateSession() {
  const { isCoach, ready } = useRole();
  const { userProfile, userName } = useAuth();
  const coachId = userProfile?.coach_id ?? null;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const timeZone = useViewerTimeZone();
  const todayISO = isoDateInZone(new Date(), timeZone);
  const dayParam = params.get("day");
  const [weekStart, setWeekStart] = useState(() => {
    const day = params.get("day");
    return day && /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= todayISO
      ? windowStartForDay(day, todayISO)
      : todayISO;
  });
  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i)), [weekStart]);
  const canPrev = weekStart > todayISO;
  const [addDate, setAddDate] = useState<string | null>(null);
  const [openSession, setOpenSession] = useState<ScheduleSession | null>(null);
  const [campOpen, setCampOpen] = useState(false);

  useEffect(() => {
    if (weekStart < todayISO) setWeekStart(todayISO);
  }, [todayISO, weekStart]);

  useEffect(() => {
    if (!dayParam) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayParam) || dayParam < todayISO) {
      params.delete("day");
      setParams(params, { replace: true });
      return;
    }
    setWeekStart(windowStartForDay(dayParam, todayISO));
    setAddDate(dayParam);
    params.delete("day");
    setParams(params, { replace: true });
    // Only react to a fresh ?day= param.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot open
  }, [dayParam, todayISO]);

  const from = addDaysISO(dates[0], -1);
  const to = addDaysISO(dates[6], 1);
  const schedule = useQuery({
    queryKey: ["coach-schedule", from, to],
    queryFn: () => scheduleAPI.get(from, to),
    enabled: Boolean(coachId),
  });

  const days = useMemo(
    () =>
      layoutDays({
        dates,
        sessions: schedule.data?.sessions ?? [],
        busy: schedule.data?.busy ?? [],
        timeOff: schedule.data?.timeOff ?? [],
        timeZone,
      }),
    [schedule.data, dates, timeZone],
  );

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-light-525 border-t-primary" />
      </div>
    );
  }
  if (!isCoach) return <Navigate to={ROUTES.DASHBOARD} replace />;

  const rules = schedule.data?.rules;
  const pill = timeZone !== "America/New_York" ? timeZonePillLabel(timeZone) : "";
  const allSessions = days.flatMap((d) => d.items.filter((x) => x.kind !== "busy"));
  const daysWith = new Set(allSessions.map((x) => x.session!.date)).size;
  const rangeLabel =
    weekStart === todayISO
      ? "Today and the next 6 days"
      : `${formatDayISO(dates[0], { month: "short", day: "numeric" })} to ${formatDayISO(dates[6], { month: "short", day: "numeric" })}`;

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-wrapper flex-col gap-4 md:gap-6">
        <PageHeader
          title="Create session"
          back={{ label: "My schedule", onClick: () => navigate(ROUTES.SCHEDULE) }}
          subtitle={
            <>
              {rangeLabel}
              {pill ? ` · ${pill}` : ""} · {plural(allSessions.length, "session")} on {plural(daysWith, "day")}. Pick a
              day to add to it.
            </>
          }
          actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={navArrow}
              aria-label="Previous 7 days"
              disabled={!canPrev}
              onClick={() =>
                setWeekStart((cur) => {
                  const next = addDaysISO(cur, -7);
                  return next < todayISO ? todayISO : next;
                })
              }
            >
              <ChevronLeft strokeWidth={1.5} />
            </button>
            <span className="whitespace-nowrap text-label-sm text-dark">
              {formatDayISO(dates[0], { month: "short", day: "numeric" })} to{" "}
              {formatDayISO(dates[6], { month: "short", day: "numeric" })}
            </span>
            <button
              type="button"
              className={navArrow}
              aria-label="Next 7 days"
              onClick={() => setWeekStart((cur) => addDaysISO(cur, 7))}
            >
              <ChevronRight strokeWidth={1.5} />
            </button>
          </div>
          }
        />

        {schedule.isLoading || !rules ? (
          <div className="rounded-card border border-light-525 bg-light-300 px-4 py-10 text-center text-body-m text-dark-300">
            Loading…
          </div>
        ) : (
          <>
            <section className={cn(calendarCard, "hidden md:block")}>
              <WeekDayGrid
                days={days}
                todayISO={todayISO}
                timeZone={timeZone}
                onOpen={setOpenSession}
                onAdd={setAddDate}
              />
            </section>
            <div className="md:hidden">
              <WeekDayGrid
                days={days}
                todayISO={todayISO}
                timeZone={timeZone}
                phone
                onOpen={setOpenSession}
                onAdd={setAddDate}
              />
            </div>
          </>
        )}
      </div>

      {addDate && rules && coachId ? (
        <AddSessionSheet
          open={Boolean(addDate)}
          onOpenChange={(o) => !o && setAddDate(null)}
          date={addDate}
          todayISO={todayISO}
          timeZone={timeZone}
          rules={rules}
          day={days.find((d) => d.date === addDate)}
          coachId={coachId}
          onPickCamp={() => {
            setAddDate(null);
            setCampOpen(true);
          }}
        />
      ) : null}

      {coachId ? <CampEditorDialog open={campOpen} campId={null} onOpenChange={setCampOpen} /> : null}

      {schedule.data && coachId ? (
        <SessionDialog
          session={openSession}
          series={schedule.data.series}
          onClose={() => setOpenSession(null)}
          rules={schedule.data.rules}
          timeZone={timeZone}
          coachId={coachId}
          coachName={userName || userProfile?.name || "Your coach"}
          onRespond={() => undefined}
          respondingId={null}
        />
      ) : null}
    </div>
  );
}
