/**
 * Coach Home (ATH-76, Working Copy 4): today and this week first, in one wrapper column.
 * Money strip, intro calls, Today, This week, and a Plan next week card from Thursday to Sunday.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, CalendarDays, Check, ChevronRight, CircleCheck, Inbox, MessageSquareText, Pencil, Plus, Rocket, TrendingDown, TrendingUp, User, Users } from "@/components/icons";
import { BrandPill } from "@/components/brand";
import { homeAPI } from "@/api/home";
import { payoutsAPI } from "@/api/payouts";
import { periodTotals } from "@/utils/home";
import { useCoachDetails } from "@/hooks/useCoachDetails";
import { scheduleAPI, type ScheduleSession } from "@/api/schedule";
import { rosterAPI } from "@/api/roster";
import { Banner } from "@/components/ui/banner";
import { PageHeader } from "@/components/ui/page-header";
import { card, primaryButton, secondaryButton, segButton, segGroup, smallButton, textButton } from "@/components/schedule/styles";
import { invoicesAPI } from "@/api/invoices";
import { useToast } from "@/hooks/use-toast";
import { IntroCallsHomeCard } from "@/components/intro-calls";
import { PaymentsToConfirm } from "@/components/home/PaymentsToConfirm";
import { WeekOffDialog } from "@/components/home/WeekOffDialog";
import { CreateSessionSheet } from "@/components/schedule/CreateSessionSheet";
import { useAuth } from "@/contexts/AuthContext";
import { useCoachBillingAccess } from "@/hooks/useCoachBillingAccess";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { getZonedISODate } from "@/utils/dateHelpers";
import {
  addDaysISO,
  bookedAthletes,
  formatClock,
  formatDayISO,
  layoutDays,
  plural,
  requestsFor,
  sessionEnd,
  sessionStart,
  weekStartISO,
} from "@/utils/schedule";
import { isoDateInZone } from "@/utils/viewerTime";

const RANGES: [number, string, string][] = [
  [1, "Today", "today"],
  [7, "7 days", "last 7 days"],
  [30, "30 days", "last 30 days"],
  [60, "60 days", "last 60 days"],
];

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

const Sparkline = ({ values }: { values: number[] }) => {
  const W = 120;
  const H = 36;
  const max = Math.max(1, ...values);
  const pts = values
    .map((v, i) => `${((i * W) / Math.max(1, values.length - 1)).toFixed(1)},${(H - 3 - (v / max) * (H - 6)).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true" className="flex-none">
      <polygon points={`0,${H} ${pts} ${W},${H}`} className="fill-primary-50" />
      <polyline points={pts} fill="none" className="stroke-primary" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

const paidText = (s: ScheduleSession) => {
  const booked = bookedAthletes(s);
  const paid = booked.filter((b) => b.paymentStatus === "paid").length;
  if (s.sessionType === "group") return `${paid} of ${booked.length} paid`;
  const b = booked[0];
  if (!b) return "Not booked";
  if (b.paymentStatus === "paid") return "Paid in app";
  return b.status === "pending_payment" ? "Awaiting payment" : "Not paid yet";
};

// Working Copy type scale for Home.
const eyebrow = "text-label-xsm text-dark-300";
const h2 = "text-card-title text-dark";
const h3 = "text-subtitle";
const cap = "text-caption text-dark-300";
const dayCard = card;

export const CoachHome = () => {
  const { userName, userProfile } = useAuth();
  const { toast } = useToast();
  const billing = useCoachBillingAccess();
  const { coach: me } = useCoachDetails(userProfile?.coach_id ?? undefined);
  const paysDirect = (me as { pay_mode?: string } | undefined)?.pay_mode === "self";
  const payouts = useQuery({ queryKey: ["coach-payouts"], queryFn: () => payoutsAPI.summary(), enabled: Boolean(me) && !paysDirect, retry: false });
  const nextPayout = payouts.data?.payouts
    .filter((p) => p.status === "pending" || p.status === "in_transit")
    .sort((a, b) => a.arrival.localeCompare(b.arrival))[0];
  const navigate = useNavigate();
  const timeZone = useViewerTimeZone();
  const now = new Date();
  const todayISO = isoDateInZone(now, timeZone);
  const [range, setRange] = useState(7);
  const nextMonday = weekStartISO(addDaysISO(todayISO, 7));
  const [reminding, setReminding] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [weekOffOpen, setWeekOffOpen] = useState(false);
  const coachId = userProfile?.coach_id ?? null;
  const checkKey = coachId ? `athanext-week-off:${coachId}:${nextMonday}` : null;
  const [checkDismissed, setCheckDismissed] = useState(false);
  useEffect(() => {
    setCheckDismissed(checkKey ? window.localStorage.getItem(checkKey) === "1" : false);
  }, [checkKey]);

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(todayISO, i)), [todayISO]);
  const scheduleQuery = useQuery({
    queryKey: ["coach-schedule", "home", todayISO],
    queryFn: () => scheduleAPI.get(addDaysISO(todayISO, -1), addDaysISO(nextMonday, 7)),
  });
  const earningsQuery = useQuery({ queryKey: ["coach-earnings", range], queryFn: () => homeAPI.earnings(range) });
  const feedbackQuery = useQuery({ queryKey: ["feedback-due"], queryFn: () => homeAPI.feedbackDue() });
  const rosterQuery = useQuery({ queryKey: ["coach-roster"], queryFn: () => rosterAPI.roster() });

  const layout = (dates: string[]) =>
    layoutDays({
      dates,
      sessions: scheduleQuery.data?.sessions ?? [],
      busy: scheduleQuery.data?.busy ?? [],
      timeOff: scheduleQuery.data?.timeOff ?? [],
      timeZone,
      now,
    });
  // `now` changes every render; the minute it was computed is enough here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const days = useMemo(() => layout(weekDates), [weekDates, scheduleQuery.data, timeZone]);

  const firstName = (userName || userProfile?.name || "").split(" ")[0] || "Coach";
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(now));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const today = days[0];
  const todaySessions = (today?.items ?? []).filter((i) => i.session && (i.kind === "booked" || i.kind === "group")).map((i) => i.session!);
  const nextSession = todaySessions.find((s) => sessionStart(s) > now);
  const upcoming = days
    .flatMap((d) => d.items)
    .filter((i) => i.session && (i.kind === "booked" || i.kind === "group") && sessionStart(i.session) > now)
    .map((i) => i.session!)[0];
  const feedbackDue = feedbackQuery.data ?? [];
  const feedbackIds = new Set(feedbackDue.map((f) => f.id));
  const requests = (scheduleQuery.data?.sessions ?? []).reduce((n, s) => n + requestsFor(s).length, 0);
  const isEmpty = rosterQuery.data && !rosterQuery.data.length && scheduleQuery.data && !scheduleQuery.data.sessions.length;

  const totals = earningsQuery.data ? periodTotals(earningsQuery.data.days, range) : null;
  const sparkValues = earningsQuery.data ? earningsQuery.data.days.slice(range === 1 ? -7 : -range).map((d) => d.amount) : [];
  const rangeLabel = RANGES.find(([d]) => d === range)?.[2] ?? "";

  // "N overdue · remind": one reminder to every overdue family (3 at most per invoice).
  const remindOverdue = async () => {
    setReminding(true);
    try {
      const { invoices } = await invoicesAPI.payments();
      const overdue = invoices.filter((i) => i.status === "open" && i.due < todayISO && i.reminders < 3);
      if (!overdue.length) {
        toast({ title: "Every overdue family already has 3 reminders" });
        return;
      }
      await Promise.all(overdue.map((i) => invoicesAPI.remind(i.id)));
      toast({ title: `Reminders sent to ${plural(overdue.length, "family", "families")}` });
    } catch {
      toast({ title: "Couldn't send reminders", description: "Try again from Payments.", variant: "destructive" });
    } finally {
      setReminding(false);
    }
  };

  const booked = days.reduce((n, d) => n + d.items.filter((i) => i.kind === "booked" || i.kind === "group").length, 0);
  const open = days.reduce((n, d) => n + d.items.filter((i) => i.kind === "open").length, 0);
  const createSession = () => setCreateOpen(true);
  const openDay = (date: string) => navigate(`${ROUTES.SCHEDULE}?day=${date}`);
  const titleOf = (s: ScheduleSession) => (s.sessionType === "group" ? s.sessionName : bookedAthletes(s)[0]?.athleteName ?? "Open slot");
  const hasBio = Boolean((me as { bio?: string | null } | undefined)?.bio);

  // Plan next week card: Thursday (4) through Sunday (0).
  // Sunday check-in: Saturday and Sunday, until the coach answers for that next week.
  const weekday = new Date(`${todayISO}T12:00:00`).getDay();
  const showCheckIn = (weekday === 6 || weekday === 0) && !checkDismissed;
  const nextWeekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(nextMonday, i)), [nextMonday]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nextWeekDays = useMemo(() => layout(nextWeekDates), [nextWeekDates, scheduleQuery.data, timeZone]);
  const dismissCheckIn = () => {
    if (checkKey) window.localStorage.setItem(checkKey, "1");
    setCheckDismissed(true);
  };
  const showPlanCard = [4, 5, 6, 0].includes(weekday);
  const nextWeekEnd = addDaysISO(nextMonday, 6);
  const nextWeekSessions = (scheduleQuery.data?.sessions ?? []).filter((s) => {
    const d = getZonedISODate(sessionStart(s), timeZone);
    return d >= nextMonday && d <= nextWeekEnd;
  });
  const nextDrafts = nextWeekSessions.filter((s) => s.isDraft);
  const nextLive = nextWeekSessions.filter((s) => !s.isDraft);
  const thisWeekGroups = (scheduleQuery.data?.sessions ?? []).filter((s) => {
    if (s.isDraft || s.sessionType !== "group") return false;
    const d = getZonedISODate(sessionStart(s), timeZone);
    return d >= weekStartISO(todayISO) && d < nextMonday;
  });
  const gap = thisWeekGroups.filter((g) => {
    const gDow = new Date(`${getZonedISODate(sessionStart(g), timeZone)}T12:00:00`).getDay();
    return !nextWeekSessions.some((x) => {
      const xDow = new Date(`${getZonedISODate(sessionStart(x), timeZone)}T12:00:00`).getDay();
      return xDow === gDow && x.startTime === g.startTime;
    });
  }).length;
  const nextSpots = nextWeekSessions.reduce((n, s) => n + s.capacity, 0);
  const nextBooked = nextWeekSessions.reduce((n, s) => n + bookedAthletes(s).length, 0);
  const nextPlanned = nextWeekSessions.length > 0 && !nextDrafts.length && !gap;

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-wrapper flex-col gap-4 md:gap-6">
        <PageHeader
          title={`${greeting}, ${firstName}`}
          subtitle={formatDayISO(todayISO, { weekday: "long", month: "long", day: "numeric" })}
          actions={
            <>
              <Link to={`${ROUTES.PROFILE}?mode=edit`} className={secondaryButton}>
                <Pencil strokeWidth={1.5} aria-hidden="true" />
                Edit profile
              </Link>
              <button type="button" className={primaryButton} onClick={createSession}>
                <Plus strokeWidth={1.5} aria-hidden="true" />
                Create session
              </button>
            </>
          }
        />

        {billing.locked ? (
          <section className={cn(card, "border-error-300 bg-error-50")}>
            <div className="flex flex-col gap-3 px-1 py-1">
              <div className="flex flex-col gap-1">
                <span className={cn(h3, "text-error-700")}>Subscribe to keep coaching</span>
                <p className="text-body-m text-dark">
                  Your free 30 days ended. Coach tools are locked until you subscribe at ${billing.priceMonthly}/month.
                  Families can still see your profile and book you.
                </p>
              </div>
              <Link to={`${ROUTES.SETTINGS}?tab=plan`} className={cn(primaryButton, "self-start")}>
                Open plan · ${billing.priceMonthly}/mo
              </Link>
            </div>
          </section>
        ) : null}

        {billing.trialActive && !billing.subscribed ? (
          <section className={card} aria-label="Coach plan">
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className={eyebrow}>Coach plan</span>
                  <span className={cn(h3, "text-dark")}>
                    {billing.daysLeft === 1 ? "1 day left free" : `${billing.daysLeft} days left free`}
                  </span>
                  <p className={cap}>
                    Full tools until then, then ${billing.priceMonthly}/month. Public profile and booking stay up either way.
                  </p>
                </div>
                <Link to={`${ROUTES.SETTINGS}?tab=plan`} className={cn(secondaryButton, "shrink-0")}>
                  Plan details
                </Link>
              </div>
              <div className="flex flex-col gap-2.5">
                {(
                  [
                    ["Complete your profile", `${ROUTES.PROFILE}?mode=edit`, hasBio],
                    ["Set your weekly availability", ROUTES.SCHEDULE, Boolean(scheduleQuery.data?.sessions.length)],
                    [
                      billing.subscribed
                        ? `Coach plan · $${billing.priceMonthly}/mo`
                        : `Subscribe when ready · $${billing.priceMonthly}/mo`,
                      `${ROUTES.SETTINGS}?tab=plan`,
                      billing.subscribed,
                    ],
                  ] as [string, string, boolean][]
                ).map(([text, to, done], i) => (
                  <Link key={`${to}-${text}`} to={to} className="flex items-center gap-3 rounded-control border border-light-525 bg-light-400 px-4 py-3 text-dark hover:bg-light-525 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                    <span
                      className={cn(
                        "flex size-5 flex-none items-center justify-center rounded-full text-label-xsm",
                        done ? "border border-success-300 bg-success-100 text-success-700" : "border border-dashed border-light-600"
                      )}
                    >
                      {done ? <Check className="size-3" strokeWidth={2.5} aria-hidden="true" /> : i + 1}
                    </span>
                    <span className="grow text-label-sm">{text}</span>
                    <ChevronRight className="size-4 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {isEmpty && !billing.trialActive ? (
          <section className={card}>
            <div className="flex flex-col items-center gap-2.5 px-4 py-7 text-center text-dark-300">
              <Rocket className="size-6 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
              <span className={cn(h3, "text-dark")}>Let's get your first booking</span>
              <p className="max-w-[44ch] text-body-m">Three steps and families can find and book you.</p>
              <div className="flex w-full max-w-[420px] flex-col gap-2.5 text-left">
                {(
                  [
                    ["Complete your profile", ROUTES.PROFILE, hasBio],
                    ["Set your weekly availability", ROUTES.SCHEDULE, Boolean(scheduleQuery.data?.sessions.length)],
                    ["Invite the families you already coach", `${ROUTES.ATHLETES}?tab=invites`, false],
                  ] as [string, string, boolean][]
                ).map(([text, to, done], i) => (
                  <Link key={to} to={to} className="flex items-center gap-3 rounded-control border border-light-525 bg-light-400 px-4 py-3 text-dark hover:bg-light-525 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                    <span
                      className={cn(
                        "flex size-5 flex-none items-center justify-center rounded-full text-label-xsm",
                        done ? "border border-success-300 bg-success-100 text-success-700" : "border border-dashed border-light-600"
                      )}
                    >
                      {done ? <Check className="size-3" strokeWidth={2.5} aria-hidden="true" /> : i + 1}
                    </span>
                    <span className="grow text-label-sm">{text}</span>
                    <ChevronRight className="size-4 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {!isEmpty || billing.trialActive || billing.locked ? (
          <>
            {!billing.locked ? <PaymentsToConfirm /> : null}
            {/* Legacy booking-only coaches hid the money strip (ATH-86); WC4 keeps card on. */}
            {!paysDirect ? (
              <section aria-label="Money" className="flex flex-col gap-3 rounded-card border border-light-525 bg-light-300 px-4 pb-4 pt-3 md:px-5">
                <div className="flex items-center justify-between gap-3">
                  <div className={cn(segGroup, "flex-1 md:inline-flex md:flex-none")} role="group" aria-label="Period">
                    {RANGES.map(([d, label]) => (
                      <button
                        key={d}
                        type="button"
                        className={cn(segButton(range === d), "h-7 px-1 md:flex-none md:px-2.5")}
                        aria-pressed={range === d}
                        onClick={() => setRange(d)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <Link to={ROUTES.PAYMENTS} className={textButton}>
                    Business
                    <ChevronRight strokeWidth={1.5} aria-hidden="true" />
                  </Link>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3 md:gap-7">
                  <div className="flex flex-auto flex-col gap-0.5 md:flex-none">
                    <span className={eyebrow}>Earned {rangeLabel}</span>
                    <span className="flex items-baseline gap-2">
                      <b className="text-section tabular-nums">{totals ? money(totals.current) : "…"}</b>
                      {totals?.change != null ? (
                        <span className={cn("inline-flex items-center gap-[3px] text-label-xsm", totals.change >= 0 ? "text-success-700" : "text-error-700")}>
                          {totals.change >= 0 ? <TrendingUp className="size-3" strokeWidth={2} /> : <TrendingDown className="size-3" strokeWidth={2} />}
                          {Math.abs(totals.change)}%
                        </span>
                      ) : null}
                    </span>
                  </div>
                  {sparkValues.length ? <Sparkline values={sparkValues} /> : null}
                  <div className="flex flex-[1_1_40%] flex-col gap-0.5 border-t border-light-525 pt-2.5 md:flex-none md:border-0 md:pt-0">
                    <span className={eyebrow}>Still owed</span>
                    <b className="text-subtitle tabular-nums">{earningsQuery.data ? money(earningsQuery.data.owed) : "…"}</b>
                    {earningsQuery.data?.overdueCount ? (
                      <button type="button" className="self-start text-label-xsm text-error-700 hover:underline disabled:text-dark-200" disabled={reminding} onClick={remindOverdue}>
                        {earningsQuery.data.overdueCount} overdue · remind
                      </button>
                    ) : (
                      <span className={cap}>Nothing overdue</span>
                    )}
                  </div>
                  {nextPayout ? (
                    <div className="flex flex-[1_1_40%] flex-col gap-0.5 border-t border-light-525 pt-2.5 md:flex-none md:border-0 md:pt-0">
                      <span className={eyebrow}>Next payout</span>
                      <b className="text-subtitle tabular-nums">{money(nextPayout.amount)}</b>
                      <span className={cap}>{formatDayISO(nextPayout.arrival.slice(0, 10), { weekday: "short", month: "short", day: "numeric" })}</span>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {showPlanCard ? (
              <section className={cn(card, "flex-row items-center gap-4 max-md:flex-col max-md:items-stretch")}>
                {nextPlanned ? (
                  <>
                    <span className="flex size-11 flex-none items-center justify-center rounded-full border border-success-300 bg-success-100 text-success-700">
                      <Check className="size-5" strokeWidth={2} aria-hidden="true" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className={h3}>Next week is planned</span>
                      <span className="text-body-m text-dark-300">
                        {plural(nextWeekSessions.length, "session")} · {plural(nextSpots, "spot")} · {nextBooked} booked so far
                      </span>
                    </div>
                    <Link to={ROUTES.SCHEDULE_PLAN} className={cn(secondaryButton, smallButton)}>
                      Edit plan
                    </Link>
                  </>
                ) : (
                  <>
                    <span className="flex size-11 flex-none items-center justify-center rounded-full border border-primary-200 bg-primary-50 text-primary">
                      <CalendarDays className="size-5" strokeWidth={1.5} aria-hidden="true" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={h3}>Plan next week</span>
                        <BrandPill tone="sunk">
                          {formatDayISO(nextMonday, { month: "short", day: "numeric" })} to{" "}
                          {formatDayISO(nextWeekEnd, { month: "short", day: "numeric" })}
                        </BrandPill>
                      </div>
                      <span className="text-body-m text-dark-300">
                        {nextDrafts.length
                          ? `${plural(nextDrafts.length, "session")} planned but not shared yet.`
                          : `${nextLive.length ? `${plural(nextLive.length, "session")} ${nextLive.length === 1 ? "is" : "are"} already live for next week. ` : ""}${
                              gap
                                ? `${gap} of this week's group sessions ${gap === 1 ? "isn't" : "aren't"} on it yet.`
                                : "Add what else you want to run."
                            }`}
                      </span>
                    </div>
                    <Link to={ROUTES.SCHEDULE_PLAN} className={cn(primaryButton, smallButton)}>
                      {nextDrafts.length ? "Finish planning" : "Plan next week"}
                    </Link>
                  </>
                )}
              </section>
            ) : null}

            <IntroCallsHomeCard />

            <section className={dayCard}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className={eyebrow}>Today · {formatDayISO(todayISO, { weekday: "long", month: "short", day: "numeric" })}</span>
                  <h2 className={h2}>{todaySessions.length ? plural(todaySessions.length, "session") : "No sessions today"}</h2>
                </div>
                {todaySessions.length ? (
                  <span className={cap}>
                    {formatClock(sessionStart(todaySessions[0]), timeZone)} to {formatClock(sessionEnd(todaySessions[todaySessions.length - 1]), timeZone)}
                  </span>
                ) : null}
              </div>

              {feedbackDue.length ? (
                <Banner
                  tone="info"
                  icon={<MessageSquareText strokeWidth={1.5} aria-hidden="true" />}
                  action={
                    <Link to={`${ROUTES.COACH_SESSION_FEEDBACK}?slotId=${feedbackDue[0].id}`} className={textButton}>
                      Add feedback
                    </Link>
                  }
                >
                  <b className="font-medium">
                    {plural(feedbackDue.length, "session")} {feedbackDue.length === 1 ? "needs" : "need"} feedback.
                  </b>{" "}
                  Families get it by email.
                </Banner>
              ) : null}

              {scheduleQuery.isLoading ? (
                <p className="text-body-m text-dark-300">Loading…</p>
              ) : todaySessions.length ? (
                <div>
                  {todaySessions.map((s, index) => {
                    const start = sessionStart(s);
                    const end = sessionEnd(s);
                    const done = end <= now;
                    const live = start <= now && !done;
                    const isNext = s === nextSession && !live;
                    const afterNext = index > 0 && todaySessions[index - 1] === nextSession;
                    const group = s.sessionType === "group";
                    const athletes = bookedAthletes(s);
                    const first = athletes[0]?.athleteName.split(" ")[0];
                    return (
                      <div
                        key={s.id}
                        className={cn(
                          "grid grid-cols-[62px_minmax(0,1fr)] gap-3 border-t border-light-525 py-4 md:grid-cols-[84px_minmax(0,1fr)] md:gap-4",
                          isNext && "-mx-[18px] border-transparent bg-primary-50 px-[18px] md:-mx-[25px] md:px-[25px]",
                          afterNext && "border-transparent"
                        )}
                      >
                        <div className="flex flex-col gap-0.5">
                          <b className={cn("text-subtitle tabular-nums", done && "text-dark-300")}>{formatClock(start, timeZone)}</b>
                          <span className={cap}>{s.durationMinutes} min</span>
                          {done || live || isNext ? (
                            <span
                              className={cn(
                                "mt-1 self-start rounded-pill border px-1.5 py-px text-label-xsm",
                                done ? "border-light-525 bg-light-400 text-dark-300" : "border-primary bg-primary text-light"
                              )}
                            >
                              {done ? "Done" : live ? "Now" : "Next"}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex min-w-0 flex-col gap-2">
                          <div className="flex items-start justify-between gap-3">
                            <Link to={`/sessions/${s.id}`} className="flex min-w-0 flex-col gap-1 text-left">
                              <span className={cn(h3, done ? "text-dark-300" : "text-dark")}>{titleOf(s)}</span>
                              <span className={cap}>{s.location === "online" ? "Video call" : s.place || "In person"}</span>
                            </Link>
                            {group ? (
                              <BrandPill tone="teal">
                                <Users strokeWidth={1.5} aria-hidden="true" />
                                Group · {athletes.length} of {s.capacity}
                              </BrandPill>
                            ) : (
                              <BrandPill tone="neutral">
                                <User strokeWidth={1.5} aria-hidden="true" />
                                1-on-1
                              </BrandPill>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="flex" aria-label={athletes.map((a) => a.athleteName).join(", ")}>
                              {athletes.slice(0, 4).map((a, k) => (
                                <span
                                  key={a.id}
                                  className={cn(
                                    "flex size-[26px] items-center justify-center rounded-full border-2 border-light-300 bg-primary-50 text-label-xsm text-primary",
                                    k > 0 && "-ml-1.5"
                                  )}
                                >
                                  {initials(a.athleteName)}
                                </span>
                              ))}
                              {athletes.length > 4 ? (
                                <span className="-ml-1.5 flex size-[26px] items-center justify-center rounded-full border-2 border-light-300 bg-light-400 text-label-xsm text-dark-400">
                                  +{athletes.length - 4}
                                </span>
                              ) : null}
                            </span>
                            <span className="inline-flex items-center gap-1 text-caption text-success-700">
                              <CircleCheck className="size-3" strokeWidth={2} aria-hidden="true" />
                              {paidText(s)}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {done && feedbackIds.has(s.id) ? (
                              <Link to={`${ROUTES.COACH_SESSION_FEEDBACK}?slotId=${s.id}`} className={cn(primaryButton, smallButton)}>
                                <MessageSquareText strokeWidth={1.5} aria-hidden="true" />
                                Add feedback
                              </Link>
                            ) : null}
                            {group ? (
                              <Link to={`/sessions/${s.id}`} className={cn(secondaryButton, smallButton)}>
                                View session
                              </Link>
                            ) : (
                              <Link to={ROUTES.CHAT} className={cn(secondaryButton, smallButton)}>
                                Message {first ?? "family"}
                              </Link>
                            )}
                            {!done && !group ? (
                              <Link to={`/sessions/${s.id}`} className={textButton}>
                                Details
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-body-m text-dark-300">
                  {upcoming
                    ? `Next up: ${titleOf(upcoming)}, ${formatDayISO(upcoming.date, { weekday: "short", month: "short", day: "numeric" })} at ${formatClock(sessionStart(upcoming), timeZone)}.`
                    : "Nothing booked yet."}
                </p>
              )}
            </section>

            <section className={dayCard}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className={eyebrow}>This week</span>
                  <h2 className={h2}>
                    {plural(booked, "session")} booked, {plural(open, "slot")} open
                  </h2>
                </div>
                <span className="flex items-center gap-2.5">
                  {requests ? (
                    <Link
                      to={`${ROUTES.SCHEDULE}?requests=1`}
                      className="inline-flex h-control-sm items-center gap-1.5 rounded-control border border-info-300 bg-info-100 px-3 text-label-sm text-info-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <Inbox className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                      {plural(requests, "request")}
                    </Link>
                  ) : null}
                  <Link to={ROUTES.SCHEDULE} className={textButton}>
                    Open schedule
                    <ChevronRight strokeWidth={1.5} aria-hidden="true" />
                  </Link>
                </span>
              </div>

              {showCheckIn ? (
                <Banner
                  tone="info"
                  icon={<CalendarCheck strokeWidth={1.5} aria-hidden="true" />}
                  action={
                    <span className="flex items-center gap-3">
                      <button
                        type="button"
                        className={textButton}
                        onClick={() => {
                          dismissCheckIn();
                          toast({ title: "All set. Your usual hours stay open next week" });
                        }}
                      >
                        All good
                      </button>
                      <button type="button" className={textButton} onClick={() => setWeekOffOpen(true)}>
                        Add days off
                      </button>
                    </span>
                  }
                >
                  <b className="font-medium">Sunday check-in:</b> any time off next week?
                </Banner>
              ) : null}

              <div className="grid grid-cols-7 gap-1 md:gap-2">
                {days.map((d) => {
                  const sessions = d.items.filter((i) => i.kind === "booked" || i.kind === "group");
                  const openCount = d.items.filter((i) => i.kind === "open").length;
                  const groups = d.items.filter((i) => i.kind === "group");
                  const dayRequests = d.items.reduce((n, i) => n + (i.session ? requestsFor(i.session).length : 0), 0);
                  const off = Boolean(d.dayOff) && !sessions.length;
                  const isToday = d.date === todayISO;
                  return (
                    <button
                      key={d.date}
                      type="button"
                      onClick={() => openDay(d.date)}
                      className={cn(
                        "flex min-h-[104px] min-w-0 flex-col items-center gap-1.5 rounded-card border px-0.5 py-1.5 text-center transition-colors hover:border-primary-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:min-h-[140px] md:items-start md:p-2.5 md:text-left",
                        off ? "border-dashed border-light-525 bg-transparent opacity-60" : "border-light-525 bg-light",
                        isToday && "border-primary outline outline-1 -outline-offset-2 outline-primary"
                      )}
                      aria-label={`${formatDayISO(d.date, { weekday: "long", month: "long", day: "numeric" })}: ${plural(sessions.length, "session")} booked, ${openCount} open`}
                    >
                      <span className={cap}>{formatDayISO(d.date, { weekday: "short" })}</span>
                      <b className="text-subtitle tabular-nums md:text-card-title">{formatDayISO(d.date, { day: "numeric" })}</b>
                      <span className="flex flex-wrap justify-center gap-[3px] md:justify-start" aria-hidden="true">
                        {sessions.map((i) => (
                          <i key={i.key} className={cn("block h-2 w-2 rounded-[2px] md:w-[14px]", i.kind === "group" ? "bg-secondary-600" : "bg-primary")} />
                        ))}
                        {Array.from({ length: openCount }, (_, k) => (
                          <i key={`o${k}`} className="block h-2 w-2 rounded-[2px] border-[1.5px] border-dashed border-primary md:w-[14px]" />
                        ))}
                        {off ? <em className="text-caption not-italic text-dark-300">Off</em> : null}
                      </span>
                      <span className="text-caption text-dark-300">
                        {sessions.length} booked
                        {openCount ? (
                          <>
                            <br />
                            <b className="font-medium text-primary">{openCount} open</b>
                          </>
                        ) : null}
                      </span>
                      {groups.map((g) => (
                        <span key={g.key} className="hidden max-w-full truncate rounded-pill border border-secondary-300 bg-secondary-100 px-1.5 py-0.5 text-label-xsm text-secondary-700 md:block">
                          {g.session!.sessionName.replace(" group", "").replace(" small", "")} {bookedAthletes(g.session!).length}/{g.session!.capacity}
                        </span>
                      ))}
                      {dayRequests ? (
                        <span className="hidden rounded-pill border border-info-300 bg-info-100 px-1.5 py-0.5 text-label-xsm text-info-800 md:block">{plural(dayRequests, "request")}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        ) : null}
      </div>
      <CreateSessionSheet open={createOpen} onOpenChange={setCreateOpen} />
      <WeekOffDialog
        open={weekOffOpen}
        onOpenChange={setWeekOffOpen}
        monday={nextMonday}
        days={nextWeekDays}
        onSaved={() => {
          dismissCheckIn();
          void scheduleQuery.refetch();
        }}
      />
    </div>
  );
};
