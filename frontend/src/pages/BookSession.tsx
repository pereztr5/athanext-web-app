/**
 * Book a Session (ATH-73, ATH-94): book with a coach the family already trains with, or book
 * by pillar. Pick several times across days and coaches; Review and pay books them in one go.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Plus,
  Search,
  Star,
  Ticket,
  User,
  Users,
  Clock,
  Zap,
} from "@/components/icons";
import { BrandPill } from "@/components/brand";
import { bookAPI, type BookableSession, type BookingCoach } from "@/api/book";
import { MobilePayBar, PickBar, PickFoot } from "@/components/book/BookBars";
import { RequestTimeDialog, ReviewDialog } from "@/components/book/BookDialogs";
import { BookingSummary } from "@/components/book/BookingSummary";
import { BuyPackagesDialog } from "@/components/book/BuyPackagesDialog";
import { PackageSavings } from "@/components/book/PackageSavings";
import { RenewingPackages } from "@/components/book/RenewingPackages";
import { TimePicker } from "@/components/book/TimePicker";
import { card, meta, primaryButton, secondaryButton, segButton, segGroup, smallButton, textButton } from "@/components/schedule/styles";
import { PageHeader } from "@/components/ui/page-header";
import { useProfile } from "@/contexts/ProfileContext";
import { useBookingFees } from "@/hooks/useBookingFees";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRole } from "@/hooks/useRole";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { NO_POSITION_PILLARS, money, pillarCopy, type BookFormat } from "@/utils/booking";
import { planBooking } from "@/utils/bookPlan";
import { coachProfilePath } from "@/utils/coachSlug";
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
    className={cn(
      "flex flex-none items-center justify-center overflow-hidden rounded-full bg-light-550 text-dark-300",
      size >= 48 ? "text-subtitle" : "text-label-sm"
    )}
    style={{ width: size, height: size }}
    aria-hidden="true"
  >
    {coach.imageUrl ? <img src={coach.imageUrl} alt="" className="size-full object-cover" /> : initials(coach.name)}
  </span>
);

const whenText = (date: string, startTime: string, timeZone: string) => {
  const start = zonedWallTimeToUtc(date, startTime) ?? new Date(NaN);
  return `${formatDayISO(getZonedISODate(start, timeZone), { weekday: "short", month: "short", day: "numeric" })}, ${formatClock(start, timeZone)}`;
};

const BookSessionPage = () => {
  const { isCoach, ready } = useRole();
  const { profile } = useProfile();
  const isMobile = useIsMobile();
  const timeZone = useViewerTimeZone();
  const [searchParams] = useSearchParams();
  const todayISO = isoDateInZone(new Date(), timeZone);
  const athleteId =
    profile?.type === PROFILE_TYPE.athlete && profile?.data ? ((profile.data as { id?: string }).id ?? null) : null;
  const athleteData = profile?.type === PROFILE_TYPE.athlete && profile?.data ? (profile.data as { position?: string; full_name?: string; first_name?: string }) : null;
  const athletePosition = athleteData?.position ?? "";
  const athleteFirst = athleteData?.first_name || athleteData?.full_name?.split(" ")[0] || null;

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
  const [pillarOf, setPillarOf] = useState<Record<string, string>>({});
  const [useCredits, setUseCredits] = useState(true);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [requestCoach, setRequestCoach] = useState<BookingCoach | null>(null);
  const [packagesCoach, setPackagesCoach] = useState<BookingCoach | null>(null);
  const fees = useBookingFees(athleteId);

  useEffect(() => {
    if (/keeper/i.test(athletePosition)) setPosition("Goalkeeper");
  }, [athletePosition]);

  const currentMode: Mode = mode ?? (linkedCoachId || myCoaches.length || myCoachesQuery.isLoading ? "coach" : "pillar");
  const defaultCoach = myCoaches.find((c) => c.credits > 0) ?? myCoaches[0];
  const selectedCoachId = coachId ?? defaultCoach?.id ?? null;

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

  const sortedPicked = useMemo(
    () => [...picked].sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)),
    [picked]
  );
  const plan = planBooking(sortedPicked, pickedCoaches, useCredits, fees);

  if (!ready) return null;
  if (isCoach) return <Navigate to={ROUTES.SCHEDULE} replace />;

  const toggle = (coach: BookingCoach) => (session: BookableSession) => {
    setPickedCoaches((cur) => ({ ...cur, [coach.id]: coach }));
    setPicked((cur) => {
      if (cur.some((s) => s.id === session.id)) {
        setPillarOf((map) => {
          const next = { ...map };
          delete next[session.id];
          return next;
        });
        return cur.filter((s) => s.id !== session.id);
      }
      if (currentMode === "pillar" && pillar) setPillarOf((map) => ({ ...map, [session.id]: pillar }));
      return [...cur, session];
    });
  };
  const untoggle = (session: BookableSession) => {
    setPicked((cur) => cur.filter((s) => s.id !== session.id));
    setPillarOf((map) => {
      const next = { ...map };
      delete next[session.id];
      return next;
    });
  };
  const switchMode = (next: Mode) => {
    setMode(next);
    setPillarCoachId(null);
  };
  const openReview = () => setReviewOpen(true);

  const pickingTimes = (currentMode === "coach" && Boolean(selectedCoach)) || Boolean(pillar && pillarCoach);

  const coachHeader = (coach: BookingCoach, sub: string) => (
    <div className="flex flex-wrap items-center gap-3">
      <Avatar coach={coach} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-card-title text-dark">{coach.name}</span>
        <span className="text-body-m text-dark-300">{sub}</span>
        {coach.groupFrom || coach.hourlyRate ? (
          <span className="flex flex-wrap gap-x-3 text-body-m text-dark-300">
            {coach.groupFrom ? (
              <span className="inline-flex items-center gap-1 text-secondary-700">
                <Users className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                Group from {money(coach.groupFrom)}
              </span>
            ) : null}
            {coach.hourlyRate ? (
              <span className="inline-flex items-center gap-1">
                <User className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                1-on-1 from {money(coach.hourlyRate)}
              </span>
            ) : null}
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
        <button type="button" className={cn(secondaryButton, smallButton)} onClick={() => setPackagesCoach(coach)}>
          Packages
        </button>
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
      fees={fees}
      useCredits={useCredits}
      athleteFirst={athleteFirst}
      footer={<PickFoot plan={plan} count={picked.length} onContinue={openReview} />}
    />
  );

  const summary = (
    <BookingSummary
      picked={sortedPicked}
      coaches={pickedCoaches}
      plan={plan}
      pillarOf={pillarOf}
      timeZone={timeZone}
      useCredits={useCredits}
      onUseCreditsChange={setUseCredits}
      onRemove={untoggle}
      onClear={() => {
        setPicked([]);
        setPillarOf({});
      }}
      onReview={openReview}
    />
  );

  const twoCol = (left: JSX.Element) => (
    <div className="flex items-start gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-6">{left}</div>
      <aside className="sticky top-16 hidden w-[340px] flex-none min-[1400px]:block">{summary}</aside>
    </div>
  );

  let content: JSX.Element;
  if (currentMode === "coach") {
    if (myCoachesQuery.isLoading && !selectedCoachId) {
      content = <p className={meta}>Loading your coaches…</p>;
    } else if (!myCoaches.length && !selectedCoach) {
      content = (
        <section className={cn(card, "items-center py-10 text-center")}>
          <Search className="size-6 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
          <b className="text-card-title">Find your first coach</b>
          <p className="max-w-[420px] text-body-m text-dark-300">
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
      content = twoCol(
        <>
          <section className={card}>
            <div className="flex items-center justify-between">
              <span className="text-label-xsm text-dark-300">Your coaches</span>
              <Link to={ROUTES.COACHES} className={textButton}>
                Find a new coach
              </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-1">
              {rail.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={c.id === selectedCoachId}
                  onClick={() => setCoachId(c.id)}
                  className="flex w-24 flex-none flex-col items-center gap-2 text-center"
                >
                  <span className={cn("rounded-full border-2 p-[3px]", c.id === selectedCoachId ? "border-primary" : "border-transparent")}>
                    <Avatar coach={c} size={60} />
                  </span>
                  <b className="text-label-sm">{c.name.split(" ")[0]}</b>
                  <small className="line-clamp-1 text-caption text-dark-300">{c.specialties[0] ?? (c.isClient ? "Your coach" : "Coach")}</small>
                </button>
              ))}
              <Link to={ROUTES.COACHES} className="flex w-24 flex-none flex-col items-center gap-2 text-center">
                <span className="flex size-[60px] items-center justify-center rounded-full border border-dashed border-light-600 text-dark-300">
                  <Plus className="size-5" strokeWidth={1.5} aria-hidden="true" />
                </span>
                <b className="text-label-sm">Find a new coach</b>
              </Link>
            </div>
          </section>
          {selectedCoach ? (
            <div className="flex flex-col gap-4">
              {coachHeader(
                selectedCoach,
                [selectedCoach.specialties.slice(0, 2).join(", "), "60 min", selectedCoach.locations[0]].filter(Boolean).join(" · ")
              )}
              {!isMobile ? <PackageSavings coach={selectedCoach} onOpen={() => setPackagesCoach(selectedCoach)} /> : null}
              <RenewingPackages />
              {!isMobile && selectedCoach.nextSession ? (
                <p className="flex items-start gap-2.5 rounded-control bg-light-400 px-3.5 py-3 text-caption text-dark-300">
                  <CalendarCheck className="size-4 flex-none" strokeWidth={1.5} aria-hidden="true" />
                  Next session with {selectedCoach.name.split(" ")[0]}: {whenText(selectedCoach.nextSession.date, selectedCoach.nextSession.startTime, timeZone)}.
                </p>
              ) : null}
              {picker(selectedCoach, false)}
            </div>
          ) : null}
        </>
      );
    }
  } else if (pillar && pillarCoach) {
    content = twoCol(
      <div className="flex flex-col gap-4">
        <button type="button" className={cn(textButton, "-mb-3 self-start text-dark-300")} onClick={() => setPillarCoachId(null)}>
          <ChevronLeft strokeWidth={1.5} aria-hidden="true" />
          {pillar} coaches
        </button>
        {coachHeader(pillarCoach, [pillar, "60 min", pillarCoach.locations[0]].filter(Boolean).join(" · "))}
        {picker(pillarCoach, true)}
      </div>
    );
  } else {
    content = twoCol(
      <>
        <section className={cn(card, !pillar && "min-h-0 flex-1")}>
          <div className="flex flex-col gap-1">
            <h2 className="text-card-title">What do you want to work on?</h2>
            <p className="text-body-m text-dark-300">Pick a pillar to see coaches and their next open times.</p>
          </div>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
            {DEFAULT_PILLARS.soccer.map((p) => {
              const Icon = ICON_MAP[p.iconKey];
              const on = pillar === p.title;
              return (
                <button
                  key={p.title}
                  type="button"
                  aria-pressed={on}
                  title={pillarCopy(p.title).blurb}
                  onClick={() => {
                    setPillar(on ? null : p.title);
                    setPillarCoachId(null);
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-control border px-3.5 py-3 text-left transition-colors max-md:flex-col max-md:items-start max-md:gap-2",
                    on ? "border-primary bg-primary-50" : "border-light-525 bg-light-400 hover:border-primary-300"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-[34px] flex-none items-center justify-center rounded-full border",
                      on ? "border-primary-200 bg-light-300 text-primary" : "border-light-525 bg-light-300 text-dark"
                    )}
                  >
                    <Icon className="size-[17px]" strokeWidth={1.5} aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <b className="text-label-sm">{p.title}</b>
                    <small className="mt-0.5 text-caption text-dark-300">{pillarCopy(p.title).blurb}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {pillar ? (
          <section className="flex items-center gap-3 rounded-card border border-light-525 bg-light-300 px-3.5 py-3 md:hidden">
            <span className="flex size-9 flex-none items-center justify-center rounded-full border border-primary-200 bg-light-300 text-primary">
              {(() => {
                const Icon = ICON_MAP[DEFAULT_PILLARS.soccer.find((p) => p.title === pillar)?.iconKey ?? "activity"];
                return <Icon className="size-[18px]" strokeWidth={1.5} aria-hidden="true" />;
              })()}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <b className="text-label-sm">{pillar}</b>
              <small className="text-caption text-dark-300">{pillarQuery.data ? plural(pillarCoaches.length, "coach", "coaches") : "Coaches"}</small>
            </span>
            <button type="button" className={cn(secondaryButton, smallButton)} onClick={() => { setPillar(null); setPillarCoachId(null); }}>
              Change
            </button>
          </section>
        ) : null}

        {pillar ? (
          <section className={card}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-card-title">{pillar} coaches</h2>
                <p className="text-body-m text-dark-300">
                  {pillarCopy(pillar).blurb}
                  {pillarQuery.data ? ` · ${plural(pillarCoaches.length, "coach", "coaches")}` : ""}
                  {usesPosition ? ` for ${position === "Goalkeeper" ? "goalkeepers" : "field players"}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {usesPosition ? (
                  <div className={cn(segGroup, "w-fit")} role="group" aria-label="Position">
                    {["Goalkeeper", "Field player"].map((p) => (
                      <button key={p} type="button" className={cn(segButton(position === p), "flex-none")} aria-pressed={position === p} onClick={() => setPosition(p)}>
                        {p}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className={cn(segGroup, "w-fit")} role="group" aria-label="Session type">
                  {(
                    [
                      ["all", "All"],
                      ["group", "Group"],
                      ["individual", "1-on-1"],
                    ] as [BookFormat, string][]
                  ).map(([v, l]) => (
                    <button key={v} type="button" className={cn(segButton(format === v), "flex-none")} aria-pressed={format === v} onClick={() => setFormat(v)}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {pillarQuery.isLoading ? (
              <p className={meta}>Finding coaches…</p>
            ) : pillarCoaches.length ? (
              <div className="flex flex-col divide-y divide-light-525">
                {pillarCoaches.map((c) => {
                  const next = format === "group" ? null : c.nextOpen;
                  const group = format === "individual" ? null : c.nextGroup;
                  const nextLine =
                    next && (!group || next.date <= group.date)
                      ? { kind: "open" as const, when: whenText(next.date, next.startTime, timeZone) }
                      : group
                        ? { kind: "group" as const, when: whenText(group.date, group.startTime, timeZone), spots: `${group.spotsLeft} of ${group.capacity} spots left` }
                        : null;
                  return (
                    <div key={c.id} className="flex flex-col gap-3 py-4">
                      <div className="flex items-start gap-3">
                        <Avatar coach={c} />
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <b className="text-subtitle">{c.name}</b>
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
                          <span className="flex flex-wrap gap-3 text-body-m text-dark-300">
                            {c.groupFrom != null ? (
                              <span className="flex items-center gap-1 text-secondary-700">
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
                          <span className={meta}>
                            {[c.specialties.slice(0, 2).join(", ") || null, "60 min", c.locations[0]].filter(Boolean).join(" · ")}
                          </span>
                        </div>
                        {c.totalReviews ? (
                          <span className="flex flex-none items-center gap-1 text-body-m">
                            <Star className="size-4 fill-rating text-rating-600" strokeWidth={1.5} aria-hidden="true" />
                            {c.rating ? c.rating.toFixed(1) : "New"}
                            <span className="text-caption text-dark-300">{c.totalReviews}</span>
                          </span>
                        ) : null}
                      </div>
                      <p className="flex items-center gap-2 rounded-control bg-light-400 px-3 py-2 text-body-m text-dark-300">
                        <CalendarDays className="size-4 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
                        {nextLine ? (
                          <span>
                            Next {nextLine.kind === "group" ? "group" : "open"} <b>{nextLine.when}</b>
                            {nextLine.kind === "group" ? ` · ${nextLine.spots}` : ""}
                          </span>
                        ) : (
                          "No open times in the next 4 weeks"
                        )}
                      </p>
                      <div className="flex gap-2">
                        {nextLine ? (
                          <button type="button" className={cn(primaryButton, "max-md:h-11")} onClick={() => setPillarCoachId(c.id)}>
                            Pick a time
                            <ChevronRight strokeWidth={1.5} aria-hidden="true" />
                          </button>
                        ) : (
                          <button type="button" className={cn(primaryButton, "max-md:h-11")} onClick={() => setRequestCoach(c)}>
                            Request a time
                          </button>
                        )}
                        <Link to={coachProfilePath(c.slug || c.id)} className={cn(secondaryButton, "max-md:h-11")}>
                          View profile
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Search className="size-6 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
                <b className="text-subtitle">
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
    <div
      className={cn(
        "overflow-x-clip px-4 pb-8 pt-1 md:px-5 md:pb-12",
        sortedPicked.length > 0 && "max-[820px]:pb-[180px]"
      )}
    >
      <div className="mx-auto flex w-full max-w-wrapper flex-col gap-5">
        <div className="flex flex-col gap-4">
          <PageHeader
            title="Book a session"
            subtitle={currentMode === "pillar" ? "Pick what to work on, then a coach and your times." : "Pick your coach, then the days and times that work."}
          />
          <div className={cn(segGroup, "-mt-2 w-fit")} role="group" aria-label="How to book">
            <button type="button" className={cn(segButton(currentMode === "coach"), "flex-none")} aria-pressed={currentMode === "coach"} onClick={() => switchMode("coach")}>
              <User strokeWidth={1.5} aria-hidden="true" />
              Book with coach
            </button>
            <button type="button" className={cn(segButton(currentMode === "pillar"), "flex-none")} aria-pressed={currentMode === "pillar"} onClick={() => switchMode("pillar")}>
              <LayoutGrid strokeWidth={1.5} aria-hidden="true" />
              Book by pillar
            </button>
          </div>
        </div>
        {content}
      </div>
      <PickBar picked={sortedPicked} coaches={pickedCoaches} plan={plan} timeZone={timeZone} onRemove={untoggle} onContinue={openReview} />
      <MobilePayBar plan={plan} count={picked.length} onPhone={!pickingTimes} onReview={openReview} />
      <ReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        coaches={pickedCoaches}
        picked={sortedPicked}
        pillar={currentMode === "pillar" ? pillar : null}
        athleteId={athleteId}
        timeZone={timeZone}
        useCredits={useCredits}
        onUseCreditsChange={setUseCredits}
        onRemove={(s) => {
          untoggle(s);
          if (picked.length <= 1) setReviewOpen(false);
        }}
        onBooked={() => {
          setPicked([]);
          setPillarOf({});
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
      <BuyPackagesDialog coach={packagesCoach} onClose={() => setPackagesCoach(null)} />
    </div>
  );
};

export default BookSessionPage;
