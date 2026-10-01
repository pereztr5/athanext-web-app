/**
 * Coach calendar (ATH-28): the coach's week of sessions, requests and open slots in
 * their own time zone, with pending booking requests alongside.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useToast } from "@/hooks/use-toast";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import useCoachAvailabilityWithOccurrences from "@/hooks/useCoachAvailabilityWithOccurrences";
import { supabase } from "@/integrations/supabase/client";
import { bookingRequestsAPI } from "@/api/bookingRequests";
import { getMySessions } from "@/api/sessions";
import { ManageAvailabilityModal } from "@/components/coach-profile/ManageAvailabilityModal";
import { CalendarLegend, DayList, WeekGrid } from "@/components/coach-calendar/CalendarBlocks";
import { RequestsPanel } from "@/components/coach-calendar/RequestsPanel";
import type { CoachAvailability } from "@/types/availability";
import {
  addDaysISO,
  formatCalendarSummary,
  formatWeekLabel,
  layoutCoachWeek,
  weekStartISO,
  type CalendarOccurrence,
} from "@/utils/coachCalendar";
import { isoDateInZone, timeZoneAbbreviation } from "@/utils/viewerTime";
import { ROUTES } from "@/routes";

const secondaryButtonClass =
  "inline-flex h-[34px] items-center justify-center gap-[6px] rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] px-4 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C] transition-colors hover:bg-[#EAEADF]";
const primaryButtonClass =
  "inline-flex h-[34px] items-center justify-center gap-[6px] rounded-[8px] border border-[#6698D2] bg-[#0054B4] px-4 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#F1F1E6] transition-colors hover:bg-[#004390]";
const iconButtonClass =
  "inline-flex size-[34px] items-center justify-center rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] text-[#1A202C] transition-colors hover:bg-[#EAEADF]";

const CoachCalendarPage = () => {
  const { isCoach, ready } = useRole();
  const { userProfile } = useAuth();
  const coachId = userProfile?.coach_id ?? null;
  const timeZone = useViewerTimeZone();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [now, setNow] = useState(() => new Date());
  const todayISO = isoDateInZone(now, timeZone);
  const [weekStart, setWeekStart] = useState(() => weekStartISO(todayISO));
  const [addOpen, setAddOpen] = useState(false);

  // Keeps "waiting over 24h" and started-session checks current while the page is open.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Stored dates are Eastern, so fetch a day either side of the viewer's week.
  const occurrencesQuery = useQuery({
    queryKey: ["coach-calendar-occurrences", coachId, weekStart],
    enabled: Boolean(coachId),
    queryFn: async (): Promise<CalendarOccurrence[]> => {
      const { data, error } = await supabase
        .from("coach_availability_slot_occurrences" as any)
        .select(
          "id, occurrence_date, start_time, end_time, session_name, session_type, location, pillar_slot, price, is_enabled, max_bookings_per_slot"
        )
        .eq("coach_id", coachId!)
        .gte("occurrence_date", addDaysISO(weekStart, -1))
        .lte("occurrence_date", addDaysISO(weekStart, 7));
      if (error) throw error;
      return ((data as any[]) || []) as CalendarOccurrence[];
    },
  });

  // Same key as useMySessions, so both pages share and refresh the coach's bookings.
  const sessionsQuery = useQuery({
    queryKey: ["sessions", "coach", coachId || ""],
    enabled: Boolean(coachId),
    queryFn: () => getMySessions(coachId!, "coach").then((res) => res.data || []),
    staleTime: 5 * 60 * 1000,
  });

  const requestsQuery = useQuery({
    queryKey: ["booking-requests"],
    enabled: Boolean(coachId),
    queryFn: () => bookingRequestsAPI.listForCoach(),
  });
  const requests = useMemo(() => requestsQuery.data ?? [], [requestsQuery.data]);

  const { data: availabilities, refetch: refetchAvailabilities } = useCoachAvailabilityWithOccurrences(coachId);

  const respond = useMutation({
    mutationFn: ({ bookingId, accept }: { bookingId: string; accept: boolean }) =>
      bookingRequestsAPI.respond(bookingId, accept),
    onSuccess: (_status, { accept }) => {
      toast({
        title: accept ? "Request accepted" : "Request declined",
        description: accept ? "The athlete can now pay to confirm the booking." : "The slot is open again.",
      });
      queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (error: unknown) => {
      toast({
        title: "Couldn't update the request",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });
  const respondingId = respond.isPending ? respond.variables?.bookingId ?? null : null;
  const onRespond = (bookingId: string, accept: boolean) => respond.mutate({ bookingId, accept });

  const layout = useMemo(
    () =>
      layoutCoachWeek({
        weekStart,
        timeZone,
        occurrences: occurrencesQuery.data ?? [],
        bookings: (sessionsQuery.data ?? [])
          .filter((session) => session.occurrenceId)
          .map((session) => ({
            occurrenceId: session.occurrenceId!,
            athleteNames: session.athleteNames ?? [],
            athleteCount: Number(session.athleteCount) || 0,
            pillarSlot: session.pillarSlot ?? null,
          })),
        requests: requests.map((request) => ({
          bookingId: request.bookingId,
          occurrenceId: request.occurrenceId,
          athleteName: request.athleteName,
        })),
      }),
    [occurrencesQuery.data, requests, sessionsQuery.data, timeZone, weekStart]
  );

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#EAEADF] border-t-[#0054B4]" />
      </div>
    );
  }

  if (!isCoach) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  if (!coachId) {
    return (
      <div className="mx-auto max-w-[1000px] px-4 py-10 md:px-0">
        <h1 className="text-[32px] font-bold leading-[28px] tracking-[-1.6px] text-[#1A202C]">Calendar</h1>
        <p className="mt-[10px] text-[16px] leading-[18px] tracking-[-0.48px] text-[#767980]">
          Your coach profile is still being set up. Finish onboarding to see your calendar.
        </p>
      </div>
    );
  }

  const loading = occurrencesQuery.isLoading || sessionsQuery.isLoading;
  const loadFailed = occurrencesQuery.isError || sessionsQuery.isError;
  const viewProps = { layout, todayISO, timeZone, respondingId, onRespond };

  return (
    <div className="overflow-x-hidden px-4 pb-16 md:px-10">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">
        <header className="flex flex-col gap-[10px]">
          <h1 className="text-[32px] font-bold leading-[28px] tracking-[-1.6px] text-[#1A202C]">Calendar</h1>
          <p className="text-[16px] font-normal leading-[18px] tracking-[-0.48px] text-[#767980]">
            Your sessions, requests and open slots for the week.
          </p>
        </header>

        <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
          <section className="flex min-w-0 flex-1 flex-col gap-5 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] p-5 md:p-[25px]">
            <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
              <div className="flex flex-col gap-[6px]">
                <h2 className="flex items-center gap-2 text-[20px] font-medium leading-[22px] tracking-[-0.05em] text-[#1A202C]">
                  <CalendarDays className="size-5 flex-none text-[#0054B4]" strokeWidth={1.5} aria-hidden="true" />
                  {formatWeekLabel(weekStart)}
                </h2>
                <p className="text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">
                  Times in {timeZone.replace(/_/g, " ")} ({timeZoneAbbreviation(timeZone, new Date(`${weekStart}T12:00:00Z`))})
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={secondaryButtonClass} onClick={() => setWeekStart(weekStartISO(todayISO))}>
                  Today
                </button>
                <button
                  type="button"
                  aria-label="Previous week"
                  className={iconButtonClass}
                  onClick={() => setWeekStart((current) => addDaysISO(current, -7))}
                >
                  <ChevronLeft className="size-4" strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  aria-label="Next week"
                  className={iconButtonClass}
                  onClick={() => setWeekStart((current) => addDaysISO(current, 7))}
                >
                  <ChevronRight className="size-4" strokeWidth={1.5} />
                </button>
                <Link to={ROUTES.AVAILABILITY} className={secondaryButtonClass}>
                  Edit availability
                </Link>
                <button type="button" className={primaryButtonClass} onClick={() => setAddOpen(true)}>
                  <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
                  Add session
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#484D56]" aria-live="polite">
                {loading ? "Loading…" : formatCalendarSummary(layout.summary)}
              </p>
              <CalendarLegend />
            </div>

            {loadFailed ? (
              <p className="rounded-[8px] bg-[#FDF1F1] px-[15px] py-3 text-[14px] leading-[18px] text-[#B42318]">
                Couldn't load your calendar. Please try again later.
              </p>
            ) : (
              <>
                <div className="hidden lg:block">
                  <WeekGrid {...viewProps} />
                </div>
                <div className="lg:hidden">
                  <DayList {...viewProps} />
                </div>
              </>
            )}
          </section>

          <div className="w-full xl:w-[320px] xl:flex-none">
            <RequestsPanel
              requests={requests}
              isLoading={requestsQuery.isLoading}
              timeZone={timeZone}
              now={now}
              respondingId={respondingId}
              onRespond={onRespond}
            />
          </div>
        </div>
      </div>

      <ManageAvailabilityModal
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) {
            refetchAvailabilities();
            queryClient.invalidateQueries({ queryKey: ["coach-calendar-occurrences"] });
          }
        }}
        coachId={coachId}
        // Occurrence periods carry weekly_slots; the modal reads them as-is.
        existingAvailabilities={(availabilities as unknown as CoachAvailability[] | null | undefined) ?? null}
        defaultScheduleMode="single"
      />
    </div>
  );
};

export default CoachCalendarPage;
