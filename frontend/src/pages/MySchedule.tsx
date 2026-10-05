/**
 * My Schedule (ATH-71): one Create session button and a Day / Week / Month calendar of the
 * coach's sessions, open slots, requests and Google Calendar busy times. Replaces the
 * separate Calendar and Availability pages: weekly open times are repeating open sessions.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Inbox, Plus, Settings, Users } from "lucide-react";
import { ToastAction } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { bookingRequestsAPI } from "@/api/bookingRequests";
import { calendarSyncAPI, scheduleAPI, type ScheduleSession } from "@/api/schedule";
import { DayView, MonthView, WeekAgenda, WeekColumns, type ScheduleViewHandlers } from "@/components/schedule/ScheduleViews";
import { CreateSessionDialog } from "@/components/schedule/CreateSessionDialog";
import { SessionDialog } from "@/components/schedule/SessionDialog";
import { ClearDayDialog, RequestsDialog, ScheduleSettingsDialog } from "@/components/schedule/ScheduleDialogs";
import { card, iconButton, meta, primaryButton, secondaryButton, segButton, segGroup } from "@/components/schedule/styles";
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

  const [now, setNow] = useState(() => new Date());
  const todayISO = isoDateInZone(now, timeZone);
  const [view, setView] = useState<View | null>(null);
  const [anchor, setAnchor] = useState(todayISO);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState(todayISO);
  const [openSession, setOpenSession] = useState<ScheduleSession | null>(null);
  const [clearDate, setClearDate] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);

  const currentView: View = view ?? (isMobile ? "day" : "week");

  // Keeps request expiry and started-slot checks current while the page is open.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Back from Google sign-in.
  useEffect(() => {
    const result = searchParams.get("calendar");
    if (!result) return;
    if (result === "connected") toast({ title: "Google Calendar connected", description: "Busy times now hide your open slots." });
    else if (result === "error") toast({ title: "Couldn't connect Google Calendar", description: "Please try again.", variant: "destructive" });
    searchParams.delete("calendar");
    setSearchParams(searchParams, { replace: true });
    setSettingsOpen(true);
  }, [searchParams, setSearchParams, toast]);

  const weekStart = weekStartISO(anchor);
  const monthStart = monthStartISO(anchor);
  const dates = useMemo(() => {
    if (currentView !== "month") return weekDates(weekStart);
    return monthGrid(monthStart).filter((d): d is string => Boolean(d));
  }, [currentView, weekStart, monthStart]);

  // Stored dates are Eastern, so fetch a day either side of what's shown.
  const from = addDaysISO(dates[0], -1);
  const to = addDaysISO(dates[dates.length - 1], 1);
  const scheduleQuery = useQuery({
    queryKey: ["coach-schedule", from, to],
    enabled: Boolean(coachId),
    queryFn: () => scheduleAPI.get(from, to),
  });
  const schedule = scheduleQuery.data;

  // Refresh Google busy times when the page opens (the function skips coaches without a calendar).
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

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
    queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
  };

  const respond = useMutation({
    mutationFn: ({ bookingId, accept }: { bookingId: string; accept: boolean }) => bookingRequestsAPI.respond(bookingId, accept),
    onSuccess: (_status, { accept }) => {
      toast({
        title: accept ? "Request accepted" : "Request declined",
        description: accept ? "The family can now pay to confirm the booking." : "The time is open again.",
      });
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
    onOpenSession: setOpenSession,
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
        <h1 className="text-[32px] font-bold leading-[28px] tracking-[-1.6px] text-[#1A202C]">My Schedule</h1>
        <p className="mt-[10px] text-[16px] leading-[18px] text-[#767980]">
          Your coach profile is still being set up. Finish onboarding to see your schedule.
        </p>
      </div>
    );
  }

  const openCreate = (date: string) => {
    setCreateDate(date < todayISO ? todayISO : date);
    setCreateOpen(true);
  };
  const openDay = (date: string) => {
    setAnchor(date);
    setView("day");
  };
  const step = (direction: 1 | -1) =>
    setAnchor((current) => (currentView === "month" ? addMonthsISO(monthStartISO(current), direction) : addDaysISO(weekStartISO(current), 7 * direction)));

  const clearDay = clearDate ? daysByDate.get(clearDate) : undefined;
  const upcomingTimeOff = (schedule?.timeOff ?? []).filter((t) => t.date >= todayISO);
  const navLabel =
    currentView === "month"
      ? formatDayISO(monthStart, { month: "long", year: "numeric" })
      : `${formatDayISO(weekStart, { month: "short", day: "numeric" })} – ${formatDayISO(addDaysISO(weekStart, 6), { month: "short", day: "numeric" })}`;

  return (
    <div className="overflow-x-hidden px-4 pb-16 md:px-10">
      <div className={cn("mx-auto flex w-full flex-col gap-5", currentView === "week" ? "max-w-[1200px]" : "max-w-[760px]")}>
        <header className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-[10px]">
            <h1 className="text-[32px] font-bold leading-[28px] tracking-[-1.6px] text-[#1A202C]">My Schedule</h1>
            <p className={meta}>
              Times in {timeZone.replace(/_/g, " ")} ({timeZoneAbbreviation(timeZone, now)})
            </p>
          </div>
          <div className="flex gap-2">
            <Link to={ROUTES.SCHEDULE_PLAN} className={cn(secondaryButton, "hidden sm:inline-flex")}>
              <Users strokeWidth={1.5} aria-hidden="true" />
              Plan group week
            </Link>
            <button type="button" className={cn(primaryButton, "hidden sm:inline-flex")} onClick={() => openCreate(currentView === "day" ? anchor : todayISO)}>
              <Plus strokeWidth={1.5} aria-hidden="true" />
              Create session
            </button>
          </div>
        </header>

        {requests.length ? (
          <button
            type="button"
            onClick={() => setRequestsOpen(true)}
            className="flex items-center gap-3 rounded-[10px] bg-[#FCEFDA] px-4 py-3 text-left text-[14px] font-medium text-[#906A29] hover:bg-[#F9E6C6]"
          >
            <Inbox className="size-4 flex-none" strokeWidth={1.5} aria-hidden="true" />
            <span className="grow">{plural(requests.length, "booking request")} waiting</span>
            <span className="flex items-center gap-1">
              Review
              <ChevronRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
            </span>
          </button>
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:hidden">
          <Link to={ROUTES.SCHEDULE_PLAN} className={cn(secondaryButton, "h-[42px]")}>
            <Users strokeWidth={1.5} aria-hidden="true" />
            Plan group week
          </Link>
          <button type="button" className={cn(primaryButton, "h-[42px]")} onClick={() => openCreate(currentView === "day" ? anchor : todayISO)}>
            <Plus strokeWidth={1.5} aria-hidden="true" />
            Create session
          </button>
        </div>

        <section className={card}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className={cn(segGroup, "sm:w-[260px]")} role="group" aria-label="View">
              {(["day", "week", "month"] as View[]).map((v) => (
                <button key={v} type="button" className={segButton(currentView === v)} aria-pressed={currentView === v} onClick={() => setView(v)}>
                  {v === "day" ? "Day" : v === "week" ? "Week" : "Month"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className={iconButton} aria-label={currentView === "month" ? "Previous month" : "Previous week"} onClick={() => step(-1)}>
                <ChevronLeft strokeWidth={1.5} />
              </button>
              <b className="min-w-[132px] text-center text-[14px] font-medium text-[#1A202C]">{navLabel}</b>
              <button type="button" className={iconButton} aria-label={currentView === "month" ? "Next month" : "Next week"} onClick={() => step(1)}>
                <ChevronRight strokeWidth={1.5} />
              </button>
              <button type="button" className={cn(secondaryButton, "h-[30px] px-3")} onClick={() => setAnchor(todayISO)}>
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
              onClearDay={setClearDate}
              onRestoreDay={(date) => restore.mutate(date)}
            />
          ) : currentView === "week" ? (
            <>
              <div className="hidden lg:block">
                <WeekColumns days={weekDays} todayISO={todayISO} timeZone={timeZone} handlers={handlers} onOpenDay={openDay} />
              </div>
              <div className="lg:hidden">
                <WeekAgenda days={weekDays} timeZone={timeZone} now={now} handlers={handlers} onOpenDay={openDay} />
              </div>
            </>
          ) : (
            <MonthView cells={monthGrid(monthStart)} daysByDate={daysByDate} todayISO={todayISO} onOpenDay={openDay} />
          )}
        </section>

        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-3 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-4 py-3 text-left hover:bg-[#F4F4EB]"
        >
          <Settings className="size-4 flex-none text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
          <span className="grow text-[14px] text-[#484D56]">
            {schedule?.calendar
              ? "Google Calendar synced: busy times hide your open slots"
              : "Google Calendar not connected"}
          </span>
          <span className="flex items-center gap-1 text-[14px] font-medium text-[#0054B4]">
            Schedule settings
            <ChevronRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
          </span>
        </button>
      </div>

      {schedule ? (
        <CreateSessionDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          startDate={createDate}
          todayISO={todayISO}
          timeZone={timeZone}
          rules={schedule.rules}
          coachId={coachId}
          coachName={userName || userProfile?.name || "Your coach"}
        />
      ) : null}
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
      <ClearDayDialog
        date={clearDate}
        openSlots={clearDay?.items.filter((i) => i.kind === "open").length ?? 0}
        bookedSessions={clearDay?.items.filter((i) => i.kind === "booked" || i.kind === "group" || i.kind === "offered").length ?? 0}
        onClose={() => setClearDate(null)}
        onCleared={(date, closed) => {
          setClearDate(null);
          refresh();
          toast({
            title: `${formatDayISO(date, { weekday: "short", month: "short", day: "numeric" })} cleared`,
            description: closed ? `${plural(closed, "open slot")} closed.` : "Marked as a day off.",
            action: (
              <ToastAction altText="Undo clear day" onClick={() => restore.mutate(date)}>
                Undo
              </ToastAction>
            ),
          });
        }}
      />
      <ScheduleSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        schedule={schedule}
        upcomingTimeOff={upcomingTimeOff}
        onRestoreDay={(date) => restore.mutate(date)}
      />
      <RequestsDialog
        open={requestsOpen}
        onOpenChange={setRequestsOpen}
        requests={requests}
        timeZone={timeZone}
        now={now}
        respondingId={respondingId}
        onRespond={handlers.onRespond}
      />
    </div>
  );
};

export default MySchedulePage;
