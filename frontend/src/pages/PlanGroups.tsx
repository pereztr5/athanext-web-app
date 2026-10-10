/**
 * Group week planner, "New schedule" (ATH-72): plan a week or a day of group sessions as
 * drafts, then publish them to the coach's group chats and a shareable link as one
 * pick-and-pay card. Families tick the sessions they want and pay once.
 */
import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Copy, Pencil, Plus, Users } from "lucide-react";
import { BrandPill } from "@/components/brand";
import { Switch } from "@/components/ui/switch";
import { chatAPI } from "@/api";
import { scheduleAPI, type ScheduleSession } from "@/api/schedule";
import { PlanSessionDialog } from "@/components/schedule/PlanSessionDialog";
import {
  addSession,
  dateTile,
  dateTileNumber,
  dateTileWeekday,
  navArrow,
  planRow,
  planWrap,
  rangeTitle,
  sendPanel,
  smallSwitch,
} from "@/components/schedule/plan/parts";
import { label, meta, pageTitle, primaryButton, secondaryButton, segButton, segGroup, smallButton } from "@/components/schedule/styles";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useToast } from "@/hooks/use-toast";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { getZonedISODate, zonedWallTimeToUtc } from "@/utils/dateHelpers";
import {
  addDaysISO,
  bookedAthletes,
  formatClock,
  formatDayISO,
  plural,
  sessionEnd,
  sessionStart,
  weekStartISO,
} from "@/utils/schedule";
import { formatInstantSpan, isoDateInZone } from "@/utils/viewerTime";
import { money } from "@/utils/booking";

type Mode = "week" | "day";

const weekNumber = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

const PlanGroupsPage = () => {
  const { isCoach, ready } = useRole();
  const { userProfile } = useAuth();
  const coachId = userProfile?.coach_id ?? null;
  const timeZone = useViewerTimeZone();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const todayISO = isoDateInZone(new Date(), timeZone);
  const [mode, setMode] = useState<Mode>("week");
  const [weekStart, setWeekStart] = useState(() => addDaysISO(weekStartISO(todayISO), 7));
  const [day, setDay] = useState(todayISO);
  // Channels the coach switched off; every channel is on by default.
  const [offChannels, setOffChannels] = useState<string[]>([]);
  const [toMain, setToMain] = useState(true);
  const [withLink, setWithLink] = useState(true);
  const [editing, setEditing] = useState<ScheduleSession | null>(null);
  const [adding, setAdding] = useState(false);

  const weekly = mode === "week";
  const from = weekly ? weekStart : day;
  const to = weekly ? addDaysISO(weekStart, 6) : day;
  const rangeDays = useMemo(() => {
    const out: string[] = [];
    for (let d = from; d <= to; d = addDaysISO(d, 1)) out.push(d);
    return out;
  }, [from, to]);
  const openDays = rangeDays.filter((d) => d >= todayISO);

  const scheduleQuery = useQuery({
    queryKey: ["coach-schedule", "plan", from, to],
    enabled: Boolean(coachId),
    queryFn: () => scheduleAPI.get(addDaysISO(from, -1), addDaysISO(to, 1)),
  });
  const channelsQuery = useQuery({
    queryKey: ["coach-channels", coachId, "owner"],
    enabled: Boolean(coachId),
    queryFn: () => chatAPI.getCoachChannels(coachId!),
    staleTime: 60_000,
  });
  const channels = useMemo(() => channelsQuery.data ?? [], [channelsQuery.data]);
  const chosen = channels.filter((c) => !offChannels.includes(c.conversationId));
  // No channel yet: the main one is created when the card is first posted.
  const toChannel = channels.length ? chosen.length > 0 : toMain;

  const groups = useMemo(
    () =>
      (scheduleQuery.data?.sessions ?? [])
        .filter((s) => s.sessionType === "group")
        .filter((s) => {
          const d = getZonedISODate(sessionStart(s), timeZone);
          return d >= from && d <= to;
        })
        .sort((a, b) => sessionStart(a).getTime() - sessionStart(b).getTime()),
    [scheduleQuery.data, from, to, timeZone]
  );
  const drafts = groups.filter((s) => s.isDraft);
  const live = groups.filter((s) => !s.isDraft);
  const spots = drafts.reduce((n, s) => n + s.capacity, 0);

  const sameMonth = formatDayISO(from, { month: "short" }) === formatDayISO(to, { month: "short" });
  const title = weekly
    ? `${formatDayISO(from, { month: "short", day: "numeric" })}–${formatDayISO(to, sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" })}`
    : formatDayISO(day, { weekday: "long" });
  const small = weekly
    ? `Week ${weekNumber(from)}`
    : `${day === todayISO ? "Today" : day === addDaysISO(todayISO, 1) ? "Tomorrow" : formatDayISO(day, { weekday: "short" })} · ${formatDayISO(day, { month: "short", day: "numeric" })}`;
  const previous = weekly ? "last week" : `last ${formatDayISO(day, { weekday: "long" })}`;
  const atStart = weekly ? weekStart <= weekStartISO(todayISO) : day <= todayISO;

  const copy = useMutation({
    mutationFn: () => scheduleAPI.copyGroups(from, to, 7),
    onSuccess: (count) => {
      toast({
        title: count ? `Copied ${plural(count, "session")}` : `Nothing new to copy from ${previous}`,
        description: count ? "They're drafts until you publish." : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
    },
    onError: (error: unknown) =>
      toast({ title: "Couldn't copy", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }),
  });

  const publish = useMutation({
    mutationFn: () => {
      // Picking closes at 8 pm the day before; if that has passed, when the first session starts.
      const eightPm = zonedWallTimeToUtc(addDaysISO(from, -1), "20:00:00", timeZone) ?? new Date();
      const first = groups.map(sessionStart).find((d) => d > new Date());
      const closesAt = eightPm > new Date() ? eightPm : first ?? new Date();
      const label = weekly ? `Week of ${title}` : formatDayISO(day, { weekday: "long", month: "long", day: "numeric" });
      const when = weekly ? "Next week's" : `${formatDayISO(day, { weekday: "long" })}'s`;
      const common = {
        from,
        to,
        title: label,
        closesAt: closesAt.toISOString(),
        message: `${when} group sessions are up. Tick the ones you're in for and pay once.${withLink ? " {link}" : ""}`,
        linkBase: `${window.location.origin}/offers/`,
      };
      // Nothing or just the main channel still goes through the older RPC.
      const mainOnly = !channels.length || (chosen.length === 1 && chosen[0].isMain);
      if (!toChannel || mainOnly) return scheduleAPI.publishGroups({ ...common, postToChannel: toChannel });
      return scheduleAPI.publishGroupsTo({ ...common, channelIds: chosen.map((c) => c.conversationId) });
    },
    onSuccess: async (offerId) => {
      const link = `${window.location.origin}/offers/${offerId}`;
      if (withLink) await navigator.clipboard.writeText(link).catch(() => undefined);
      const posted = channels.length ? chosen.map((c) => `#${c.title || "group chat"}`) : toMain ? ["your group chat"] : [];
      toast({
        title: `${plural(drafts.length, "session")} published${posted.length ? ` to ${posted.join(" and ")}` : ""}`,
        description: withLink ? "Link copied" : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
      navigate(ROUTES.SCHEDULE);
    },
    onError: (error: unknown) =>
      toast({ title: "Couldn't publish", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }),
  });

  if (!ready) return null;
  if (!isCoach) return <Navigate to={ROUTES.DASHBOARD} replace />;
  if (!coachId) return <Navigate to={ROUTES.SCHEDULE} replace />;

  const step = (direction: 1 | -1) => {
    if (weekly) setWeekStart((w) => addDaysISO(w, 7 * direction));
    else setDay((d) => addDaysISO(d, direction));
  };
  const canPublish = drafts.length > 0 && (toChannel || withLink);
  const publishLabel = weekly ? "Publish schedule" : day === todayISO ? "Publish today" : `Publish ${formatDayISO(day, { weekday: "long" })}`;

  const switchRow = (key: string, name: string, caption: string, checked: boolean, onChange: (on: boolean) => void) => (
    <div key={key} className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 flex-col gap-0.5">
        <b className="truncate text-[14px] font-medium leading-[18px]">{name}</b>
        <span className={meta}>{caption}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={name} className={smallSwitch} />
    </div>
  );

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className={planWrap}>
        <div className="-mb-1.5 flex items-center justify-between">
          <Link to={ROUTES.SCHEDULE} className="inline-flex items-center gap-1 text-[14px] font-medium text-[#767980] hover:text-[#1A202C]">
            <ChevronLeft className="size-4" strokeWidth={1.5} aria-hidden="true" />
            My Schedule
          </Link>
          {drafts.length ? <BrandPill tone="sunk">Draft</BrandPill> : null}
        </div>
        <h1 className={pageTitle}>New schedule</h1>

        <div className={segGroup} role="group" aria-label="Plan">
          <button type="button" className={segButton(weekly)} aria-pressed={weekly} onClick={() => setMode("week")}>
            Weekly schedule
          </button>
          <button type="button" className={segButton(!weekly)} aria-pressed={!weekly} onClick={() => setMode("day")}>
            Daily schedule
          </button>
        </div>

        <div className="flex items-center justify-between">
          <button type="button" className={navArrow} aria-label="Previous" disabled={atStart} onClick={() => step(-1)}>
            <ChevronLeft strokeWidth={1.5} />
          </button>
          <div className="flex flex-col items-center text-center">
            <span className={meta}>{small}</span>
            <span className={rangeTitle}>{title}</span>
          </div>
          <button type="button" className={navArrow} aria-label="Next" onClick={() => step(1)}>
            <ChevronRight strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" className={cn(secondaryButton, smallButton)} disabled={copy.isPending} onClick={() => copy.mutate()}>
            <Copy strokeWidth={1.5} aria-hidden="true" />
            Copy {previous}
          </button>
          <span className={meta}>
            {plural(drafts.length, "session")} · {plural(spots, "spot")}
            {live.length ? ` · ${live.length} already live` : ""}
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          {scheduleQuery.isLoading ? (
            <p className={meta}>Loading…</p>
          ) : groups.length ? (
            groups.map((s) => {
              const start = sessionStart(s);
              const d = getZonedISODate(start, timeZone);
              const booked = bookedAthletes(s).length;
              return (
                <div key={s.id} className={planRow(s.isDraft)}>
                  {weekly ? (
                    <span className={dateTile}>
                      <small className={dateTileWeekday}>{formatDayISO(d, { weekday: "short" })}</small>
                      <b className={dateTileNumber}>{formatDayISO(d, { day: "numeric" })}</b>
                    </span>
                  ) : (
                    <span className="flex w-[68px] flex-none flex-col">
                      <b className="text-[15px] font-semibold leading-[18px]">{formatClock(start, timeZone)}</b>
                      <small className={meta}>{s.durationMinutes} min</small>
                    </span>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-[14px] font-medium leading-[18px]">{s.sessionName}</span>
                    <span className={meta}>
                      {weekly ? `${formatInstantSpan(start, sessionEnd(s), timeZone)} · ` : ""}
                      {s.location === "online" ? "Video call" : s.place || "In person"}
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      <BrandPill tone="teal">
                        <Users strokeWidth={1.5} aria-hidden="true" />
                        Group
                      </BrandPill>
                      <BrandPill tone="sunk">{money(s.price)}</BrandPill>
                      <BrandPill tone="sunk">{plural(s.capacity, "spot")}</BrandPill>
                      {s.isDraft ? null : <BrandPill tone="green">Live · {booked} of {s.capacity}</BrandPill>}
                    </span>
                  </div>
                  {s.isDraft ? (
                    <button
                      type="button"
                      className="inline-flex size-[30px] flex-none items-center justify-center rounded-[8px] text-[#767980] hover:bg-[#F4F4EB] hover:text-[#1A202C] [&>svg]:size-4"
                      aria-label={`Edit ${s.sessionName}`}
                      onClick={() => setEditing(s)}
                    >
                      <Pencil strokeWidth={1.5} />
                    </button>
                  ) : null}
                </div>
              );
            })
          ) : (
            <p className="text-[14px] text-[#767980]">
              Nothing planned {weekly ? "this week" : "this day"} yet. Add a session or copy {previous}.
            </p>
          )}
        </div>

        <button type="button" disabled={!openDays.length} onClick={() => setAdding(true)} className={addSession}>
          <Plus strokeWidth={1.5} aria-hidden="true" />
          Add session
        </button>

        <section className={sendPanel}>
          <span className={label}>Send to</span>
          {channels.length
            ? channels.map((c) =>
                switchRow(
                  c.conversationId,
                  `#${c.title || "group chat"}`,
                  `Group chat · ${plural(c.memberCount, "family", "families")}`,
                  !offChannels.includes(c.conversationId),
                  (on) =>
                    setOffChannels((current) =>
                      on ? current.filter((id) => id !== c.conversationId) : [...current, c.conversationId]
                    )
                )
              )
            : channelsQuery.isLoading
              ? null
              : switchRow("main", "#your group chat", "Group chat · starts when you post", toMain, setToMain)}
          {switchRow("link", "Shareable link", "For WhatsApp, Instagram or email", withLink, setWithLink)}
          <button type="button" className={cn(primaryButton, "h-[48px] w-full")} disabled={!canPublish || publish.isPending} onClick={() => publish.mutate()}>
            {publish.isPending ? "Publishing…" : publishLabel}
          </button>
        </section>
      </div>

      {scheduleQuery.data ? (
        <PlanSessionDialog
          open={adding || Boolean(editing)}
          onOpenChange={(open) => {
            if (!open) {
              setAdding(false);
              setEditing(null);
            }
          }}
          session={editing}
          days={openDays}
          defaultDay={openDays[0] ?? todayISO}
          dayMode={!weekly}
          timeZone={timeZone}
          rules={scheduleQuery.data.rules}
          busy={scheduleQuery.data.busy}
        />
      ) : null}
    </div>
  );
};

export default PlanGroupsPage;
