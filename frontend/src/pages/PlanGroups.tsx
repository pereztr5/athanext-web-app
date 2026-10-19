/**
 * Plan next week (Working Copy 4 planweek.js): day-by-day builder with usual sessions,
 * a short new-session form, New pill on drafts, then optional Go live sharing.
 * 1-on-1s created here are real individual open slots (not one-spot groups).
 */
import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Copy, Hash, Link2, Plus, Users, X } from "@/components/icons";
import { BrandPill } from "@/components/brand";
import { chatAPI } from "@/api";
import { isMissingRpc, scheduleAPI, type ScheduleSession } from "@/api/schedule";
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
  stepBtn,
  stepNum,
} from "@/components/schedule/plan/parts";
import { buildUsualList } from "@/components/schedule/plan/usualSessions";
import { SessionTagDialog, sessionTagOf } from "@/components/schedule/plan/SessionTag";
import { label, meta, primaryButton, secondaryButton, smallButton } from "@/components/schedule/styles";
import { PageHeader } from "@/components/ui/page-header";
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
  const { user, userProfile, userName } = useAuth();
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
  const [tagSession, setTagSession] = useState<ScheduleSession | null>(null);

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
      toast({ title: "Couldn't copy", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" }),
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
        return { offerId: null as string | null, posted: [] as string[], copied: false, tagsFailed: false };
      }

      const eightPm = zonedWallTimeToUtc(addDaysISO(from, -1), "20:00:00", timeZone) ?? new Date();
      const first = sessions.map(sessionStart).find((d) => d > new Date());
      const closesAt = eightPm > new Date() ? eightPm : first ?? new Date();
      const label = `Week of ${formatDayISO(from, { month: "short", day: "numeric" })} to ${formatDayISO(to, { day: "numeric" })}`;
      const common = {
        from,
        to,
        title: label,
        closesAt: closesAt.toISOString(),
        message: `Next week's group sessions are up. Tick the ones you're in for and pay once.${withLink ? " {link}" : ""}`,
        linkBase: `${window.location.origin}/offers/`,
      };
      const chosenIds = chosen.map((c) => c.conversationId);
      let offerId: string;
      let posted = channels.length
        ? chosen.map((c) => c.title || "group chat")
        : toMain && toChannel
          ? ["your group chat"]
          : [];
      if (!toChannel) {
        offerId = await scheduleAPI.publishGroups({ ...common, postToChannel: false });
        posted = [];
      } else if (!channels.length || (chosen.length === 1 && chosen[0].isMain)) {
        offerId = await scheduleAPI.publishGroups({ ...common, postToChannel: true });
      } else {
        try {
          offerId = await scheduleAPI.publishGroupsTo({ ...common, channelIds: chosenIds });
        } catch (error) {
          if (!isMissingRpc(error)) throw error;
          // Older servers publish the card, then a plain channel message carries the link.
          offerId = await scheduleAPI.publishGroups({ ...common, postToChannel: false });
          if (!user?.id) throw new Error("Couldn't post to the group chat.");
          const link = `${window.location.origin}/offers/${offerId}`;
          const body = common.message.replace("{link}", link);
          for (const id of chosenIds) {
            const sent = await chatAPI.sendMessage(id, user.id, body);
            if (sent.error) {
              throw new Error(sent.error.message || "Sessions are live. Couldn't post to the group chat.");
            }
          }
        }
      }

      const tags = Object.fromEntries(
        sessions
          .map((s) => [s.id, sessionTagOf(s.details)] as const)
          .filter((pair) => pair[1]),
      );
      let tagsFailed = false;
      if (Object.keys(tags).length) {
        try {
          await scheduleAPI.setOfferSessionTags(offerId, tags);
        } catch (error) {
          if (!isMissingRpc(error)) tagsFailed = true;
        }
      }

      let copied = false;
      if (withLink) {
        copied = await navigator.clipboard.writeText(`${window.location.origin}/offers/${offerId}`).then(() => true).catch(() => false);
      }
      return { offerId, posted, copied, tagsFailed };
    },
    onSuccess: (result) => {
      const where = result.posted.length ? `Posted to ${result.posted.join(" and ")}` : null;
      const linkNote = result.offerId && withLink ? (result.copied ? "Link copied" : "Couldn't copy the link") : null;
      const tagNote = result.tagsFailed ? "The tag didn't save on the week card." : null;
      toast({
        title: `${plural(drafts.length, "session")} sent`,
        description: [where, linkNote, tagNote].filter(Boolean).join(". ") || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
      setStep(1);
      navigate(ROUTES.SCHEDULE);
    },
    onError: (error: unknown) =>
      toast({ title: "Couldn't send", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" }),
  });

  if (!ready) return null;
  if (!isCoach) return <Navigate to={ROUTES.DASHBOARD} replace />;
  if (!coachId) return <Navigate to={ROUTES.SCHEDULE} replace />;

  const firstName = (userName || userProfile?.name || "Your coach").split(" ")[0];
  const tally = `${plural(sessions.length, "session")} on ${plural(daysWith, "day")} · ${plural(spots, "spot")}`;
  const missingTag = drafts.some((s) => !sessionTagOf(s.details));
  const noDest = !(toChannel || withLink);
  const canSend = drafts.length > 0 && !missingTag && !noDest;
  const sendWhere = [
    ...(channels.length ? chosen.map((c) => c.title || "group chat") : toChannel ? ["your group chat"] : []),
    ...(withLink ? ["a shareable link"] : []),
  ];
  const sendCaption = missingTag
    ? "Every session needs a name, time, tag and price before you send."
    : !drafts.length
      ? "Add a session or copy last week."
      : noDest
        ? "Pick a group chat or the shareable link."
        : `Goes to ${sendWhere.join(" and ")}. Families tick the ones they're in for and pay once.`;
  const sendChip = (on: boolean) =>
    cn(
      "inline-flex h-8 items-center gap-1.5 rounded-control border px-3 text-label-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
      on ? "border-primary bg-primary-50 text-primary" : "border-light-525 bg-light-300 text-dark hover:bg-light-200",
    );

  const sessionChip = (s: ScheduleSession) => {
    const start = sessionStart(s);
    const booked = bookedAthletes(s).length;
    const isOne = s.sessionType === "individual";
    const tag = sessionTagOf(s.details);
    return (
      <div key={s.id} className={chip(s.isDraft)}>
        <div className="flex items-start justify-between gap-1">
          <span className="text-label-xsm">{formatClock(start, timeZone)}</span>
          {s.isDraft ? (
            <button
              type="button"
              className="inline-flex size-5 flex-none items-center justify-center rounded-control text-dark-300 hover:bg-light-525 hover:text-dark [&>svg]:size-3"
              aria-label={`Remove ${s.sessionName}`}
              onClick={() => removeDraft.mutate(s.id)}
            >
              <X strokeWidth={2} />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className="text-left text-label-sm text-dark hover:text-primary"
          onClick={() => {
            if (s.isDraft && s.sessionType === "group") setEditing(s);
            else if (!s.isDraft) navigate(`${ROUTES.SCHEDULE}?day=${getZonedISODate(start, timeZone)}`);
          }}
        >
          {s.sessionName}
        </button>
        {s.isDraft ? (
          <button
            type="button"
            className="inline-flex w-fit max-w-full items-center gap-1 rounded-pill border border-secondary-300 bg-secondary-100 px-1.5 py-0.5 text-left text-label-xsm text-secondary-700"
            onClick={() => setTagSession(s)}
          >
            <Users className="size-3 flex-none" strokeWidth={1.5} aria-hidden="true" />
            <span className="truncate">{tag || "Add a tag"}</span>
          </button>
        ) : tag ? (
          <BrandPill tone="teal">{tag}</BrandPill>
        ) : null}
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
      <div className={cn(planWrap, "max-w-wrapper gap-4 md:gap-6")}>
        <PageHeader
          title={isNext ? "Plan next week" : `Plan the week of ${formatDayISO(from, { month: "short", day: "numeric" })}`}
          back={{ label: "My schedule", to: ROUTES.SCHEDULE }}
          subtitle={
            <>
              {formatDayISO(from, { month: "short", day: "numeric" })} to {formatDayISO(to, { month: "short", day: "numeric" })} · Week{" "}
              {weekNumber(from)}
            </>
          }
          actions={
          <div className="flex gap-2">
            <button type="button" className={navArrow} aria-label="Previous week" disabled={atStart} onClick={() => { setWeekStart((w) => addDaysISO(w, -7)); setStep(1); }}>
              <ChevronLeft strokeWidth={1.5} />
            </button>
            <button type="button" className={navArrow} aria-label="Next week" onClick={() => { setWeekStart((w) => addDaysISO(w, 7)); setStep(1); }}>
              <ChevronRight strokeWidth={1.5} />
            </button>
          </div>
          }
        />

        <div className="flex gap-2">
          {(
            [
              [1, "Build the week"],
              [2, "Send to"],
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
                <span className="text-subtitle text-dark">Build the week</span>
                <span className="text-body-m text-dark-300">{tally}</span>
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
                    <div key={d} className={cn(dayCol(list.length > 0), "md:min-h-0")}>
                      <div className="flex items-center gap-3">
                        <span className={dateTile}>
                          <small className={dateTileMonth}>{formatDayISO(d, { month: "short" })}</small>
                          <b className={dateTileNumber}>{formatDayISO(d, { day: "numeric" })}</b>
                          <em className={dateTileWeekday}>{formatDayISO(d, { weekday: "short" })}</em>
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="text-label-sm">{formatDayISO(d, { weekday: "short", month: "short", day: "numeric" })}</span>
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
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_317px] md:items-start">
            <section className={planCard}>
              <div className="flex flex-col gap-1.5">
                <span className="text-subtitle text-dark">Send to</span>
                <span className="text-body-m text-dark-300">
                  Families tick the sessions they want and pay once.
                </span>
              </div>
              <div className="flex flex-col gap-2.5 rounded-card border border-light-525 bg-light p-4">
                <span className="text-label-sm">Send to</span>
                <div className="flex flex-wrap gap-2">
                  {channels.length
                    ? channels.map((c) => {
                        const on = !offChannels.includes(c.conversationId);
                        return (
                          <button
                            key={c.conversationId}
                            type="button"
                            aria-pressed={on}
                            className={sendChip(on)}
                            onClick={() =>
                              setOffChannels((current) =>
                                on ? [...current, c.conversationId] : current.filter((id) => id !== c.conversationId),
                              )
                            }
                          >
                            {on ? <Check className="size-3.5" strokeWidth={1.5} aria-hidden="true" /> : <Hash className="size-3.5" strokeWidth={1.5} aria-hidden="true" />}
                            {c.title || "Group chat"}
                          </button>
                        );
                      })
                    : channelsQuery.isLoading
                      ? null
                      : (
                          <button type="button" aria-pressed={toMain} className={sendChip(toMain)} onClick={() => setToMain((v) => !v)}>
                            {toMain ? <Check className="size-3.5" strokeWidth={1.5} aria-hidden="true" /> : <Hash className="size-3.5" strokeWidth={1.5} aria-hidden="true" />}
                            Your group chat
                          </button>
                        )}
                  <button type="button" aria-pressed={withLink} className={sendChip(withLink)} onClick={() => setWithLink((v) => !v)}>
                    {withLink ? <Check className="size-3.5" strokeWidth={1.5} aria-hidden="true" /> : <Link2 className="size-3.5" strokeWidth={1.5} aria-hidden="true" />}
                    Shareable link
                  </button>
                </div>
              </div>
              <p className="text-center text-caption text-dark-300">{sendCaption}</p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" className={cn(secondaryButton, "h-11")} onClick={() => setStep(1)}>
                  Back to the week
                </button>
                <button
                  type="button"
                  className={cn(primaryButton, "h-11")}
                  disabled={!canSend || publish.isPending}
                  onClick={() => publish.mutate()}
                >
                  {publish.isPending ? "Sending…" : drafts.length ? `Send ${plural(drafts.length, "session")}` : "Nothing new to send"}
                </button>
              </div>
            </section>

            <section className={planCard}>
              <span className={label}>What families see</span>
              <div className="flex flex-col gap-2 rounded-card border border-light-525 bg-light p-3">
                <span className="text-label-sm">
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
                      className="flex items-center gap-2.5 rounded-control border border-light-525 bg-light-300 px-3 py-2.5"
                    >
                      <input type="checkbox" className="size-4 accent-primary" defaultChecked={k === 0} tabIndex={-1} readOnly />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-label-sm">
                          {s.sessionName}
                          {sessionTagOf(s.details) ? ` · ${sessionTagOf(s.details)}` : ""}
                        </span>
                        <span className={meta}>
                          {formatDayISO(getZonedISODate(start, timeZone), { weekday: "short", month: "short", day: "numeric" })},{" "}
                          {formatClock(start, timeZone)}
                          {!s.isDraft ? ` · ${plural(left, "spot")} left` : ""}
                        </span>
                      </span>
                      <span className="text-label-sm">{money(s.price)}</span>
                    </label>
                  );
                })}
                {sessions.length ? (
                  <span className={cn(primaryButton, "pointer-events-none h-11 w-full")} aria-hidden="true">
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

      <SessionTagDialog session={tagSession} onClose={() => setTagSession(null)} />
    </div>
  );
};

export default PlanGroupsPage;
