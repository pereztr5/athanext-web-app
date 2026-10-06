/**
 * Coach Home (ATH-76): today and this week first, in one column on web and phone.
 * Money strip (earned, still owed), Today (every session with who's coming and payment,
 * feedback due on the card) and This week (7 day cards, open slots, groups, requests,
 * and the Sunday check-in).
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, ChevronRight, CircleCheck, Inbox, MessageSquareText, Plus, TrendingDown, TrendingUp, User, Users } from "lucide-react";
import { BrandPill } from "@/components/brand";
import { homeAPI } from "@/api/home";
import { periodTotals } from "@/utils/home";
import { scheduleAPI, type ScheduleSession } from "@/api/schedule";
import { rosterAPI } from "@/api/roster";
import { card, meta, primaryButton, secondaryButton, segButton, segGroup, textButton } from "@/components/schedule/styles";
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
import { formatInstantSpan, isoDateInZone } from "@/utils/viewerTime";

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

export const CoachHome = () => {
  const { userName, userProfile } = useAuth();
  const navigate = useNavigate();
  const timeZone = useViewerTimeZone();
  const now = new Date();
  const todayISO = isoDateInZone(now, timeZone);
  const [range, setRange] = useState(7);
  const [checkinDone, setCheckinDone] = useState(() => readCheckin() === weekStartISO(addDaysISO(todayISO, 7)));

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(todayISO, i)), [todayISO]);
  const scheduleQuery = useQuery({
    queryKey: ["coach-schedule", "home", todayISO],
    queryFn: () => scheduleAPI.get(addDaysISO(todayISO, -1), addDaysISO(todayISO, 7)),
  });
  const earningsQuery = useQuery({ queryKey: ["coach-earnings", range], queryFn: () => homeAPI.earnings(range) });
  const feedbackQuery = useQuery({ queryKey: ["feedback-due"], queryFn: () => homeAPI.feedbackDue() });
  const rosterQuery = useQuery({ queryKey: ["coach-roster"], queryFn: () => rosterAPI.roster() });

  const days = useMemo(
    () =>
      layoutDays({
        dates: weekDates,
        sessions: scheduleQuery.data?.sessions ?? [],
        busy: scheduleQuery.data?.busy ?? [],
        timeOff: scheduleQuery.data?.timeOff ?? [],
        timeZone,
        now,
      }),
    // `now` changes every render; the minute it was computed is enough here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weekDates, scheduleQuery.data, timeZone]
  );

  const firstName = (userName || userProfile?.name || "").split(" ")[0] || "Coach";
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(now));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const today = days[0];
  const todaySessions = (today?.items ?? []).filter((i) => i.session && (i.kind === "booked" || i.kind === "group")).map((i) => i.session!);
  const nextSession = todaySessions.find((s) => sessionStart(s) > now);
  const feedbackDue = feedbackQuery.data ?? [];
  const feedbackIds = new Set(feedbackDue.map((f) => f.id));
  const requests = (scheduleQuery.data?.sessions ?? []).reduce((n, s) => n + requestsFor(s).length, 0);
  const isEmpty = rosterQuery.data && !rosterQuery.data.length && scheduleQuery.data && !scheduleQuery.data.sessions.length;

  const totals = earningsQuery.data ? periodTotals(earningsQuery.data.days, range) : null;
  const sparkValues = earningsQuery.data ? earningsQuery.data.days.slice(range === 1 ? -7 : -range).map((d) => d.amount) : [];
  const rangeLabel = RANGES.find(([d]) => d === range)?.[2] ?? "";

  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(now);
  const showCheckin = !checkinDone && ["Fri", "Sat", "Sun"].includes(weekday);
  const nextMonday = weekStartISO(addDaysISO(todayISO, 7));
  const closeCheckin = () => {
    try {
      localStorage.setItem(CHECKIN_KEY, nextMonday);
    } catch {
      // The check-in just shows again next time.
    }
    setCheckinDone(true);
  };

  const booked = days.reduce((n, d) => n + d.items.filter((i) => i.kind === "booked" || i.kind === "group").length, 0);
  const open = days.reduce((n, d) => n + d.items.filter((i) => i.kind === "open").length, 0);
  const createSession = () => navigate(`${ROUTES.SCHEDULE}?create=1`);
  const openDay = (date: string) => navigate(`${ROUTES.SCHEDULE}?day=${date}`);

  return (
    <div className="overflow-x-hidden px-4 pb-16 md:px-10">
      <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-[10px]">
            <h1 className="text-[32px] font-bold leading-[32px] tracking-[-1.6px] text-[#1A202C]">
              {greeting}, {firstName}
            </h1>
            <p className="text-[16px] leading-[18px] text-[#767980]">{formatDayISO(todayISO, { weekday: "long", month: "long", day: "numeric" })}</p>
          </div>
          <button type="button" className={primaryButton} onClick={createSession}>
            <Plus strokeWidth={1.5} aria-hidden="true" />
            Create session
          </button>
        </header>

        {isEmpty ? (
          <section className={cn(card, "items-center py-10 text-center")}>
            <b className="text-[20px] font-medium">Let's get your first booking</b>
            <p className={meta}>Three steps and families can find and book you.</p>
            <div className="flex w-full max-w-[420px] flex-col gap-2 text-left">
              {[
                ["Complete your profile", ROUTES.PROFILE],
                ["Add open times", ROUTES.SCHEDULE],
                ["Invite the families you already coach", ROUTES.MY_CLIENTS],
              ].map(([label, to], i) => (
                <Link key={to} to={to} className="flex items-center gap-3 rounded-[8px] bg-[#F1F1E6] px-4 py-3 hover:bg-[#EAEADF]">
                  <span className="flex size-[24px] items-center justify-center rounded-full border border-[#C1C1B8] text-[12px] font-semibold">{i + 1}</span>
                  <span className="grow text-[14px] font-medium">{label}</span>
                  <ChevronRight className="size-4 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <>
            <section aria-label="Money" className="flex flex-col gap-4 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] p-4 md:p-5">
              <div className={cn(segGroup, "sm:w-[360px]")} role="group" aria-label="Period">
                {RANGES.map(([d, label]) => (
                  <button key={d} type="button" className={segButton(range === d)} aria-pressed={range === d} onClick={() => setRange(d)}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium uppercase tracking-[0.02em] text-[#767980]">Earned · {rangeLabel}</span>
                  <span className="flex items-baseline gap-2">
                    <b className="text-[32px] font-bold leading-[32px] tracking-[-0.04em]">{totals ? money(totals.current) : "…"}</b>
                    {totals?.change != null ? (
                      <span className={cn("flex items-center gap-1 text-[13px] font-medium", totals.change >= 0 ? "text-[#1E7431]" : "text-[#972B2B]")}>
                        {totals.change >= 0 ? <TrendingUp className="size-4" strokeWidth={1.5} /> : <TrendingDown className="size-4" strokeWidth={1.5} />}
                        {Math.abs(totals.change)}%
                      </span>
                    ) : null}
                  </span>
                </div>
                {sparkValues.length ? <Sparkline values={sparkValues} /> : null}
                <div className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium uppercase tracking-[0.02em] text-[#767980]">Still owed</span>
                  <b className="text-[20px] font-semibold">{earningsQuery.data ? money(earningsQuery.data.owed) : "…"}</b>
                  {earningsQuery.data?.overdueCount ? (
                    <Link to={ROUTES.MY_SESSIONS} className="text-[13px] font-medium text-[#972B2B] hover:underline">
                      {earningsQuery.data.overdueCount} overdue
                    </Link>
                  ) : (
                    <span className={meta}>Nothing overdue</span>
                  )}
                </div>
              </div>
            </section>

            <section className={card}>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium uppercase tracking-[0.02em] text-[#767980]">
                    Today · {formatDayISO(todayISO, { weekday: "long", month: "short", day: "numeric" })}
                  </span>
                  <h2 className="text-[22px] font-medium tracking-[-0.04em]">
                    {todaySessions.length ? plural(todaySessions.length, "session") : "No sessions today"}
                  </h2>
                </div>
                {todaySessions.length ? (
                  <span className={meta}>
                    {formatClock(sessionStart(todaySessions[0]), timeZone)} to {formatClock(sessionEnd(todaySessions[todaySessions.length - 1]), timeZone)}
                  </span>
                ) : null}
              </div>

              {feedbackDue.length ? (
                <div className="flex flex-wrap items-center gap-2 rounded-[8px] bg-[#FCEFDA] px-3 py-2.5 text-[14px] text-[#906A29]">
                  <MessageSquareText className="size-4 flex-none" strokeWidth={1.5} aria-hidden="true" />
                  <span className="grow">
                    <b>{plural(feedbackDue.length, "session")} {feedbackDue.length === 1 ? "needs" : "need"} feedback.</b> Families get it by email.
                  </span>
                  <Link to={`${ROUTES.COACH_SESSION_FEEDBACK}?slotId=${feedbackDue[0].id}`} className={textButton}>
                    Add feedback
                  </Link>
                </div>
              ) : null}

              {scheduleQuery.isLoading ? (
                <p className={meta}>Loading…</p>
              ) : todaySessions.length ? (
                <div className="flex flex-col divide-y divide-[#EAEADF]">
                  {todaySessions.map((s) => {
                    const start = sessionStart(s);
                    const end = sessionEnd(s);
                    const done = end <= now;
                    const live = start <= now && !done;
                    const isNext = s === nextSession && !live;
                    const group = s.sessionType === "group";
                    const athletes = bookedAthletes(s);
                    const first = athletes[0]?.athleteName.split(" ")[0];
                    return (
                      <div key={s.id} className={cn("flex gap-4 py-4", done ? "opacity-70" : "")}>
                        <div className="flex w-[72px] flex-none flex-col gap-1">
                          <b className="text-[14px] font-medium">{formatClock(start, timeZone)}</b>
                          <span className={meta}>{s.durationMinutes} min</span>
                          {done ? (
                            <span className="text-[12px] font-medium text-[#767980]">Done</span>
                          ) : live ? (
                            <span className="text-[12px] font-medium text-[#0054B4]">Now</span>
                          ) : isNext ? (
                            <span className="text-[12px] font-medium text-[#0054B4]">Next</span>
                          ) : null}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                          <div className="flex items-start justify-between gap-3">
                            <span className="flex flex-col gap-0.5">
                              <b className="text-[16px] font-medium">
                                {group ? s.sessionName : athletes[0]?.athleteName ?? "1-on-1 session"}
                              </b>
                              <span className={meta}>
                                {formatInstantSpan(start, end, timeZone)} · {s.location === "online" ? "Video call" : s.place || "In person"}
                              </span>
                            </span>
                            {group ? (
                              <BrandPill tone="teal">
                                <Users className="size-3" strokeWidth={1.5} aria-hidden="true" />
                                Group · {athletes.length} of {s.capacity}
                              </BrandPill>
                            ) : (
                              <BrandPill tone="neutral">
                                <User className="size-3" strokeWidth={1.5} aria-hidden="true" />
                                1-on-1
                              </BrandPill>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="flex -space-x-1.5" aria-label={athletes.map((a) => a.athleteName).join(", ")}>
                              {athletes.slice(0, 4).map((a) => (
                                <span key={a.id} className="flex size-[26px] items-center justify-center rounded-full border-2 border-[#F7F7F0] bg-[#D9D9CF] text-[10px] font-semibold text-[#484D56]">
                                  {initials(a.athleteName)}
                                </span>
                              ))}
                              {athletes.length > 4 ? (
                                <span className="flex size-[26px] items-center justify-center rounded-full border-2 border-[#F7F7F0] bg-[#EAEADF] text-[10px] font-semibold">+{athletes.length - 4}</span>
                              ) : null}
                            </span>
                            <span className="flex items-center gap-1 text-[13px] text-[#484D56]">
                              <CircleCheck className="size-3.5 text-[#1E7431]" strokeWidth={1.5} aria-hidden="true" />
                              {paidText(s)}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {done && feedbackIds.has(s.id) ? (
                              <Link to={`${ROUTES.COACH_SESSION_FEEDBACK}?slotId=${s.id}`} className={cn(primaryButton, "h-[30px] px-3")}>
                                <MessageSquareText strokeWidth={1.5} aria-hidden="true" />
                                Add feedback
                              </Link>
                            ) : null}
                            {group ? (
                              <Link to={`/sessions/${s.id}`} className={cn(secondaryButton, "h-[30px] px-3")}>
                                View session
                              </Link>
                            ) : (
                              <Link to={ROUTES.CHAT} className={cn(secondaryButton, "h-[30px] px-3")}>
                                Message {first ?? "family"}
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[14px] text-[#767980]">Nothing booked today. Your week is below.</p>
              )}
            </section>

            <section className={card}>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium uppercase tracking-[0.02em] text-[#767980]">This week</span>
                  <h2 className="text-[22px] font-medium tracking-[-0.04em]">
                    {plural(booked, "session")} booked, {plural(open, "slot")} open
                  </h2>
                </div>
                <span className="flex items-center gap-3">
                  {requests ? (
                    <Link to={ROUTES.SCHEDULE} className="flex items-center gap-1.5 rounded-full bg-[#FCEFDA] px-3 py-1 text-[13px] font-medium text-[#906A29]">
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

              {showCheckin ? (
                <div className="flex flex-wrap items-center gap-2 rounded-[8px] bg-[#F1F1E6] px-3 py-2.5 text-[14px]">
                  <CalendarCheck className="size-4 flex-none text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
                  <span className="grow">
                    <b>Sunday check-in:</b> any time off next week?
                  </span>
                  <button type="button" className={textButton} onClick={closeCheckin}>
                    All good
                  </button>
                  <button type="button" className={textButton} onClick={() => { closeCheckin(); openDay(nextMonday); }}>
                    Add days off
                  </button>
                </div>
              ) : null}

              <div className="grid grid-cols-7 gap-1.5">
                {days.map((d) => {
                  const sessions = d.items.filter((i) => i.kind === "booked" || i.kind === "group");
                  const openCount = d.items.filter((i) => i.kind === "open").length;
                  const groups = d.items.filter((i) => i.kind === "group");
                  const dayRequests = d.items.reduce((n, i) => n + (i.session ? requestsFor(i.session).length : 0), 0);
                  return (
                    <button
                      key={d.date}
                      type="button"
                      onClick={() => openDay(d.date)}
                      className={cn(
                        "flex min-h-[132px] min-w-0 flex-col items-start gap-1.5 rounded-[8px] border p-2 text-left transition-colors hover:bg-[#F1F1E6]",
                        d.date === todayISO ? "border-[#6698D2] bg-[#E5EDF7]/50" : "border-[#EAEADF] bg-[#F9F9F5]"
                      )}
                      aria-label={`${formatDayISO(d.date, { weekday: "long", month: "long", day: "numeric" })}: ${plural(sessions.length, "session")} booked, ${openCount} open`}
                    >
                      <small className="text-[11px] font-medium uppercase text-[#767980]">{formatDayISO(d.date, { weekday: "short" })}</small>
                      <b className="text-[18px] font-semibold leading-[20px]">{formatDayISO(d.date, { day: "numeric" })}</b>
                      <span className="flex w-full flex-col gap-[3px]" aria-hidden="true">
                        {sessions.map((i) => (
                          <i key={i.key} className={cn("block h-[5px] w-full rounded-full", i.kind === "group" ? "bg-[#117A96]" : "bg-[#0054B4]")} />
                        ))}
                        {Array.from({ length: Math.min(openCount, 4) }, (_, k) => (
                          <i key={`o${k}`} className="block h-[5px] w-full rounded-full border border-dashed border-[#A3A6AB]" />
                        ))}
                      </span>
                      {d.dayOff ? (
                        <em className="text-[11px] not-italic text-[#906A29]">Day off</em>
                      ) : (
                        <span className="text-[11px] leading-[14px] text-[#484D56]">
                          {sessions.length} booked
                          {openCount ? (
                            <>
                              <br />
                              <b className="font-medium text-[#0054B4]">{openCount} open</b>
                            </>
                          ) : null}
                        </span>
                      )}
                      {groups.map((g) => (
                        <span key={g.key} className="hidden w-full truncate text-[11px] text-[#117A96] sm:block">
                          {g.session!.sessionName} {bookedAthletes(g.session!).length}/{g.session!.capacity}
                        </span>
                      ))}
                      {dayRequests ? <span className="text-[11px] font-medium text-[#906A29]">{plural(dayRequests, "request")}</span> : null}
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};
