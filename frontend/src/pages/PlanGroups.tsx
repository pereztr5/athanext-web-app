/**
 * Plan next week (Working Copy 4 planweek.js): day-by-day builder with usual sessions,
 * a short new-session form, New pill on drafts, then optional Go live sharing.
 * 1-on-1s created here are real individual open slots (not one-spot groups).
 */
import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Check, ChevronLeft, ChevronRight, Copy, Plus, X } from "lucide-react";
import { BrandPill } from "@/components/brand";
import { Switch } from "@/components/ui/switch";
import { chatAPI } from "@/api";
import { scheduleAPI, type ScheduleSession } from "@/api/schedule";
import { PlanSessionDialog } from "@/components/schedule/PlanSessionDialog";
import { AddPlanSessionSheet } from "@/components/schedule/plan/AddPlanSessionSheet";
import {
  addDay,
  chip,
  dateTile,
  dateTileMonth,
  dateTileNumber,
  dateTileWeekday,
  dayCol,
  dayStripDot,
  navArrow,
  planCard,
  planWrap,
  sendRow,
  smallSwitch,
  stepBtn,
  stepNum,
} from "@/components/schedule/plan/parts";
import { buildUsualList } from "@/components/schedule/plan/usualSessions";
import { label, meta, pageTitle, primaryButton, secondaryButton, smallButton } from "@/components/schedule/styles";
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
  sessionStart,
  weekStartISO,
} from "@/utils/schedule";
import { isoDateInZone } from "@/utils/viewerTime";
import { money } from "@/utils/booking";

const weekNumber = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

const dow = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

const PlanGroupsPage = () => {
  const { isCoach, ready } = useRole();
  const { userProfile, userName } = useAuth();
  const coachId = userProfile?.coach_id ?? null;
  const timeZone = useViewerTimeZone();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const todayISO = isoDateInZone(new Date(), timeZone);
  const nextMonday = addDaysISO(weekStartISO(todayISO), 7);
  const [weekStart, setWeekStart] = useState(nextMonday);
  const [step, setStep] = useState<1 | 2>(1);
  const [offChannels, setOffChannels] = useState<string[]>([]);
  const [toMain, setToMain] = useState(true);
  const [withLink, setWithLink] = useState(true);
  const [addDate, setAddDate] = useState<string | null>(null);
  const [editing, setEditing] = useState<ScheduleSession | null>(null);

  const from = weekStart;
  const to = addDaysISO(weekStart, 6);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(from, i)), [from]);
  const isNext = from === nextMonday;
  const atStart = weekStart <= weekStartISO(todayISO);

  const scheduleQuery = useQuery({
    queryKey: ["coach-schedule", "plan", from, to],
    enabled: Boolean(coachId),
    queryFn: () => scheduleAPI.get(addDaysISO(from, -28), addDaysISO(to, 1)),
  });
  const channelsQuery = useQuery({
    queryKey: ["coach-channels", coachId, "owner"],
    enabled: Boolean(coachId),
    queryFn: () => chatAPI.getCoachChannels(coachId!),
    staleTime: 60_000,
  });
  const channels = useMemo(() => channelsQuery.data ?? [], [channelsQuery.data]);
  const chosen = channels.filter((c) => !offChannels.includes(c.conversationId));
  const toChannel = channels.length ? chosen.length > 0 : toMain;
  const sharing = toChannel || withLink;

  const sessions = useMemo(
    () =>
      (scheduleQuery.data?.sessions ?? [])
        .filter((s) => {
          const d = getZonedISODate(sessionStart(s), timeZone);
          return d >= from && d <= to;
        })
        .sort((a, b) => sessionStart(a).getTime() - sessionStart(b).getTime()),
    [scheduleQuery.data, from, to, timeZone],
  );
  const drafts = sessions.filter((s) => s.isDraft);
  const spots = sessions.reduce((n, s) => n + s.capacity, 0);
  const daysWith = new Set(sessions.map((s) => getZonedISODate(sessionStart(s), timeZone))).size;

  const lastWeek = useMemo(() => {
    const a = addDaysISO(from, -7);
    const b = addDaysISO(to, -7);
    return (scheduleQuery.data?.sessions ?? []).filter((s) => {
      if (s.isDraft) return false;
      const d = getZonedISODate(sessionStart(s), timeZone);
      return d >= a && d <= b && s.sessionType === "group";
    });
  }, [scheduleQuery.data, from, to, timeZone]);

  const missingFromLast = lastWeek.filter((g) => {
    const gDay = getZonedISODate(sessionStart(g), timeZone);
    return !sessions.some((x) => {
      const xd = getZonedISODate(sessionStart(x), timeZone);
      return dow(xd) === dow(gDay) && x.startTime === g.startTime;
    });
  });

  const usual = useMemo(
    () =>
      coachId
        ? buildUsualList({
            coachId,
            sessions: scheduleQuery.data?.sessions ?? [],
            todayISO,
            nextMonday: from,
            timeZone,
          })
        : [],
    [coachId, scheduleQuery.data, todayISO, from, timeZone],
  );

  const copy = useMutation({
    mutationFn: () => scheduleAPI.copyGroups(from, to, 7),
    onSuccess: (count) => {
      toast({
        title: count ? `Copied ${plural(count, "session")}` : "Nothing new to copy from last week",
        description: count ? "They're drafts until you publish." : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
    },
    onError: (error: unknown) =>
      toast({ title: "Couldn't copy", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }),
  });

  const removeDraft = useMutation({
    mutationFn: (id: string) => scheduleAPI.removeSession(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coach-schedule"] }),
    onError: (error: unknown) =>
      toast({ title: "Couldn't remove", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" }),
  });

  const publishOneOnOnes = async (list: ScheduleSession[]) => {
    for (const s of list) {
      await scheduleAPI.removeSession(s.id);
      await scheduleAPI.createSessions({
        sessionType: s.sessionType,
        visibility: s.visibility,
        times: [{ date: s.date, start: s.startTime.slice(0, 5) }],
        repeat: "none",
        durationMinutes: s.durationMinutes,
        sessionName: s.sessionName,
        price: s.price,
        capacity: s.capacity,
        location: s.location,
        place: s.place,
        pillar: s.pillar,
        position: s.position,
        details: s.details,
        isDraft: false,
      });
    }
  };

  const publish = useMutation({
    mutationFn: async () => {
      const groupish = drafts.filter((s) => s.sessionType === "group");
      const ones = drafts.filter((s) => s.sessionType === "individual");
      const liveGroups = sessions.filter((s) => !s.isDraft && s.sessionType === "group");
      // Offer insert needs group occurrence ids; 1-on-1-only weeks clear drafts without an empty offer.
      if (!groupish.length && !liveGroups.length) {
        await publishOneOnOnes(ones);
        return { offerId: null as string | null, shared: false };
      }

      const eightPm = zonedWallTimeToUtc(addDaysISO(from, -1), "20:00:00", timeZone) ?? new Date();
      const first = sessions.map(sessionStart).find((d) => d > new Date());
      const closesAt = eightPm > new Date() ? eightPm : first ?? new Date();
      const label = `Week of ${formatDayISO(from, { month: "short", day: "numeric" })}–${formatDayISO(to, { day: "numeric" })}`;
      const common = {
        from,
        to,
        title: label,
        closesAt: closesAt.toISOString(),
        message: sharing
          ? `Next week's group sessions are up. Tick the ones you're in for and pay once.${withLink ? " {link}" : ""}`
          : "Next week's sessions are live.",
        linkBase: `${window.location.origin}/offers/`,
      };
      const mainOnly = !channels.length || (chosen.length === 1 && chosen[0].isMain);
      let offerId: string;
      if (!toChannel) {
        offerId = await scheduleAPI.publishGroups({ ...common, postToChannel: false });
      } else if (mainOnly) {
        offerId = await scheduleAPI.publishGroups({ ...common, postToChannel: true });
      } else {
        offerId = await scheduleAPI.publishGroupsTo({ ...common, channelIds: chosen.map((c) => c.conversationId) });
      }
      return { offerId, shared: sharing };
    },
    onSuccess: async (result) => {
      if (result.offerId && withLink) {
        await navigator.clipboard.writeText(`${window.location.origin}/offers/${result.offerId}`).catch(() => undefined);
      }
      const posted = channels.length ? chosen.map((c) => `#${c.title || "group chat"}`) : toMain && toChannel ? ["your group chat"] : [];
      toast({
        title: result.shared
          ? `${plural(drafts.length, "session")} published${posted.length ? ` to ${posted.join(" and ")}` : ""}`
          : `${plural(drafts.length, "session")} live. Families can book them now`,
        description: result.offerId && withLink ? "Link copied" : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
      setStep(1);
      navigate(ROUTES.SCHEDULE);
    },
    onError: (error: unknown) =>
      toast({ title: "Couldn't publish", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }),
  });

  if (!ready) return null;
  if (!isCoach) return <Navigate to={ROUTES.DASHBOARD} replace />;
  if (!coachId) return <Navigate to={ROUTES.SCHEDULE} replace />;

  const firstName = (userName || userProfile?.name || "Your coach").split(" ")[0];
  const tally = `${plural(sessions.length, "session")} on ${plural(daysWith, "day")} · ${plural(spots, "spot")}`;
  const draftSpots = drafts.reduce((n, s) => n + s.capacity, 0);
  const shareTargets = [
    toChannel ? (channels.length ? plural(chosen.length || (toMain ? 1 : 0), "group chat") : "your group chat") : "",
    withLink ? "your link" : "",
  ].filter(Boolean);
  const sumLine = `${plural(drafts.length, "session")} go live · ${plural(draftSpots, "spot")}${
    shareTargets.length ? ` · shared to ${shareTargets.join(" and ")}` : " · nothing is posted"
  }`;

  const switchRow = (key: string, name: string, caption: string, checked: boolean, onChange: (on: boolean) => void) => (
    <div key={key} className={sendRow}>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <b className="truncate text-[14px] font-medium leading-[18px]">{name}</b>
        <span className={meta}>{caption}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={name} className={smallSwitch} />
    </div>
  );

  const sessionChip = (s: ScheduleSession) => {
    const start = sessionStart(s);
    const booked = bookedAthletes(s).length;
    const isOne = s.sessionType === "individual";
    return (
      <div key={s.id} className={chip(s.isDraft)}>
        <div className="flex items-start justify-between gap-1">
          <span className="text-[12px] font-medium leading-[14px]">{formatClock(start, timeZone)}</span>
          {s.isDraft ? (
            <button
              type="button"
              className="inline-flex size-5 flex-none items-center justify-center rounded text-[#767980] hover:bg-[#EAEADF] hover:text-[#1A202C] [&>svg]:size-3"
              aria-label={`Remove ${s.sessionName}`}
              onClick={() => removeDraft.mutate(s.id)}
            >
              <X strokeWidth={2} />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className="text-left text-[14px] font-medium leading-4 text-[#1A202C] hover:text-[#0054B4]"
          onClick={() => {
            if (s.isDraft && s.sessionType === "group") setEditing(s);
            else if (!s.isDraft) navigate(`${ROUTES.SCHEDULE}?day=${getZonedISODate(start, timeZone)}`);
          }}
        >
          {s.sessionName}
        </button>
        <span className={meta}>
          {isOne ? "1-on-1 slot" : plural(s.capacity, "spot")} · {money(s.price)}
        </span>
        {s.isDraft ? (
          <BrandPill tone="blue">New</BrandPill>
        ) : (
          <BrandPill tone="green">
            {booked} of {s.capacity} booked
          </BrandPill>
        )}
      </div>
    );
  };

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className={planWrap}>
        <Link to={ROUTES.SCHEDULE} className="inline-flex items-center gap-1 self-start text-[14px] font-medium text-[#767980] hover:text-[#1A202C]">
          <ChevronLeft className="size-4" strokeWidth={1.5} aria-hidden="true" />
          My Schedule
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <h1 className={pageTitle}>{isNext ? "Plan next week" : `Plan the week of ${formatDayISO(from, { month: "short", day: "numeric" })}`}</h1>
            <span className="text-[14px] text-[#767980]">
              {formatDayISO(from, { month: "short", day: "numeric" })} to {formatDayISO(to, { month: "short", day: "numeric" })} · Week{" "}
              {weekNumber(from)}
            </span>
          </div>
          <div className="flex gap-2">
            <button type="button" className={navArrow} aria-label="Previous week" disabled={atStart} onClick={() => { setWeekStart((w) => addDaysISO(w, -7)); setStep(1); }}>
              <ChevronLeft strokeWidth={1.5} />
            </button>
            <button type="button" className={navArrow} aria-label="Next week" onClick={() => { setWeekStart((w) => addDaysISO(w, 7)); setStep(1); }}>
              <ChevronRight strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          {(
            [
              [1, "Build the week"],
              [2, "Go live"],
            ] as const
          ).map(([n, t]) => {
            const state = step === n ? "on" : step > n ? "done" : "idle";
            return (
              <button
                key={n}
                type="button"
                className={stepBtn(state)}
                disabled={n === 2 && !drafts.length}
                onClick={() => setStep(n)}
              >
                <span className={stepNum(state)}>{step > n ? <Check className="size-3" strokeWidth={2.5} /> : n}</span>
                <span className="hidden md:inline">{t}</span>
              </button>
            );
          })}
        </div>

        {step === 1 ? (
          <section className={planCard}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-[16px] font-medium tracking-[-0.05em]">Build the week</span>
                <span className="text-[14px] text-[#767980]">{tally}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="hidden gap-1 md:flex" aria-hidden="true">
                  {days.map((d) => (
                    <i key={d} className={dayStripDot(sessions.some((s) => getZonedISODate(sessionStart(s), timeZone) === d))} />
                  ))}
                </span>
                {missingFromLast.length ? (
                  <button type="button" className={cn(secondaryButton, smallButton)} disabled={copy.isPending} onClick={() => copy.mutate()}>
                    <Copy strokeWidth={1.5} aria-hidden="true" />
                    Copy last week
                  </button>
                ) : null}
              </div>
            </div>

            {scheduleQuery.isLoading ? (
              <p className={meta}>Loading…</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-7 md:items-start">
                {days.map((d) => {
                  const list = sessions.filter((s) => getZonedISODate(sessionStart(s), timeZone) === d);
                  const past = d < todayISO;
                  return (
                    <div key={d} className={dayCol(list.length > 0)}>
                      <div className="flex items-center justify-center gap-3 md:justify-center">
                        <span className={dateTile}>
                          <small className={dateTileMonth}>{formatDayISO(d, { month: "short" })}</small>
                          <b className={dateTileNumber}>{formatDayISO(d, { day: "numeric" })}</b>
                          <em className={dateTileWeekday}>{formatDayISO(d, { weekday: "short" })}</em>
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col md:hidden">
                          <span className="text-[14px] font-medium">{formatDayISO(d, { weekday: "short", month: "short", day: "numeric" })}</span>
                          <span className={meta}>{list.length ? plural(list.length, "session") : "Nothing yet"}</span>
                        </span>
                      </div>
                      <div className="flex flex-col gap-1.5">{list.map(sessionChip)}</div>
                      {!past ? (
                        <button type="button" className={addDay} onClick={() => setAddDate(d)}>
                          <Plus strokeWidth={2} aria-hidden="true" />
                          Add
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end">
              <button type="button" className={cn(primaryButton, "h-11")} disabled={!drafts.length} onClick={() => setStep(2)}>
                Continue to sharing
              </button>
            </div>
          </section>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_340px] md:items-start">
            <section className={planCard}>
              <div className="flex flex-col gap-1.5">
                <span className="text-[16px] font-medium tracking-[-0.05em]">Go live</span>
                <span className="text-[14px] text-[#767980]">
                  {plural(drafts.length, "new session")} go on your calendar and profile, where families can book them. Sharing is optional.
                </span>
              </div>
              <span className={label}>Share it too (optional)</span>
              <div>
                {channels.length
                  ? channels.map((c) =>
                      switchRow(
                        c.conversationId,
                        `#${c.title || "group chat"}`,
                        `Group chat · ${plural(c.memberCount, "family", "families")}`,
                        !offChannels.includes(c.conversationId),
                        (on) =>
                          setOffChannels((current) =>
                            on ? current.filter((id) => id !== c.conversationId) : [...current, c.conversationId],
                          ),
                      ),
                    )
                  : channelsQuery.isLoading
                    ? null
                    : switchRow("main", "#your group chat", "Group chat · starts when you post", toMain, setToMain)}
                {switchRow("link", "Shareable link", "For WhatsApp, Instagram or email", withLink, setWithLink)}
              </div>
              <div className="flex items-center gap-2.5 rounded-[8px] bg-[#F1F1E6] px-3 py-3 text-[14px] text-[#484D56]">
                <CalendarCheck className="size-4 flex-none text-[#0054B4]" strokeWidth={1.5} aria-hidden="true" />
                <span className="grow">{sumLine}</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" className={cn(secondaryButton, "h-11")} onClick={() => setStep(1)}>
                  Back to the week
                </button>
                <button
                  type="button"
                  className={cn(primaryButton, "h-11")}
                  disabled={!drafts.length || publish.isPending}
                  onClick={() => publish.mutate()}
                >
                  {publish.isPending ? "Publishing…" : sharing ? "Publish and share" : "Publish"}
                </button>
              </div>
            </section>

            <section className={planCard}>
              <span className={label}>What families see</span>
              <div className="flex flex-col gap-2 rounded-[8px] bg-[#F1F1E6] p-3">
                <span className="text-[14px] font-medium">
                  {firstName}&apos;s sessions, {formatDayISO(from, { month: "short", day: "numeric" })} to{" "}
                  {formatDayISO(to, { month: "short", day: "numeric" })}
                </span>
                <span className={meta}>Tick the ones you want and pay once.</span>
                {sessions.map((s, k) => {
                  const start = sessionStart(s);
                  const left = Math.max(0, s.capacity - bookedAthletes(s).length);
                  return (
                    <label
                      key={s.id}
                      className="flex items-center gap-2.5 rounded-[8px] border border-[#EAEADF] bg-[#FDFDFC] px-3 py-2.5"
                    >
                      <input type="checkbox" className="size-4 accent-[#0054B4]" defaultChecked={k === 0} tabIndex={-1} readOnly />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-[14px] font-medium">{s.sessionName}</span>
                        <span className={meta}>
                          {formatDayISO(getZonedISODate(start, timeZone), { weekday: "short", month: "short", day: "numeric" })},{" "}
                          {formatClock(start, timeZone)}
                          {!s.isDraft ? ` · ${plural(left, "spot")} left` : ""}
                        </span>
                      </span>
                      <span className="text-[14px] font-medium">{money(s.price)}</span>
                    </label>
                  );
                })}
                {sessions.length ? (
                  <span className={cn(primaryButton, "pointer-events-none h-11 w-full opacity-90")} aria-hidden="true">
                    Pay {money(sessions[0].price)} for 1 session
                  </span>
                ) : null}
              </div>
            </section>
          </div>
        )}
      </div>

      {addDate && scheduleQuery.data ? (
        <AddPlanSessionSheet
          open={Boolean(addDate)}
          onOpenChange={(o) => !o && setAddDate(null)}
          date={addDate}
          timeZone={timeZone}
          rules={scheduleQuery.data.rules}
          coachId={coachId}
          usual={usual}
        />
      ) : null}

      {scheduleQuery.data ? (
        <PlanSessionDialog
          open={Boolean(editing)}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          session={editing}
          days={days.filter((d) => d >= todayISO)}
          defaultDay={editing ? getZonedISODate(sessionStart(editing), timeZone) : days[0]}
          dayMode={false}
          timeZone={timeZone}
          rules={scheduleQuery.data.rules}
          busy={scheduleQuery.data.busy}
        />
      ) : null}
    </div>
  );
};

export default PlanGroupsPage;
