/**
 * Schedule settings (Working Copy 4): weekly hours, locations, time off, booking rules and
 * Google Calendar sync.
 */
import { useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { scheduleAPI } from "@/api/schedule";
import { scheduleSettingsAPI } from "@/api/scheduleSettings";
import { BookingRulesCard, type RulesView } from "@/components/schedule/settings/BookingRulesCard";
import { CalendarSyncCard } from "@/components/schedule/settings/CalendarSyncCard";
import { LocationsCard } from "@/components/schedule/settings/LocationsCard";
import { TimeOffCard } from "@/components/schedule/settings/TimeOffCard";
import { WeeklyHoursCard } from "@/components/schedule/settings/WeeklyHoursCard";
import { pageTitle, textButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { addDaysISO } from "@/utils/schedule";
import { isoDateInZone } from "@/utils/viewerTime";

const ScheduleSettingsPage = () => {
  const { isCoach, ready } = useRole();
  const { userProfile } = useAuth();
  const coachId = userProfile?.coach_id ?? null;
  const timeZone = useViewerTimeZone();
  const today = isoDateInZone(new Date(), timeZone);
  const to = addDaysISO(today, 62);

  useEffect(() => {
    if (window.location.hash !== "#weekly-hours") return;
    const id = window.setTimeout(() => {
      document.getElementById("weekly-hours")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    return () => window.clearTimeout(id);
  }, []);

  // Calendar status (and a fallback for rules and days off) come from My Schedule's read.
  const scheduleQuery = useQuery({
    queryKey: ["coach-schedule", today, to],
    queryFn: () => scheduleAPI.get(today, to),
    enabled: Boolean(coachId),
  });
  const settingsQuery = useQuery({
    queryKey: ["schedule-settings"],
    queryFn: () => scheduleSettingsAPI.get(),
    enabled: Boolean(coachId),
    retry: false,
  });

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#EAEADF] border-t-[#0054B4]" />
      </div>
    );
  }
  if (!isCoach) return <Navigate to={ROUTES.DASHBOARD} replace />;

  const settings = settingsQuery.data;
  const schedule = scheduleQuery.data;
  const rules: RulesView = {
    newFamilyBooking: settings?.newFamilyBooking ?? schedule?.rules.newFamilyBooking ?? "request",
    bookingWindowWeeks: settings?.bookingWindowWeeks ?? schedule?.rules.bookingWindowWeeks ?? 4,
    cancelNoticeHours: settings?.cancelNoticeHours ?? null,
    cancellationPolicy: settings?.cancellationPolicy ?? null,
    travelMiles: settings?.travelMiles ?? null,
    travelZip: settings?.travelZip ?? null,
    groupMin: settings?.groupMin ?? null,
    homeZip: settings?.homeZip ?? null,
  };
  const rulesLoading = settingsQuery.isLoading || (settingsQuery.isError && scheduleQuery.isLoading);
  const timeOff = settings?.timeOff ?? schedule?.timeOff ?? [];
  const timeOffLoading = settingsQuery.isLoading || (settingsQuery.isError && scheduleQuery.isLoading);

  return (
    <div className="px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-4 md:gap-6">
        <Link to={ROUTES.SCHEDULE} className={cn(textButton, "self-start text-[#767980] hover:text-[#1A202C] hover:no-underline")}>
          <ChevronLeft strokeWidth={1.5} aria-hidden="true" />
          My Schedule
        </Link>
        <header className="flex min-w-0 flex-col gap-[10px]">
          <h1 className={pageTitle}>Schedule settings</h1>
          <p className="text-[14px] leading-[18px] text-[#767980]">Weekly hours, locations, time off, booking rules and calendar sync.</p>
        </header>
        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4">
          <WeeklyHoursCard
            series={schedule?.series ?? []}
            today={today}
            hourlyRate={schedule?.rules.hourlyRate ?? null}
            locations={schedule?.rules.locations ?? []}
            loading={scheduleQuery.isLoading}
          />
          {coachId ? (
            <LocationsCard
              coachId={coachId}
              locations={schedule?.rules.locations ?? []}
              sessions={schedule?.sessions ?? []}
              today={today}
              loading={scheduleQuery.isLoading}
            />
          ) : null}
          <TimeOffCard days={timeOff} today={today} loading={timeOffLoading} />
          <BookingRulesCard rules={rules} loading={rulesLoading} />
          <CalendarSyncCard calendar={schedule?.calendar ?? null} loading={scheduleQuery.isLoading} />
        </div>
      </div>
    </div>
  );
};

export default ScheduleSettingsPage;
