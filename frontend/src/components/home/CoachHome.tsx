/**
 * Coach Home (ATH-76, Working Copy): today and this week first, in one 760px column.
 * Money strip (earned, still owed, next payout), Today (every session with who's coming and
 * payment, the next one highlighted, feedback due on the card) and This week (7 day cards,
 * open slots, groups, requests, and the Sunday check-in sheet).
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Check, ChevronRight, CircleCheck, Inbox, MessageSquareText, Pencil, Plus, Rocket, TrendingDown, TrendingUp, User, Users } from "lucide-react";
import { BrandPill } from "@/components/brand";
import { homeAPI } from "@/api/home";
import { payoutsAPI } from "@/api/payouts";
import { periodTotals } from "@/utils/home";
import { useCoachDetails } from "@/hooks/useCoachDetails";
import { scheduleAPI, type ScheduleSession } from "@/api/schedule";
import { rosterAPI } from "@/api/roster";
import { card, pageTitle, primaryButton, secondaryButton, segButton, segGroup, smallButton, textButton } from "@/components/schedule/styles";
import { invoicesAPI } from "@/api/invoices";
import { useToast } from "@/hooks/use-toast";
import { WeekOffDialog } from "./WeekOffDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
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

const CHECKIN_KEY = "athanext.home.checkin";
const readCheckin = () => {
  try {
    return localStorage.getItem(CHECKIN_KEY);
  } catch {
    return null;
  }
};

const Sparkline = ({ values }: { values: number[] }) => {
  const W = 120;
  const H = 36;
  const max = Math.max(1, ...values);
  const pts = values
    .map((v, i) => `${((i * W) / Math.max(1, values.length - 1)).toFixed(1)},${(H - 3 - (v / max) * (H - 6)).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true" className="flex-none">
      <polygon points={`0,${H} ${pts} ${W},${H}`} fill="#E5EDF7" />
      <polyline points={pts} fill="none" stroke="#0054B4" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
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
const eyebrow = "text-[11px] font-semibold uppercase tracking-[0.06em] text-[#767980]";
const h2 = "text-[20px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]";
const h3 = "text-[16px] font-medium leading-[18px] tracking-[-0.05em]";
const cap = "text-[12px] leading-[14px] text-[#767980]";
const ctxbar = "flex items-center gap-[10px] rounded-[10px] py-2 pl-3 pr-2 text-[13px] text-[#484D56] [&_b]:font-semibold [&_b]:text-[#1A202C]";
const dayCard = cn(card, "gap-4 px-4 py-[18px] md:px-6 md:py-[22px]");

export const CoachHome = () => {
  const { userName, userProfile } = useAuth();
  const { toast } = useToast();
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
  // The check-in asks about next week (Monday to Sunday).
  const nextMonday = weekStartISO(addDaysISO(todayISO, 7));
  const [checkinDone, setCheckinDone] = useState(() => readCheckin() === nextMonday);
  const [weekOffOpen, setWeekOffOpen] = useState(false);
  const [reminding, setReminding] = useState(false);

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(todayISO, i)), [todayISO]);
  const nextWeekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(nextMonday, i)), [nextMonday]);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nextWeek = useMemo(() => layout(nextWeekDates), [nextWeekDates, scheduleQuery.data, timeZone]);

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

  const closeCheckin = () => {
    try {
      localStorage.setItem(CHECKIN_KEY, nextMonday);
    } catch {
      // The check-in just shows again next time.
    }
    setCheckinDone(true);
  };

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
  const createSession = () => navigate(`${ROUTES.SCHEDULE}?create=1`);
  const openDay = (date: string) => navigate(`${ROUTES.SCHEDULE}?day=${date}`);
  const titleOf = (s: ScheduleSession) => (s.sessionType === "group" ? s.sessionName : bookedAthletes(s)[0]?.athleteName ?? "Open slot");
  const hasBio = Boolean((me as { bio?: string | null } | undefined)?.bio);

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className={pageTitle}>
              {greeting}, {firstName}
            </h1>
            <p className="text-[14px] text-[#767980]">{formatDayISO(todayISO, { weekday: "long", month: "long", day: "numeric" })}</p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto">
            <button type="button" className={primaryButton} onClick={createSession}>
              <Plus strokeWidth={1.5} aria-hidden="true" />
              Create session
            </button>
            <Link to={`${ROUTES.PROFILE}?mode=edit`} className={secondaryButton}>
              <Pencil strokeWidth={1.5} aria-hidden="true" />
              Edit profile
            </Link>
          </div>
        </header>

        {isEmpty ? (
          <section className={card}>
            <div className="flex flex-col items-center gap-[10px] px-4 py-7 text-center text-[#767980]">
              <Rocket className="size-7 text-[#A3A6AB]" strokeWidth={1.5} aria-hidden="true" />
              <span className={cn(h3, "text-[#1A202C]")}>Let's get your first booking</span>
              <p className="max-w-[44ch] text-[14px]">Three steps and families can find and book you.</p>
              <div className="flex w-full max-w-[420px] flex-col gap-[10px] text-left">
                {(
                  [
                    ["Complete your profile", ROUTES.PROFILE, hasBio],
                    ["Set your weekly availability", ROUTES.SCHEDULE, Boolean(scheduleQuery.data?.sessions.length)],
                    ["Invite the families you already coach", ROUTES.INVITES, false],
                  ] as [string, string, boolean][]
                ).map(([text, to, done], i) => (
                  <Link key={to} to={to} className="flex items-center gap-3 rounded-[8px] bg-[#F4F4EB] px-4 py-[14px] text-[#1A202C] hover:bg-[#EAEADF]">
                    <span
                      className={cn(
                        "flex size-5 flex-none items-center justify-center rounded-full text-[12px] font-semibold",
                        done ? "bg-[#CBE7D1] text-[#1E7431]" : "border border-dashed border-[#C1C1B8]"
                      )}
                    >
                      {done ? <Check className="size-3" strokeWidth={2.5} aria-hidden="true" /> : i + 1}
                    </span>
                    <span className="grow text-[14px] font-medium">{text}</span>
                    <ChevronRight className="size-4 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <>
            {/* Booking only coaches are paid directly, so there is no money strip (ATH-86). */}
            {!paysDirect ? (
              <section aria-label="Money" className="flex flex-col gap-3 rounded-[12px] border border-[#EAEADF] bg-[#F7F7F0] px-[14px] pb-[14px] pt-3 md:px-5 md:pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div className={cn(segGroup, "flex-1 md:inline-flex md:flex-none")} role="group" aria-label="Period">
                    {RANGES.map(([d, label]) => (
                      <button
                        key={d}
                        type="button"
                        className={cn(segButton(range === d), "h-7 px-1 text-[13px] md:flex-none md:px-[10px]")}
                        aria-pressed={range === d}
                        onClick={() => setRange(d)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <Link to={ROUTES.PAYMENTS} className={cn(textButton, "text-[13px]")}>
                    Business
                    <ChevronRight strokeWidth={1.5} aria-hidden="true" />
                  </Link>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3 md:gap-7">
                  <div className="flex flex-auto flex-col gap-0.5 md:flex-none">
                    <span className={eyebrow}>Earned · {rangeLabel}</span>
                    <span className="flex items-baseline gap-2">
                      <b className="text-[26px] font-bold leading-[30px] tracking-[-0.04em] tabular-nums">{totals ? money(totals.current) : "…"}</b>
                      {totals?.change != null ? (
                        <span className={cn("inline-flex items-center gap-[3px] text-[12px] font-semibold", totals.change >= 0 ? "text-[#1E7431]" : "text-[#972B2B]")}>
                          {totals.change >= 0 ? <TrendingUp className="size-[13px]" strokeWidth={1.5} /> : <TrendingDown className="size-[13px]" strokeWidth={1.5} />}
                          {Math.abs(totals.change)}%
                        </span>
                      ) : null}
                    </span>
                  </div>
                  {sparkValues.length ? <Sparkline values={sparkValues} /> : null}
                  <div className="flex flex-[1_1_40%] flex-col gap-0.5 border-t border-[#EAEADF] pt-[10px] md:flex-none md:border-0 md:pt-0">
                    <span className={eyebrow}>Still owed</span>
                    <b className="text-[17px] font-semibold tabular-nums">{earningsQuery.data ? money(earningsQuery.data.owed) : "…"}</b>
                    {earningsQuery.data?.overdueCount ? (
                      <button type="button" className="self-start text-[12px] font-medium text-[#972B2B] hover:underline" disabled={reminding} onClick={remindOverdue}>
                        {earningsQuery.data.overdueCount} overdue · remind
                      </button>
                    ) : (
                      <span className={cap}>Nothing overdue</span>
                    )}
                  </div>
                  {nextPayout ? (
                    <div className="flex flex-[1_1_40%] flex-col gap-0.5 border-t border-[#EAEADF] pt-[10px] md:flex-none md:border-0 md:pt-0">
                      <span className={eyebrow}>Next payout</span>
                      <b className="text-[17px] font-semibold tabular-nums">{money(nextPayout.amount)}</b>
                      <span className={cap}>{formatDayISO(nextPayout.arrival.slice(0, 10), { weekday: "short", month: "short", day: "numeric" })}</span>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

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
                <div className={cn(ctxbar, "bg-[#FCEFDA]")}>
                  <MessageSquareText className="size-4 flex-none text-[#906A29]" strokeWidth={1.5} aria-hidden="true" />
                  <span className="grow">
                    <b>
                      {plural(feedbackDue.length, "session")} {feedbackDue.length === 1 ? "needs" : "need"} feedback.
                    </b>{" "}
                    Families get it by email.
                  </span>
                  <Link to={`${ROUTES.COACH_SESSION_FEEDBACK}?slotId=${feedbackDue[0].id}`} className={textButton}>
                    Add feedback
                  </Link>
                </div>
              ) : null}

              {scheduleQuery.isLoading ? (
                <p className="text-[14px] text-[#767980]">Loading…</p>
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
                          "grid grid-cols-[62px_minmax(0,1fr)] gap-[10px] border-t border-[#EAEADF] py-4 md:grid-cols-[84px_minmax(0,1fr)] md:gap-[14px]",
                          isNext && "-mx-4 border-transparent bg-[#E5EDF7] px-4 py-[14px] md:-mx-6 md:px-6 md:py-4",
                          afterNext && "border-transparent"
                        )}
                      >
                        <div className="flex flex-col gap-0.5">
                          <b className={cn("text-[16px] font-semibold", done && "text-[#767980]")}>{formatClock(start, timeZone)}</b>
                          <span className={cap}>{s.durationMinutes} min</span>
                          {done || live || isNext ? (
                            <span
                              className={cn(
                                "mt-1 self-start rounded-[6px] px-1.5 py-px text-[11px] font-semibold",
                                done ? "bg-[#F4F4EB] text-[#767980]" : "bg-[#0054B4] text-[#F1F1E6]"
                              )}
                            >
                              {done ? "Done" : live ? "Now" : "Next"}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex min-w-0 flex-col gap-2">
                          <div className="flex items-start justify-between gap-3">
                            <Link to={`/sessions/${s.id}`} className="flex min-w-0 flex-col gap-1 text-left">
                              <span className={cn(h3, done ? "text-[#767980]" : "text-[#1A202C]")}>{titleOf(s)}</span>
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
                                    "flex size-[26px] items-center justify-center rounded-full border-2 border-[#F7F7F0] bg-[#E5EDF7] text-[10px] font-semibold text-[#0054B4]",
                                    k > 0 && "-ml-1.5"
                                  )}
                                >
                                  {initials(a.athleteName)}
                                </span>
                              ))}
                              {athletes.length > 4 ? (
                                <span className="-ml-1.5 flex size-[26px] items-center justify-center rounded-full border-2 border-[#F7F7F0] bg-[#F4F4EB] text-[10px] font-semibold text-[#484D56]">
                                  +{athletes.length - 4}
                                </span>
                              ) : null}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[12px] text-[#1E7431]">
                              <CircleCheck className="size-[13px]" strokeWidth={1.5} aria-hidden="true" />
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
                <p className="text-[14px] text-[#767980]">
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
                <span className="flex items-center gap-[10px]">
                  {requests ? (
                    <Link
                      to={`${ROUTES.SCHEDULE}?requests=1`}
                      className="inline-flex h-[30px] items-center gap-1.5 rounded-[15px] bg-[#FCEFDA] px-3 text-[13px] font-semibold text-[#906A29]"
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

              {!checkinDone ? (
                <div className={cn(ctxbar, "bg-[#E5EDF7]")}>
                  <CalendarCheck className="size-4 flex-none text-[#0054B4]" strokeWidth={1.5} aria-hidden="true" />
                  <span className="grow">
                    <b>Sunday check-in:</b> any time off next week?
                  </span>
                  <button
                    type="button"
                    className={textButton}
                    onClick={() => {
                      closeCheckin();
                      toast({ title: "All set. Your usual hours stay open next week" });
                    }}
                  >
                    All good
                  </button>
                  <button type="button" className={textButton} onClick={() => setWeekOffOpen(true)}>
                    Add days off
                  </button>
                </div>
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
                        "flex min-h-[104px] min-w-0 flex-col items-center gap-1.5 rounded-[12px] border px-0.5 py-1.5 text-center transition-colors hover:border-[#6698D2] md:min-h-[140px] md:items-start md:p-[10px] md:text-left",
                        off ? "border-dashed border-[#EAEADF] bg-transparent opacity-60" : "border-[#EAEADF] bg-[#F1F1E6]",
                        isToday && "border-[#0054B4] shadow-[0_0_0_1px_#0054B4]"
                      )}
                      aria-label={`${formatDayISO(d.date, { weekday: "long", month: "long", day: "numeric" })}: ${plural(sessions.length, "session")} booked, ${openCount} open`}
                    >
                      <span className={cap}>{formatDayISO(d.date, { weekday: "short" })}</span>
                      <b className="text-[16px] font-semibold leading-[22px] md:text-[20px]">{formatDayISO(d.date, { day: "numeric" })}</b>
                      <span className="flex flex-wrap justify-center gap-[3px] md:justify-start" aria-hidden="true">
                        {sessions.map((i) => (
                          <i key={i.key} className={cn("block h-2 w-2 rounded-[2px] md:w-[14px]", i.kind === "group" ? "bg-[#117A96]" : "bg-[#0054B4]")} />
                        ))}
                        {Array.from({ length: openCount }, (_, k) => (
                          <i key={`o${k}`} className="block h-2 w-2 rounded-[2px] border-[1.5px] border-dashed border-[#0054B4] md:w-[14px]" />
                        ))}
                        {off ? <em className="text-[12px] not-italic text-[#A3A6AB]">Off</em> : null}
                      </span>
                      <span className="text-[10px] leading-[13px] text-[#484D56] md:text-[12px] md:leading-4">
                        {sessions.length} booked
                        {openCount ? (
                          <>
                            <br />
                            <b className="text-[10px] font-semibold text-[#0054B4] md:text-[12px]">{openCount} open</b>
                          </>
                        ) : null}
                      </span>
                      {groups.map((g) => (
                        <span key={g.key} className="hidden max-w-full truncate rounded-[6px] bg-[#E7F4F8] px-1.5 py-0.5 text-[11px] text-[#117A96] md:block">
                          {g.session!.sessionName.replace(" group", "").replace(" small", "")} {bookedAthletes(g.session!).length}/{g.session!.capacity}
                        </span>
                      ))}
                      {dayRequests ? (
                        <span className="hidden rounded-[6px] bg-[#FCEFDA] px-1.5 py-0.5 text-[11px] text-[#906A29] md:block">{plural(dayRequests, "request")}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
      <WeekOffDialog
        open={weekOffOpen}
        onOpenChange={setWeekOffOpen}
        monday={nextMonday}
        days={nextWeek}
        onSaved={() => {
          closeCheckin();
          void scheduleQuery.refetch();
        }}
      />
    </div>
  );
};
