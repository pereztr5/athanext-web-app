/**
 * Book a Session (ATH-73): book with a coach the family already trains with, or book by pillar
 * (then Goalkeeper or Field player). Pick several times across days and coaches and book them
 * in one go (ATH-94).
 * Families new to a coach send a request when the coach approves new families first.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, Plus, Star, Ticket, User, Users, X, Zap, Clock } from "lucide-react";
import { BrandPill } from "@/components/brand";
import { bookAPI, type BookableSession, type BookingCoach } from "@/api/book";
import { TimePicker } from "@/components/book/TimePicker";
import { RequestTimeDialog, ReviewDialog } from "@/components/book/BookDialogs";
import { PackageSavings } from "@/components/book/PackageSavings";
import { card, meta, primaryButton, secondaryButton, segButton, segGroup, textButton } from "@/components/schedule/styles";
import { useProfile } from "@/contexts/ProfileContext";
import { useRole } from "@/hooks/useRole";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { NO_POSITION_PILLARS, bookableStart, money, pillarCopy, type BookFormat } from "@/utils/booking";
import { coachPricingPath, coachProfilePath } from "@/utils/coachSlug";
import { PROFILE_TYPE } from "@/utils/db";
import { DEFAULT_PILLARS, ICON_MAP } from "@/utils/pillarIcons";
import { formatClock, formatDayISO, plural } from "@/utils/schedule";
import { getZonedISODate, zonedWallTimeToUtc } from "@/utils/dateHelpers";
import { isoDateInZone } from "@/utils/viewerTime";

type Mode = "coach" | "pillar";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

const Avatar = ({ coach, size = 48 }: { coach: Pick<BookingCoach, "name" | "imageUrl">; size?: number }) => (
  <span
    className="flex flex-none items-center justify-center overflow-hidden rounded-full bg-[#D9D9CF] font-semibold text-[#484D56]"
    style={{ width: size, height: size, fontSize: size >= 48 ? 16 : 13 }}
    aria-hidden="true"
  >
    {coach.imageUrl ? <img src={coach.imageUrl} alt="" className="size-full object-cover" /> : initials(coach.name)}
  </span>
);

const whenText = (date: string, startTime: string, timeZone: string) => {
  const start = zonedWallTimeToUtc(date, startTime) ?? new Date(NaN);
  return `${formatDayISO(getZonedISODate(start, timeZone), { weekday: "short", month: "short", day: "numeric" })} · ${formatClock(start, timeZone)}`;
};

const BookSessionPage = () => {
  const { isCoach, ready } = useRole();
  const { profile } = useProfile();
  const timeZone = useViewerTimeZone();
  const [searchParams] = useSearchParams();
  const todayISO = isoDateInZone(new Date(), timeZone);
  const athleteId =
    profile?.type === PROFILE_TYPE.athlete && profile?.data ? ((profile.data as { id?: string }).id ?? null) : null;
  const athletePosition =
    profile?.type === PROFILE_TYPE.athlete && profile?.data ? ((profile.data as { position?: string }).position ?? "") : "";

  const myCoachesQuery = useQuery({ queryKey: ["my-coaches"], queryFn: () => bookAPI.myCoaches() });
  const myCoaches = useMemo(() => myCoachesQuery.data ?? [], [myCoachesQuery.data]);

  const linkedCoachId = searchParams.get("coach");
  const [mode, setMode] = useState<Mode | null>(null);
  const [coachId, setCoachId] = useState<string | null>(linkedCoachId);
  const [pillar, setPillar] = useState<string | null>(searchParams.get("pillar"));
  const [position, setPosition] = useState<string>(/keeper/i.test(athletePosition) ? "Goalkeeper" : "Field player");
  const [format, setFormat] = useState<BookFormat>("all");
  const [pillarCoachId, setPillarCoachId] = useState<string | null>(null);
  const [picked, setPicked] = useState<BookableSession[]>([]);
  const [pickedCoaches, setPickedCoaches] = useState<Record<string, BookingCoach>>({});
  const [reviewOpen, setReviewOpen] = useState(false);
  const [requestCoach, setRequestCoach] = useState<BookingCoach | null>(null);

  useEffect(() => {
    if (/keeper/i.test(athletePosition)) setPosition("Goalkeeper");
  }, [athletePosition]);

  const currentMode: Mode = mode ?? (linkedCoachId || myCoaches.length || myCoachesQuery.isLoading ? "coach" : "pillar");
  const defaultCoach = myCoaches.find((c) => c.credits > 0) ?? myCoaches[0];
  const selectedCoachId = coachId ?? defaultCoach?.id ?? null;

  // A coach opened from a link or profile may not be one of the family's coaches yet.
  const linkedCoachQuery = useQuery({
    queryKey: ["booking-coach", selectedCoachId],
    enabled: Boolean(selectedCoachId) && !myCoaches.some((c) => c.id === selectedCoachId),
    queryFn: () => bookAPI.sessions(selectedCoachId!, todayISO, todayISO).then((r) => r.coach),
  });
  const selectedCoach = myCoaches.find((c) => c.id === selectedCoachId) ?? linkedCoachQuery.data ?? null;

  const usesPosition = Boolean(pillar) && !NO_POSITION_PILLARS.includes(pillar!);
  const pillarQuery = useQuery({
    queryKey: ["pillar-coaches", pillar, usesPosition ? position : null, athleteId],
    enabled: currentMode === "pillar" && Boolean(pillar),
    queryFn: () => bookAPI.pillarCoaches(pillar!, usesPosition ? position : null),
  });
  const pillarCoaches = useMemo(
    () => (pillarQuery.data ?? []).filter((c) => format !== "group" || c.nextGroup).filter((c) => format !== "individual" || c.nextOpen),
    [pillarQuery.data, format]
  );
  const pillarCoach = pillarCoaches.find((c) => c.id === pillarCoachId) ?? (pillarQuery.data ?? []).find((c) => c.id === pillarCoachId) ?? null;

  if (!ready) return null;
  if (isCoach) return <Navigate to={ROUTES.SCHEDULE} replace />;

  const toggle = (coach: BookingCoach) => (session: BookableSession) => {
    setPickedCoaches((cur) => ({ ...cur, [coach.id]: coach }));
    setPicked((cur) => (cur.some((s) => s.id === session.id) ? cur.filter((s) => s.id !== session.id) : [...cur, session]));
  };
  const untoggle = (session: BookableSession) => setPicked((cur) => cur.filter((s) => s.id !== session.id));
  const pickedCoachIds = [...new Set(picked.map((s) => s.coachId))];
  const onlyCoach = pickedCoachIds.length === 1 ? pickedCoaches[pickedCoachIds[0]] : null;
  const switchMode = (next: Mode) => {
    setMode(next);
    setPillarCoachId(null);
  };

  const total = picked.reduce((n, s) => n + s.price, 0);
  const pickBar = picked.length ? (
    <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-3 border-t border-[#EAEADF] bg-[#F7F7F0]/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-[10px] md:border">
      <div className="flex flex-wrap gap-1.5">
        {picked.map((s) => {
          const start = bookableStart(s);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => untoggle(s)}
              className="inline-flex items-center gap-1 rounded-full border border-[#6698D2] bg-[#E5EDF7] px-2.5 py-1 text-[12px] font-medium text-[#0054B4]"
              aria-label={`Remove ${formatDayISO(getZonedISODate(start, timeZone), { weekday: "short", month: "short", day: "numeric" })}, ${formatClock(start, timeZone)}`}
            >
              {formatDayISO(getZonedISODate(start, timeZone), { weekday: "short", day: "numeric" })} · {formatClock(start, timeZone)}
              <X className="size-3" strokeWidth={2} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="flex flex-col">
          <span className={meta}>
            {onlyCoach
              ? `${plural(picked.length, onlyCoach.needsRequest ? "request" : "session")} with ${onlyCoach.name.split(" ")[0]}`
              : `${plural(picked.length, "session")} with ${plural(pickedCoachIds.length, "coach", "coaches")}`}
          </span>
          <b className="text-[20px] font-semibold">{money(total)}</b>
        </span>
        <span className="flex gap-2">
          <button type="button" className={textButton} onClick={() => setPicked([])}>
            Clear
          </button>
          <button type="button" className={cn(primaryButton, "h-[40px]")} onClick={() => setReviewOpen(true)}>
            Continue
          </button>
        </span>
      </div>
    </div>
  ) : null;

  const header = (
    <header className="flex flex-col gap-4">
      <div className="flex flex-col gap-[10px]">
        <h1 className="text-[26px] md:text-[32px] font-bold leading-[26px] md:leading-[28px] tracking-[-1.6px] text-[#1A202C]">Book a session</h1>
        <p className="text-[16px] leading-[18px] text-[#767980]">
          {currentMode === "pillar" ? "Pick what to work on, then a coach and your times." : "Pick your coach, then the days and times that work."}
        </p>
      </div>
      <div className={cn(segGroup, "sm:w-[360px]")} role="group" aria-label="How to book">
        <button type="button" className={segButton(currentMode === "coach")} aria-pressed={currentMode === "coach"} onClick={() => switchMode("coach")}>
          <User strokeWidth={1.5} aria-hidden="true" />
          Book with coach
        </button>
        <button type="button" className={segButton(currentMode === "pillar")} aria-pressed={currentMode === "pillar"} onClick={() => switchMode("pillar")}>
          <LayoutGrid strokeWidth={1.5} aria-hidden="true" />
          Book by pillar
        </button>
      </div>
    </header>
  );

  const coachHeader = (coach: BookingCoach, sub: string) => (
    <div className="flex flex-wrap items-center gap-3">
      <Avatar coach={coach} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[20px] font-medium tracking-[-0.04em] text-[#1A202C]">{coach.name}</span>
        <span className={meta}>{sub}</span>
        {coach.groupFrom || coach.hourlyRate ? (
          <span className="flex flex-wrap gap-x-3 text-[12px] text-[#484D56]">
            {coach.groupFrom ? <span className="text-[#117A96]">Group from {money(coach.groupFrom)}</span> : null}
            {coach.hourlyRate ? <span>1-on-1 from {money(coach.hourlyRate)}</span> : null}
          </span>
        ) : null}
      </div>
      <span className="flex flex-wrap items-center gap-2">
        {coach.credits ? (
          <BrandPill tone="green">
            <Ticket className="size-3" strokeWidth={1.5} aria-hidden="true" />
            {plural(coach.credits, "credit")} left
          </BrandPill>
        ) : null}
        <Link to={coachPricingPath(coach.slug || coach.id)} className={cn(secondaryButton, "h-[30px] px-3")}>
          Packages
        </Link>
        <Link to={coachProfilePath(coach.slug || coach.id)} className={textButton}>
          Profile
        </Link>
      </span>
    </div>
  );

  const picker = (coach: BookingCoach, alwaysShowDetails: boolean) => (
    <TimePicker
      key={coach.id}
      coach={coach}
      pillar={currentMode === "pillar" ? pillar : null}
      picked={picked.filter((s) => s.coachId === coach.id)}
      onToggle={toggle(coach)}
      alwaysShowDetails={alwaysShowDetails}
      timeZone={timeZone}
      todayISO={todayISO}
      onRequestTime={() => setRequestCoach(coach)}
      lockedBy={null}
    />
  );

  let content: JSX.Element;
  if (currentMode === "coach") {
    if (myCoachesQuery.isLoading && !selectedCoachId) {
      content = <p className={meta}>Loading your coaches…</p>;
    } else if (!myCoaches.length && !selectedCoach) {
      content = (
        <section className={cn(card, "items-center py-10 text-center")}>
          <CalendarDays className="size-8 text-[#A3A6AB]" strokeWidth={1.5} aria-hidden="true" />
          <b className="text-[18px] font-medium">Find your first coach</b>
          <p className="max-w-[420px] text-[14px] text-[#767980]">
            Once you train with a coach, they show up here and you can book them in a few taps. Or book by pillar to see every coach with open times.
          </p>
          <span className="flex gap-2">
            <button type="button" className={primaryButton} onClick={() => switchMode("pillar")}>
              Book by pillar
            </button>
            <Link to={ROUTES.COACHES} className={secondaryButton}>
              Browse coaches
            </Link>
          </span>
        </section>
      );
    } else {
      const rail = [...myCoaches];
      if (selectedCoach && !rail.some((c) => c.id === selectedCoach.id)) rail.unshift(selectedCoach);
      content = (
        <>
          <section className={card}>
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-[#767980]">Your coaches</span>
              <Link to={ROUTES.COACHES} className={textButton}>
                Find a new coach
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {rail.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={c.id === selectedCoachId}
                  onClick={() => setCoachId(c.id)}
                  className={cn(
                    "flex w-[96px] flex-none flex-col items-center gap-1.5 rounded-[10px] border p-2 text-center",
                    c.id === selectedCoachId ? "border-[#6698D2] bg-[#E5EDF7]" : "border-transparent hover:bg-[#F1F1E6]"
                  )}
                >
                  <span className={cn("rounded-full p-[2px]", c.nextSession ? "ring-2 ring-[#0054B4]" : "ring-2 ring-[#D9D9CF]")}>
                    <Avatar coach={c} size={56} />
                  </span>
                  <b className="text-[13px] font-medium">{c.name.split(" ")[0]}</b>
                  <small className="line-clamp-1 text-[11px] text-[#767980]">{c.specialties[0] ?? (c.isClient ? "Your coach" : "Coach")}</small>
                </button>
              ))}
              <Link to={ROUTES.COACHES} className="flex w-[96px] flex-none flex-col items-center gap-1.5 rounded-[10px] p-2 text-center hover:bg-[#F1F1E6]">
                <span className="flex size-[60px] items-center justify-center rounded-full border border-dashed border-[#C1C1B8] text-[#767980]">
                  <Plus className="size-5" strokeWidth={1.5} aria-hidden="true" />
                </span>
                <b className="text-[13px] font-medium">Add coach</b>
                <small className="text-[11px] text-[#767980]">Browse</small>
              </Link>
            </div>
          </section>
          {selectedCoach ? (
            <div className="flex flex-col gap-4">
              {coachHeader(
                selectedCoach,
                [selectedCoach.specialties.slice(0, 2).join(", "), selectedCoach.locations[0]].filter(Boolean).join(" · ")
              )}
              <PackageSavings coach={selectedCoach} />
              {selectedCoach.nextSession ? (
                <p className="flex items-center gap-2 rounded-[8px] bg-[#E5EDF7] px-3 py-2.5 text-[14px] text-[#0054B4]">
                  <CalendarDays className="size-4" strokeWidth={1.5} aria-hidden="true" />
                  Next session with {selectedCoach.name.split(" ")[0]}: {whenText(selectedCoach.nextSession.date, selectedCoach.nextSession.startTime, timeZone)}
                </p>
              ) : null}
              {picker(selectedCoach, false)}
            </div>
          ) : null}
        </>
      );
    }
  } else if (pillar && pillarCoach) {
    content = (
      <div className="flex flex-col gap-4">
        <button type="button" className={cn(textButton, "self-start text-[#767980]")} onClick={() => setPillarCoachId(null)}>
          <ChevronLeft strokeWidth={1.5} aria-hidden="true" />
          {pillar} coaches
        </button>
        {coachHeader(pillarCoach, [pillar, pillarCoach.locations[0]].filter(Boolean).join(" · "))}
        {picker(pillarCoach, true)}
      </div>
    );
  } else {
    content = (
      <>
        <section className={card}>
          <div className="flex flex-col gap-1">
            <h2 className="text-[20px] font-medium tracking-[-0.04em]">What do you want to work on?</h2>
            <p className={meta}>Pick a pillar to see coaches and their next open times.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {DEFAULT_PILLARS.soccer.map((p) => {
              const Icon = ICON_MAP[p.iconKey];
              const on = pillar === p.title;
              return (
                <button
                  key={p.title}
                  type="button"
                  aria-pressed={on}
                  title={pillarCopy(p.title).blurb}
                  onClick={() => { setPillar(on ? null : p.title); setPillarCoachId(null); }}
                  className={cn(
                    "flex items-center gap-3 rounded-[10px] border p-3 text-left transition-colors",
                    on ? "border-[#6698D2] bg-[#E5EDF7]" : "border-[#EAEADF] bg-[#F4F4EB] hover:bg-[#EAEADF]"
                  )}
                >
                  <span className={cn("flex size-[36px] flex-none items-center justify-center rounded-[8px]", on ? "bg-[#0054B4] text-[#F1F1E6]" : "bg-[#F9F9F5] text-[#0054B4]")}>
                    <Icon className="size-[18px]" strokeWidth={1.5} aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <b className="text-[14px] font-medium">{p.title}</b>
                    <small className="line-clamp-1 text-[12px] text-[#767980]">{pillarCopy(p.title).blurb}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {pillar ? (
          <section className={card}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-[20px] font-medium tracking-[-0.04em]">{pillar} coaches</h2>
                <p className={meta}>
                  {pillarCopy(pillar).blurb}
                  {pillarQuery.data ? ` · ${plural(pillarCoaches.length, "coach", "coaches")}` : ""}
                  {usesPosition ? ` for ${position === "Goalkeeper" ? "goalkeepers" : "field players"}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {usesPosition ? (
                  <div className={segGroup} role="group" aria-label="Position">
                    {["Goalkeeper", "Field player"].map((p) => (
                      <button key={p} type="button" className={segButton(position === p)} aria-pressed={position === p} onClick={() => setPosition(p)}>
                        {p}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className={segGroup} role="group" aria-label="Session type">
                  {(
                    [
                      ["all", "All"],
                      ["group", "Group"],
                      ["individual", "1-on-1"],
                    ] as [BookFormat, string][]
                  ).map(([v, l]) => (
                    <button key={v} type="button" className={segButton(format === v)} aria-pressed={format === v} onClick={() => setFormat(v)}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {pillarQuery.isLoading ? (
              <p className={meta}>Finding coaches…</p>
            ) : pillarCoaches.length ? (
              <div className="flex flex-col divide-y divide-[#EAEADF]">
                {pillarCoaches.map((c) => {
                  const next = format === "group" ? null : c.nextOpen;
                  const group = format === "individual" ? null : c.nextGroup;
                  const nextLine = next && (!group || next.date <= group.date)
                    ? `Next open ${whenText(next.date, next.startTime, timeZone)}`
                    : group
                      ? `Next group ${whenText(group.date, group.startTime, timeZone)} · ${group.spotsLeft} of ${group.capacity} spots left`
                      : null;
                  return (
                    <div key={c.id} className="flex flex-col gap-3 py-4">
                      <div className="flex items-start gap-3">
                        <Avatar coach={c} />
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <b className="text-[16px] font-medium">{c.name}</b>
                            {c.isClient ? (
                              <BrandPill tone="green">Your coach</BrandPill>
                            ) : c.needsRequest ? (
                              <BrandPill tone="amber">
                                <Clock className="size-3" strokeWidth={1.5} aria-hidden="true" />
                                Request to book
                              </BrandPill>
                            ) : (
                              <BrandPill tone="green">
                                <Zap className="size-3" strokeWidth={1.5} aria-hidden="true" />
                                Instant booking
                              </BrandPill>
                            )}
                            {c.credits ? <BrandPill tone="green">{plural(c.credits, "credit")} left</BrandPill> : null}
                          </span>
                          <span className="flex flex-wrap gap-3 text-[12px] text-[#484D56]">
                            {c.groupFrom != null ? (
                              <span className="flex items-center gap-1 text-[#117A96]">
                                <Users className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                                Group from {money(c.groupFrom)}
                              </span>
                            ) : null}
                            {c.oneOnOneFrom != null || c.hourlyRate ? (
                              <span className="flex items-center gap-1">
                                <User className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                                1-on-1 from {money(c.oneOnOneFrom ?? c.hourlyRate!)}
                              </span>
                            ) : null}
                          </span>
                          <span className={meta}>{[c.specialties.slice(0, 2).join(", "), c.locations[0]].filter(Boolean).join(" · ")}</span>
                        </div>
                        {c.totalReviews ? (
                          <span className="flex flex-none items-center gap-1 text-[14px]">
                            <Star className="size-4 fill-[#E7DF3E] text-[#B9B232]" strokeWidth={1.5} aria-hidden="true" />
                            {c.rating ? c.rating.toFixed(1) : "New"}
                            <span className="text-[12px] text-[#767980]">{c.totalReviews}</span>
                          </span>
                        ) : null}
                      </div>
                      <p className="flex items-center gap-2 text-[14px] text-[#484D56]">
                        <CalendarDays className="size-4 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
                        {nextLine ?? "No open times in the next 4 weeks"}
                      </p>
                      <div className="flex gap-2">
                        {nextLine ? (
                          <button type="button" className={primaryButton} onClick={() => setPillarCoachId(c.id)}>
                            Pick a time
                            <ChevronRight strokeWidth={1.5} aria-hidden="true" />
                          </button>
                        ) : (
                          <button type="button" className={primaryButton} onClick={() => setRequestCoach(c)}>
                            Request a time
                          </button>
                        )}
                        <Link to={coachProfilePath(c.slug || c.id)} className={secondaryButton}>
                          View profile
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <b className="text-[16px] font-medium">
                  No {usesPosition ? (position === "Goalkeeper" ? "goalkeeper " : "field player ") : ""}coaches for {pillar} yet
                </b>
                <p className={meta}>
                  {usesPosition ? "Try the other position, or browse every coach on AthaNext." : "Browse every coach on AthaNext."}
                </p>
                <Link to={ROUTES.COACHES} className={secondaryButton}>
                  Browse coaches
                </Link>
              </div>
            )}
          </section>
        ) : null}
      </>
    );
  }

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5">
        {header}
        {content}
        {pickBar}
      </div>
      <ReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        coaches={pickedCoaches}
        picked={picked}
        pillar={currentMode === "pillar" ? pillar : null}
        athleteId={athleteId}
        timeZone={timeZone}
        onRemove={(s) => {
          untoggle(s);
          if (picked.length <= 1) setReviewOpen(false);
        }}
        onBooked={() => {
          setPicked([]);
          setReviewOpen(false);
        }}
      />
      <RequestTimeDialog
        coach={requestCoach}
        pillar={currentMode === "pillar" ? pillar : null}
        todayISO={todayISO}
        timeZone={timeZone}
        onClose={() => setRequestCoach(null)}
      />
    </div>
  );
};

export default BookSessionPage;
