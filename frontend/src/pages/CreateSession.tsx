/**
 * Create session week (Working Copy 4): today plus 6 days by default, week arrows to
 * move forward, seven columns on desktop, day cards on phone, + Add per day.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { scheduleAPI, type ScheduleSession } from "@/api/schedule";
import { SessionDialog } from "@/components/schedule/SessionDialog";
import { AddSessionSheet } from "@/components/schedule/createweek/AddSessionSheet";
import { pageTitle, primaryButton } from "@/components/schedule/styles";
import { calendarCard, chipBox, chipName, chipSub, chipTime, navArrow } from "@/components/schedule/views/styles";
import { warmInfo } from "@/components/schedule/create/classes";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { ROUTES } from "@/routes";
import { cn } from "@/lib/utils";
import {
  addDaysISO,
  bookedAthletes,
  formatClock,
  formatDayISO,
  layoutDays,
  plural,
  requestsFor,
  timeZonePillLabel,
  type ScheduleItem,
} from "@/utils/schedule";
import { isoDateInZone } from "@/utils/viewerTime";

/** Align a day onto a 7-day window that starts on today or today+7k (WC4 week arrows). */
const windowStartForDay = (day: string, today: string): string => {
  if (day <= today) return today;
  let start = today;
  while (addDaysISO(start, 6) < day) start = addDaysISO(start, 7);
  return start;
};

const Chip = ({
  item,
  timeZone,
  onOpen,
}: {
  item: ScheduleItem;
  timeZone: string;
  onOpen: (s: ScheduleSession) => void;
}) => {
  const session = item.session;
  const kind = item.kind;
  const label =
    kind === "busy"
      ? "Busy"
      : kind === "open"
        ? "Open"
        : kind === "offered"
          ? "Offered"
          : kind === "group"
            ? session!.sessionName
            : kind === "request"
              ? requestsFor(session!)[0]?.athleteName
              : bookedAthletes(session!)[0]?.athleteName ?? "Athlete";
  const requests = session ? requestsFor(session).length : 0;
  const sub =
    kind === "group"
      ? `${bookedAthletes(session!).length} of ${session!.capacity}${requests ? ` · ${plural(requests, "request")}` : ""}`
      : kind === "request"
        ? "Request"
        : kind === "booked" || kind === "offered"
          ? "1-on-1"
          : null;
  const content = (
    <>
      <small className={chipTime}>{formatClock(item.start, timeZone)}</small>
      <b className={chipName(kind)}>{label}</b>
      {sub ? <small className={chipSub(kind)}>{sub}</small> : null}
    </>
  );
  if (!session) return <div className={chipBox(kind)}>{content}</div>;
  return (
    <button type="button" className={chipBox(kind)} onClick={() => onOpen(session)}>
      {content}
    </button>
  );
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#EAEADF] border-t-[#0054B4]" />
      </div>
    );
  }
  if (!isCoach) return <Navigate to={ROUTES.DASHBOARD} replace />;

  const rules = schedule.data?.rules;
  const pill = timeZone !== "America/New_York" ? timeZonePillLabel(timeZone) : "";

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" className={navArrow} aria-label="Back to My Schedule" onClick={() => navigate(ROUTES.SCHEDULE)}>
              <ChevronLeft strokeWidth={1.5} />
            </button>
            <div className="flex min-w-0 flex-col gap-[6px]">
              <h1 className={pageTitle}>Create session</h1>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={navArrow}
                  aria-label="Previous 7 days"
                  disabled={!canPrev}
                  onClick={() => setWeekStart((cur) => {
                    const next = addDaysISO(cur, -7);
                    return next < todayISO ? todayISO : next;
                  })}
                >
                  <ChevronLeft strokeWidth={1.5} />
                </button>
                <p className="text-[13px] text-[#767980]">
                  {formatDayISO(dates[0], { month: "short", day: "numeric" })} to{" "}
                  {formatDayISO(dates[6], { month: "short", day: "numeric" })}
                  {pill ? ` · ${pill}` : ""}
                </p>
                <button
                  type="button"
                  className={navArrow}
                  aria-label="Next 7 days"
                  onClick={() => setWeekStart((cur) => addDaysISO(cur, 7))}
                >
                  <ChevronRight strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </div>
          <Link to={ROUTES.SCHEDULE_SETTINGS} className="text-[13px] font-medium text-[#0054B4] hover:underline">
            Schedule settings
          </Link>
        </header>

        <div className={cn(warmInfo, "text-[13px] leading-[18px]")}>
          Add groups and 1-on-1s for the next week. Open slots show on your calendar for families to book.
        </div>

        {schedule.isLoading || !rules ? (
          <div className="rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-4 py-10 text-center text-[14px] text-[#767980]">Loading…</div>
        ) : (
          <>
            <div className={cn(calendarCard, "hidden md:block")}>
              <div className="grid grid-cols-7 gap-2">
                {days.map((day) => {
                  const isToday = day.date === todayISO;
                  return (
                    <div key={day.date} className="flex min-w-0 flex-col gap-2">
                      <div className="flex flex-col gap-0.5 border-b border-[#EAEADF] pb-1.5">
                        <small className="text-[12px] text-[#767980]">{formatDayISO(day.date, { weekday: "short" })}</small>
                        <b className={cn("text-[17px] font-semibold", isToday ? "text-[#0054B4]" : "text-[#1A202C]")}>
                          {formatDayISO(day.date, { day: "numeric" })}
                        </b>
                      </div>
                      <div className="flex min-h-[160px] flex-col gap-1.5">
                        {day.dayOff ? <span className="py-1 text-[12px] font-medium text-[#906A29]">Day off</span> : null}
                        {day.items.map((item) => (
                          <Chip key={item.key} item={item} timeZone={timeZone} onOpen={setOpenSession} />
                        ))}
                        {!day.dayOff && day.date >= todayISO ? (
                          <button
                            type="button"
                            className="mt-auto flex items-center justify-center gap-1 rounded-[8px] border border-dashed border-[#C1C1B8] py-2 text-[12px] font-medium text-[#0054B4] hover:bg-[#F1F1E6]"
                            onClick={() => setAddDate(day.date)}
                          >
                            <Plus className="size-3.5" strokeWidth={2} />
                            Add
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-3 md:hidden">
              {days.map((day) => {
                const isToday = day.date === todayISO;
                return (
                  <section key={day.date} className="rounded-[12px] border border-[#EAEADF] bg-[#F7F7F0] p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex size-8 items-center justify-center rounded-full text-[14px] font-semibold",
                            isToday ? "bg-[#0054B4] text-white" : "bg-[#F1F1E6] text-[#1A202C]",
                          )}
                        >
                          {formatDayISO(day.date, { day: "numeric" })}
                        </span>
                        <div className="flex flex-col">
                          <span className="text-[14px] font-semibold text-[#1A202C]">
                            {isToday ? "Today" : formatDayISO(day.date, { weekday: "long" })}
                          </span>
                          <span className="text-[12px] text-[#767980]">{formatDayISO(day.date, { month: "short", day: "numeric" })}</span>
                        </div>
                      </div>
                      {!day.dayOff && day.date >= todayISO ? (
                        <button type="button" className={cn(primaryButton, "h-8 px-3 text-[12px]")} onClick={() => setAddDate(day.date)}>
                          <Plus className="size-3.5" strokeWidth={2} />
                          Add
                        </button>
                      ) : null}
                    </div>
                    {day.dayOff ? (
                      <p className="text-[13px] text-[#767980]">Day off</p>
                    ) : day.items.length === 0 ? (
                      <p className="text-[13px] text-[#767980]">Nothing yet</p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {day.items.map((item) => (
                          <Chip key={item.key} item={item} timeZone={timeZone} onOpen={setOpenSession} />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
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
        />
      ) : null}

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
