/**
 * My Schedule (ATH-71, Working Copy 4): Create session opens the week page; Day / Week / Month
 * calendar of sessions, open slots, requests and Google Calendar busy times. Always opens on
 * this Monday. Phone week is one scrolling list. Planner drafts stay hidden until publish.
 */
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Inbox, Plus, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { bookingRequestsAPI } from "@/api/bookingRequests";
import { calendarSyncAPI, scheduleAPI, type ScheduleSession } from "@/api/schedule";
import { DayView, MonthView, WeekAgenda, WeekColumns, type ScheduleViewHandlers } from "@/components/schedule/ScheduleViews";
import { SessionDialog } from "@/components/schedule/SessionDialog";
import { RequestsPage } from "@/components/schedule/RequestsPage";
import { hoursLineFromSeries } from "@/components/schedule/settings/WeeklyHoursCard";
import { meta, pageTitle, primaryButton, secondaryButton, segButton, segGroup, smallButton } from "@/components/schedule/styles";
import { calendarCard, navArrow } from "@/components/schedule/views/styles";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import {
  addDaysISO,
  addMonthsISO,
  formatDayISO,
  layoutDays,
  monthGrid,
  monthStartISO,
  plural,
  sessionKind,
  weekDates,
  weekStartISO,
} from "@/utils/schedule";
import { isoDateInZone, timeZoneAbbreviation } from "@/utils/viewerTime";

type View = "day" | "week" | "month";

const MySchedulePage = () => {
  const { isCoach, ready } = useRole();
  const { userProfile, userName } = useAuth();
  const coachId = userProfile?.coach_id ?? null;
  const timeZone = useViewerTimeZone();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const showRequests = Boolean(searchParams.get("requests"));

  const [now, setNow] = useState(() => new Date());
  const todayISO = isoDateInZone(now, timeZone);
  const [view, setView] = useState<View | null>(null);
  // Always open on this Monday (Working Copy 4).
  const [anchor, setAnchor] = useState(() => weekStartISO(todayISO));
  const [openSession, setOpenSession] = useState<ScheduleSession | null>(null);
  const [showEarlier, setShowEarlier] = useState(false);
  const [extraWeeks, setExtraWeeks] = useState(0);

  // Phone: Week | Month only (Working Copy 4). Desktop keeps Day.
  const currentView: View = (() => {
    const base = view ?? "week";
    return isMobile && base === "day" ? "week" : base;
  })();

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Links from Coach Home: ?day=YYYY-MM-DD opens that day, ?create=1 opens Create session week.
  useEffect(() => {
    const day = searchParams.get("day");
    const create = searchParams.get("create");
    if (!day && !create) return;
    if (create) {
      const target = day && /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= todayISO ? day : todayISO;
      navigate(`${ROUTES.SCHEDULE_CREATE}?day=${target}`, { replace: true });
      return;
    }
    if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
      setAnchor(day);
      setView(isMobile ? "week" : "day");
    }
    searchParams.delete("day");
    searchParams.delete("create");
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams, todayISO, navigate, isMobile]);

  useEffect(() => {
    const result = searchParams.get("calendar");
    if (!result) return;
    if (result === "connected") toast({ title: "Google Calendar connected", description: "Busy times now hide your open slots." });
    else if (result === "error") toast({ title: "Couldn't connect Google Calendar", description: "Please try again.", variant: "destructive" });
    navigate(ROUTES.SCHEDULE_SETTINGS, { replace: true });
  }, [searchParams, navigate, toast]);

  const weekStart = weekStartISO(anchor);
  const monthStart = monthStartISO(anchor);

  useEffect(() => {
    setShowEarlier(false);
    setExtraWeeks(0);
  }, [weekStart]);

  useEffect(() => {
    if (!isMobile || currentView !== "week") return;
    const id = window.setTimeout(() => document.getElementById("sch-today")?.scrollIntoView({ block: "start" }), 80);
    return () => window.clearTimeout(id);
  }, [isMobile, currentView, weekStart, todayISO]);

  const dates = useMemo(() => {
    if (currentView === "month") return monthGrid(monthStart).filter((d): d is string => Boolean(d));
    const base = weekDates(weekStart);
    if (!isMobile || extraWeeks <= 0) return base;
    const extra: string[] = [];
    for (let w = 1; w <= extraWeeks; w++) {
      extra.push(...weekDates(addDaysISO(weekStart, 7 * w)));
    }
    return [...base, ...extra];
  }, [currentView, weekStart, monthStart, isMobile, extraWeeks]);

  const from = addDaysISO(dates[0], -1);
  const to = addDaysISO(dates[dates.length - 1], 1);
  const scheduleQuery = useQuery({
    queryKey: ["coach-schedule", from, to],
    enabled: Boolean(coachId),
    queryFn: () => scheduleAPI.get(from, to),
  });
  const schedule = scheduleQuery.data;
  const hoursLine = useMemo(
    () => hoursLineFromSeries(schedule?.series ?? []),
    [schedule?.series]
  );

  const calendarConnected = Boolean(schedule?.calendar);
  useEffect(() => {
    if (!coachId || !calendarConnected) return;
    calendarSyncAPI
      .sync()
      .then((synced) => synced && queryClient.invalidateQueries({ queryKey: ["coach-schedule"] }))
      .catch(() => undefined);
  }, [coachId, calendarConnected, queryClient]);

  const requestsQuery = useQuery({
    queryKey: ["booking-requests"],
    enabled: Boolean(coachId),
    queryFn: () => bookingRequestsAPI.listForCoach(),
  });
  const requests = requestsQuery.data ?? [];

  const days = useMemo(
    () =>
      layoutDays({
        dates,
        sessions: schedule?.sessions ?? [],
        busy: schedule?.busy ?? [],
        timeOff: schedule?.timeOff ?? [],
        timeZone,
        now,
      }),
    [dates, schedule, timeZone, now]
  );
  const daysByDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const weekDays = useMemo(() => weekDates(weekStart).map((d) => daysByDate.get(d)!).filter(Boolean), [weekStart, daysByDate]);
  const agendaDays = useMemo(() => dates.map((d) => daysByDate.get(d)!).filter(Boolean), [dates, daysByDate]);
  const nextAppendStart = addDaysISO(weekStart, 7 * (extraWeeks + 1));

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
    queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
  };

  const respond = useMutation({
    mutationFn: ({ bookingId, accept }: { bookingId: string; accept: boolean }) => bookingRequestsAPI.respond(bookingId, accept),
    onSuccess: (status, { bookingId, accept }) => {
      toast({
        title: accept ? "Request accepted" : "Request declined",
        description: !accept
          ? "The time is open again."
          : status === "charged"
            ? "It's booked and the family's card was charged."
            : status === "booked"
              ? "It's booked."
              : "The family can now pay to confirm the booking.",
      });
      if (accept && schedule?.calendar?.canWrite) {
        void calendarSyncAPI.addEvent(bookingId).then(({ added }) => {
          if (added) toast({ title: "Added to your Google Calendar" });
        });
      }
      setOpenSession(null);
      refresh();
    },
    onError: (error: unknown) =>
      toast({
        title: "Couldn't update the request",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      }),
  });
  const respondingId = respond.isPending ? respond.variables?.bookingId ?? null : null;
  const handlers: ScheduleViewHandlers = {
    onOpenSession: (session) => {
      const kind = sessionKind(session);
      if (kind === "booked" || kind === "request") navigate(`/sessions/${session.id}`);
      else setOpenSession(session);
    },
    onRespond: (bookingId, accept) => respond.mutate({ bookingId, accept }),
    respondingId,
  };

  const restore = useMutation({
    mutationFn: (date: string) => scheduleAPI.restoreDay(date),
    onSuccess: (count, date) => {
      toast({
        title: `${formatDayISO(date, { weekday: "short", month: "short", day: "numeric" })} is a working day again`,
        description: count ? `${plural(count, "open slot")} came back.` : "Add open slots with Create session.",
      });
      refresh();
    },
    onError: (error: unknown) =>
      toast({ title: "Couldn't undo", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }),
  });

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#EAEADF] border-t-[#0054B4]" />
      </div>
    );
  }
  if (!isCoach) return <Navigate to={ROUTES.DASHBOARD} replace />;
  if (!coachId) {
    return (
      <div className="mx-auto max-w-[1000px] px-4 py-10 md:px-0">
        <h1 className={pageTitle}>My Schedule</h1>
        <p className="mt-[10px] text-[16px] leading-[18px] text-[#767980]">
          Your coach profile is still being set up. Finish onboarding to see your schedule.
        </p>
      </div>
    );
  }

  const openCreate = (date?: string) => {
    const target = date && date >= todayISO ? date : todayISO;
    navigate(`${ROUTES.SCHEDULE_CREATE}?day=${target}`);
  };
  const openDay = (date: string) => {
    setAnchor(date);
    setView(isMobile ? "week" : "day");
  };
  const step = (direction: 1 | -1) =>
    setAnchor((current) => (currentView === "month" ? addMonthsISO(monthStartISO(current), direction) : addDaysISO(weekStartISO(current), 7 * direction)));

  const navLabel =
    currentView === "month"
      ? formatDayISO(monthStart, { month: "long", year: "numeric" })
      : `${formatDayISO(weekStart, { month: "short", day: "numeric" })} – ${formatDayISO(addDaysISO(weekStart, 6), { month: "short", day: "numeric" })}`;

  const planButton = (className: string) => (
    <button type="button" className={cn(secondaryButton, className)} onClick={() => navigate(ROUTES.SCHEDULE_PLAN)}>
      <CalendarDays strokeWidth={1.5} aria-hidden="true" />
      Plan next week
    </button>
  );
  const createButton = (className: string) => (
    <button type="button" className={cn(primaryButton, className)} onClick={() => openCreate(currentView === "day" ? anchor : todayISO)}>
      <Plus strokeWidth={1.5} aria-hidden="true" />
      Create session
    </button>
  );

  if (showRequests) {
    return (
      <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
        <RequestsPage
          requests={requests}
          loading={requestsQuery.isLoading}
          timeZone={timeZone}
          now={now}
          respondingId={respondingId}
          onAccept={(bookingId) => respond.mutate({ bookingId, accept: true })}
          onBack={() => navigate(ROUTES.SCHEDULE)}
          onChanged={refresh}
        />
      </div>
    );
  }

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className={cn("mx-auto flex w-full flex-col gap-4", currentView === "week" ? "max-w-[1120px]" : "max-w-[760px]")}>
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-[10px]">
            <h1 className={pageTitle}>My Schedule</h1>
            <button
              type="button"
              className="inline-flex max-w-full items-center gap-1.5 self-start text-left text-[13px] text-[#767980] hover:text-[#1A202C]"
              aria-label={`Your weekly hours: ${hoursLine}. Open Schedule settings`}
              onClick={() => navigate(`${ROUTES.SCHEDULE_SETTINGS}#weekly-hours`)}
            >
              <Clock className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <span className="underline decoration-[#C1C1B8] underline-offset-2">
                <span className="hidden md:inline">Hours: </span>
                {hoursLine}
                <span className="hidden md:inline"> · Schedule settings</span>
              </span>
              <ChevronRight className="size-3.5 shrink-0 md:hidden" strokeWidth={1.5} aria-hidden="true" />
            </button>
            {timeZone !== "America/New_York" ? (
              <p className={meta}>
                Times in {timeZone.replace(/_/g, " ")} ({timeZoneAbbreviation(timeZone, now)})
              </p>
            ) : null}
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <button
              type="button"
              className={cn(secondaryButton, smallButton)}
              onClick={() => navigate(ROUTES.SCHEDULE_SETTINGS)}
            >
              <Settings className="size-4" strokeWidth={1.5} aria-hidden="true" />
              Schedule settings
            </button>
            {planButton("")}
            {createButton("")}
          </div>
        </header>

        {requests.length ? (
          <button
            type="button"
            onClick={() => setSearchParams({ requests: "1" })}
            className="flex items-center gap-[10px] rounded-[10px] bg-[#FCEFDA] px-[14px] py-3 text-left text-[14px] font-medium text-[#906A29] hover:bg-[#F9E6C6]"
          >
            <Inbox className="size-4 flex-none" strokeWidth={1.5} aria-hidden="true" />
            <span className="grow">{plural(requests.length, "booking request")} waiting</span>
            <span className="flex items-center gap-1">
              Review
              <ChevronRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
            </span>
          </button>
        ) : null}

        <div className="flex flex-col gap-2 md:hidden">
          {planButton("h-[46px] w-full")}
          {createButton("h-[46px] w-full")}
          <button
            type="button"
            className={cn(secondaryButton, "h-[40px] w-full")}
            onClick={() => navigate(ROUTES.SCHEDULE_SETTINGS)}
          >
            <Settings className="size-4" strokeWidth={1.5} aria-hidden="true" />
            Schedule settings
          </button>
        </div>

        <section className={calendarCard}>
          <div className="flex flex-col gap-[10px] md:flex-row md:flex-wrap md:items-center md:justify-between">
            <div className={cn(segGroup, "w-full md:inline-flex md:w-auto")} role="group" aria-label="View">
              {(isMobile ? (["week", "month"] as View[]) : (["day", "week", "month"] as View[])).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={cn(segButton(currentView === v), "md:min-w-[64px] md:flex-none")}
                  aria-pressed={currentView === v}
                  onClick={() => setView(v)}
                >
                  {v === "day" ? "Day" : v === "week" ? "Week" : "Month"}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2 md:justify-start">
              <button type="button" className={navArrow} aria-label={currentView === "month" ? "Previous month" : "Previous week"} onClick={() => step(-1)}>
                <ChevronLeft strokeWidth={1.5} />
              </button>
              <b className="flex-1 text-center text-[15px] font-semibold leading-[18px] text-[#1A202C] md:min-w-[120px] md:flex-none">{navLabel}</b>
              <button type="button" className={navArrow} aria-label={currentView === "month" ? "Next month" : "Next week"} onClick={() => step(1)}>
                <ChevronRight strokeWidth={1.5} />
              </button>
              <button type="button" className={cn(secondaryButton, smallButton)} onClick={() => setAnchor(weekStartISO(todayISO))}>
                Today
              </button>
            </div>
          </div>

          {scheduleQuery.isError ? (
            <p className="rounded-[8px] bg-[#FDF1F1] px-[15px] py-3 text-[14px] text-[#B42318]">
              Couldn't load your schedule. Please try again later.
            </p>
          ) : scheduleQuery.isLoading ? (
            <p className={meta}>Loading…</p>
          ) : currentView === "day" ? (
            <DayView
              days={weekDays}
              selected={anchor}
              todayISO={todayISO}
              timeZone={timeZone}
              now={now}
              handlers={handlers}
              onSelect={setAnchor}
              onAdd={openCreate}
              onRestoreDay={(date) => restore.mutate(date)}
            />
          ) : currentView === "week" ? (
            <>
              <div className="hidden md:block">
                <WeekColumns days={weekDays} todayISO={todayISO} timeZone={timeZone} handlers={handlers} onOpenDay={openDay} />
              </div>
              <div className="md:hidden">
                <WeekAgenda
                  days={agendaDays}
                  todayISO={todayISO}
                  weekStart={weekStart}
                  showEarlier={showEarlier}
                  onToggleEarlier={() => setShowEarlier((v) => !v)}
                  nextWeekLabel={formatDayISO(nextAppendStart, { month: "short", day: "numeric" })}
                  onShowNextWeek={() => setExtraWeeks((n) => n + 1)}
                  timeZone={timeZone}
                  now={now}
                  handlers={handlers}
                  onOpenDay={openDay}
                />
              </div>
            </>
          ) : (
            <MonthView cells={monthGrid(monthStart)} daysByDate={daysByDate} todayISO={todayISO} onOpenDay={openDay} />
          )}
        </section>

        <button
          type="button"
          onClick={() => navigate(ROUTES.SCHEDULE_SETTINGS)}
          className="flex w-full items-center gap-2 px-0.5 py-1 text-left text-[13px] leading-[18px] text-[#767980] hover:text-[#484D56]"
        >
          <Settings className="size-[15px] flex-none" strokeWidth={1.5} aria-hidden="true" />
          <span className="grow">
            {schedule?.calendar ? "Google Calendar synced: busy times hide your open slots" : "Google Calendar not connected"}
          </span>
          <span className="inline-flex flex-none items-center gap-0.5 text-[12px] font-medium text-[#0054B4]">
            Schedule settings
            <ChevronRight className="size-3" strokeWidth={1.5} aria-hidden="true" />
          </span>
        </button>
      </div>

      {schedule ? (
        <SessionDialog
          session={openSession}
          series={schedule.series}
          onClose={() => setOpenSession(null)}
          rules={schedule.rules}
          timeZone={timeZone}
          coachId={coachId}
          coachName={userName || userProfile?.name || "Your coach"}
          onRespond={handlers.onRespond}
          respondingId={respondingId}
        />
      ) : null}
    </div>
  );
};

export default MySchedulePage;
