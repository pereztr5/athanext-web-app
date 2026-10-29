/**
 * The athlete's page for one session (ATH-97), with the same date-card header coaches see.
 * Message opens the thread with this coach. Upcoming paid sessions can move onto another
 * open time. A request is withdrawn, not cancelled. Camp days come with the camp sign-up: no
 * pay, cancel or reschedule here; the coach manages them, and the camp page has the details.
 */
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, CalendarSync, ChevronLeft, ChevronRight, Clock, CreditCard, Info, MapPin, MessageCircle, Repeat, Star, Ticket, Users, Video } from "@/components/icons";
import { BrandPill } from "@/components/brand";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RESCHEDULABLE_PAYMENTS, athleteSessionAPI } from "@/api/athleteSession";
import { startOccurrenceCheckout } from "@/api/bookings";
import { getMeetingUrl } from "@/api/meetingLinks";
import { InfoBox } from "@/components/book/checkoutParts";
import { RescheduleDialog } from "@/components/athlete-session/RescheduleDialog";
import { SessionHeader } from "@/components/session/SessionHeader";
import { ReportIssueButton, ReportIssueDialog } from "@/components/session/ReportIssueDialog";
import { card, dangerButton, dangerTextButton, dialogContent, input, label, meta, primaryButton, secondaryButton, textButton, textPanel } from "@/components/schedule/styles";
import { buildIcs, downloadIcs } from "@/utils/ics";
import { scoreWord } from "@/utils/feedback";
import { useProfile } from "@/contexts/ProfileContext";
import { useStartCoachChat } from "@/hooks/useStartCoachChat";
import { useToast } from "@/hooks/use-toast";
import { useBack } from "@/hooks/useBack";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { coachProfilePath } from "@/utils/coachSlug";
import { getZonedISODate } from "@/utils/dateHelpers";
import { formatClock, formatDayISO, plural, sessionEnd, sessionStart } from "@/utils/schedule";
import { formatSessionSpan, sessionDisplayZone } from "@/utils/viewerTime";
import { helpLinkFrom } from "@/utils/helpBack";
import { campDayTitle, campSignedUpLine } from "@/utils/campSessions";
import { campPath } from "@/utils/camps";

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

const AthleteSessionPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { back } = useBack(ROUTES.MY_SESSIONS);
  const { toast } = useToast();
  const timeZone = useViewerTimeZone();
  const { profile } = useProfile();
  const { start: startChat, starting: chatting } = useStartCoachChat();
  const athleteId = profile?.userProfile?.athlete_id ?? "";
  const query = useQuery({ queryKey: ["athlete-session", id], enabled: Boolean(id), queryFn: () => athleteSessionAPI.get(id!) });
  const s = query.data;
  const meeting = useQuery({
    queryKey: ["meeting-link", s?.coach.id],
    enabled: s?.location === "online" && Boolean(s?.coach.id),
    queryFn: () => getMeetingUrl(s!.coach.id),
  });

  const queryClient = useQueryClient();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [reporting, setReporting] = useState(false);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["athlete-session", id] });
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
    queryClient.invalidateQueries({ queryKey: ["my-coaches"] });
    queryClient.invalidateQueries({ queryKey: ["bookable-sessions"] });
  };

  const cancel = useMutation({
    mutationFn: () => athleteSessionAPI.cancel(s!.booking.id, cancelReason),
    onSuccess: ({ credit }) => {
      setConfirmCancel(false);
      toast({
        title: "Session cancelled",
        description: credit ? `It's back as a credit with ${s!.coach.name.split(" ")[0]} for 90 days.` : undefined,
      });
      refresh();
    },
    onError: (err: unknown) =>
      toast({ title: "Couldn't cancel", description: err instanceof Error ? err.message : undefined, variant: "destructive" }),
  });

  const withdraw = useMutation({
    mutationFn: () => {
      const when = formatDayISO(
        getZonedISODate(sessionStart({ date: s!.date, startTime: s!.startTime }), timeZone),
        { weekday: "short", month: "short", day: "numeric" }
      );
      return athleteSessionAPI.withdraw(s!.booking.id, s!.coach.id, s!.coach.name, when);
    },
    onSuccess: ({ told }) => {
      setConfirmWithdraw(false);
      toast({
        title: "Request withdrawn",
        description: told ? `${s!.coach.name.split(" ")[0]} was told in Messages.` : "The coach could not be messaged.",
      });
      refresh();
    },
    onError: (err: unknown) =>
      toast({ title: "Couldn't withdraw", description: err instanceof Error ? err.message : undefined, variant: "destructive" }),
  });

  const pay = useMutation({
    mutationFn: () => startOccurrenceCheckout(s!.id, athleteId),
    onSuccess: ({ redirected }) => {
      if (redirected) return;
      toast({ title: "You're booked", description: "Nothing was due by card for this session." });
      refresh();
    },
    onError: (err: unknown) =>
      toast({ title: "Couldn't open checkout", description: err instanceof Error ? err.message : undefined, variant: "destructive" }),
  });

  if (query.isLoading) return <div className="px-4 py-10 md:px-5"><p className={meta}>Loading…</p></div>;
  if (!s) {
    return (
      <div className="mx-auto flex max-w-wrapper-focused flex-col items-center gap-3 px-4 py-16 text-center">
        <h1 className="text-section text-dark">Session not found</h1>
        <Link to={ROUTES.MY_SESSIONS} className={secondaryButton}>Back to my sessions</Link>
      </div>
    );
  }

  const start = sessionStart({ date: s.date, startTime: s.startTime });
  const end = sessionEnd({ date: s.date, endTime: s.endTime });
  const group = s.sessionType === "group";
  const status = s.booking.status;
  const cancelled = status === "canceled" || status === "refunded";
  const coachFirst = s.coach.name.split(" ")[0] || s.coach.name;
  const camp = s.camp;
  const campPage = camp?.slug && s.coach.slug ? campPath(s.coach.slug, camp.slug) : null;
  const title = camp
    ? campDayTitle(camp.name, camp.dayIndex)
    : group
      ? s.sessionName || "Group session"
      : `${s.pillar || "1-on-1"} with ${s.coach.name}`;
  const noticeHours = s.cancelNoticeHours;
  const late = start.getTime() - Date.now() < noticeHours * 3600 * 1000;
  const freeUntil = new Date(start.getTime() - noticeHours * 3600 * 1000);
  const upcoming = !cancelled && !s.ended && !s.started && status === "booked";
  const requested = !cancelled && !s.started && status === "requested";
  const canReschedule = upcoming && !camp && !late && RESCHEDULABLE_PAYMENTS.has(s.booking.paymentStatus);
  const where = s.location === "online" ? "Video call" : s.place || "In person";
  const missed = s.ended && s.attendance && s.attendance !== "present";
  const dayLabel = formatDayISO(getZonedISODate(start, sessionDisplayZone(timeZone, Boolean(camp))), { weekday: "short", month: "short", day: "numeric" });
  const campLine = camp ? campSignedUpLine(camp, formatSessionSpan(start, end, timeZone, true)) : null;

  const statusPill = cancelled ? (
    <BrandPill tone="amber">Cancelled</BrandPill>
  ) : requested ? (
    <BrandPill tone="amber">{`Request, waiting for ${coachFirst}`}</BrandPill>
  ) : status === "pending_payment" ? (
    <BrandPill tone="amber">Payment due</BrandPill>
  ) : missed ? (
    <BrandPill tone="amber">Missed</BrandPill>
  ) : s.ended ? (
    <BrandPill tone="sunk">Completed</BrandPill>
  ) : s.started ? (
    <BrandPill tone="blue">Happening now</BrandPill>
  ) : (
    <BrandPill tone="green">Confirmed</BrandPill>
  );

  const payLine = cancelled
    ? s.booking.cancellationReason || "Cancelled"
    : camp
      ? `Part of ${camp.name}`
    : s.booking.paymentStatus === "pending_offline"
      ? `Pending until ${coachFirst} confirms receipt, ${money(s.price)}${s.coach.payNote ? `. ${s.coach.payNote}` : ""}`
      : s.booking.paymentStatus === "direct"
      ? `Pay ${coachFirst} directly, ${money(s.price)}${s.coach.payNote ? `. ${s.coach.payNote}` : ""}`
      : status === "requested"
        ? s.coach.paysDirect
          ? `Waiting for ${coachFirst} to accept. You pay them directly.`
          : `Waiting for ${coachFirst} to accept. You're only charged if they do.`
        : status === "pending_payment"
          ? `${money(s.price)} due to confirm your spot`
          : s.booking.paymentStatus === "credit"
            ? "Paid with a credit"
          : s.booking.paymentStatus === "outside"
            ? s.price > 0
              ? "Paid outside AthaNext"
              : "Free session"
          : s.booking.paymentStatus === "paid"
            ? s.booking.paidAmount
              ? `Paid ${money(s.booking.paidAmount)} by card`
              : "Paid"
            : s.booking.paymentStatus === "refunded"
              ? "Refunded"
              : "Not paid yet";

  const fact = (Icon: typeof Clock, a: string, b?: string | null, right?: JSX.Element | null) => (
    <div className="flex items-start gap-3 py-3">
      <Icon className="mt-[2px] size-4 flex-none text-dark-300" strokeWidth={1.5} aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b className="text-label-sm">{a}</b>
        {b ? <span className={meta}>{b}</span> : null}
      </span>
      {right}
    </div>
  );

  const addToCalendar = () => {
    downloadIcs(
      title,
      buildIcs([
        {
          uid: `${s.id}@athanext`,
          title,
          start,
          end,
          location: where,
          description: `${title} with ${s.coach.name}`,
        },
      ])
    );
  };

  const actions = (
    <>
      <button type="button" className={secondaryButton} disabled={chatting} onClick={() => startChat(s.coach.id, s.coach.name)}>
        <MessageCircle strokeWidth={1.5} aria-hidden="true" />
        Message
      </button>
      {canReschedule ? (
        <button type="button" className={secondaryButton} onClick={() => setRescheduleOpen(true)}>
          <CalendarSync strokeWidth={1.5} aria-hidden="true" />
          Reschedule
        </button>
      ) : null}
      {upcoming ? (
        <button type="button" className={secondaryButton} onClick={addToCalendar}>
          <CalendarPlus strokeWidth={1.5} aria-hidden="true" />
          Add to calendar
        </button>
      ) : null}
      {requested ? (
        <button type="button" className={dangerTextButton} onClick={() => setConfirmWithdraw(true)}>
          Withdraw request
        </button>
      ) : null}
      {!camp && !cancelled && !s.started && (status === "booked" || status === "pending_payment") ? (
        <button type="button" className={dangerTextButton} onClick={() => setConfirmCancel(true)}>
          Cancel session
        </button>
      ) : null}
      {s.ended && !cancelled ? (
        <button type="button" className={secondaryButton} onClick={() => navigate(`${ROUTES.MY_SESSIONS}?rate=${s.id}`)}>
          <Star strokeWidth={1.5} aria-hidden="true" />
          Rate session
        </button>
      ) : null}
      {s.ended && !cancelled && !camp ? (
        <Link to={`${ROUTES.BOOK}?coach=${s.coach.id}`} className={primaryButton}>
          <Repeat strokeWidth={1.5} aria-hidden="true" />
          Book again
        </Link>
      ) : null}
      {status === "pending_payment" && !s.started && !camp ? (
        <button type="button" className={primaryButton} disabled={pay.isPending} onClick={() => pay.mutate()}>
          <CreditCard strokeWidth={1.5} aria-hidden="true" />
          {pay.isPending ? "Opening checkout…" : `Pay ${money(s.price)}`}
        </button>
      ) : null}
    </>
  );

  return (
    <div className="px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-wrapper flex-col gap-4 md:gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" className={cn(buttonVariants({ variant: "back" }), "self-start")} onClick={back}>
            <ChevronLeft strokeWidth={1.5} aria-hidden="true" />
            Back
          </button>
          <div className="hidden flex-wrap items-center justify-end gap-2 md:flex">{actions}</div>
        </div>

        <h1 className="sr-only">{title}</h1>
        <SessionHeader
          timeZone={timeZone}
          campClock={Boolean(camp)}
          session={{
            title,
            sessionType: s.sessionType,
            pillar: s.pillar,
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            location: s.location === "online" ? "online" : "in-person",
            place: s.place,
            statusPills: statusPill,
            people: [{ name: s.coach.name, imageUrl: s.coach.photo, line: "Coach" }],
            peopleLabel: group ? `${s.coach.name}, coach` : undefined,
          }}
        />

        <div className="grid grid-cols-1 items-start gap-4 md:gap-6 lg:grid-cols-[minmax(0,1fr)_317px]">
          <div className="flex flex-col gap-4 md:gap-6">
            <section className={cn(card, "gap-0 divide-y divide-light-525 py-2")}>
              {s.location === "online"
                ? fact(
                    Video,
                    "Video call",
                    meeting.data ? "The link for this session" : "Your coach hasn't added a video link yet",
                    meeting.data ? (
                      <a className={cn(textButton, "text-caption")} href={meeting.data} target="_blank" rel="noreferrer">
                        Join
                      </a>
                    ) : null
                  )
                : fact(
                    MapPin,
                    where,
                    null,
                    s.place ? (
                      <a className={cn(textButton, "text-caption")} href={`https://www.google.com/maps/search/${encodeURIComponent(s.place)}`} target="_blank" rel="noreferrer">
                        Directions
                      </a>
                    ) : null
                  )}
              {fact(Ticket, s.booking.paymentStatus === "credit" ? "Package credit" : payLine)}
              {fact(Clock, "Duration", `${s.durationMinutes} minutes`)}
              {fact(Users, "Session type", s.pillar || (group ? "Group" : "1-on-1"))}
              {campLine
                ? fact(Users, campLine.title, campLine.detail)
                : group ? fact(Users, `${plural(s.taken, "athlete")} booked`, `${s.capacity - s.taken > 0 ? plural(s.capacity - s.taken, "spot") + " left" : "Full"}. Other athletes stay private.`) : null}
              <Link to={coachProfilePath(s.coach.slug || s.coach.id)} className="flex items-center gap-3 py-3 hover:bg-light-400">
                <span className="flex size-[36px] items-center justify-center overflow-hidden rounded-full border border-light-550 bg-primary-50 text-label-xsm text-primary">
                  {s.coach.photo ? <img src={s.coach.photo} alt="" className="size-full object-cover" /> : s.coach.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="text-label-sm">{s.coach.name}</b>
                  <span className={meta}>Coach</span>
                </span>
                <ChevronRight className="size-4 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
              </Link>
              {camp && !cancelled ? (
                <p className={cn(meta, "py-3")}>
                  Camp sessions are managed by your coach. To change or cancel, message {coachFirst}.{" "}
                  {campPage ? (
                    <Link to={campPage} className={cn(textButton, "inline")}>
                      View the camp
                    </Link>
                  ) : null}
                </p>
              ) : upcoming ? (
                <p className={cn(meta, "py-3")}>
                  {late
                    ? `Less than ${plural(noticeHours, "hour")} away. Cancelling now is not refunded.`
                    : `Free cancellation until ${formatClock(freeUntil, timeZone)} on ${formatDayISO(getZonedISODate(freeUntil, timeZone), { weekday: "short", month: "short", day: "numeric" })}. The session comes back as a credit.`}
                </p>
              ) : null}
            </section>

            {s.ended && !cancelled ? (
              <section className={card}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-card-title">{missed ? "Missed session" : "Feedback"}</h2>
                  {!missed && s.score ? (
                    <span className="text-label-sm text-primary">
                      <b className="text-card-title">{s.score}</b>/10 · {scoreWord(s.score)}
                    </span>
                  ) : null}
                </div>
                {missed ? (
                  <p className={meta}>{s.missedMessage ?? `${coachFirst} marked this session as missed.`}</p>
                ) : s.summary || s.note ? (
                  <>
                    {s.summary ? <p className={cn(textPanel, "whitespace-pre-line text-paragraph text-dark")}>{s.summary}</p> : null}
                    {s.note ? (
                      <div className="flex flex-col gap-1 rounded-control bg-light px-3 py-2.5">
                        <span className={meta}>Just for you</span>
                        <p className="whitespace-pre-line text-paragraph text-dark">{s.note}</p>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className={meta}>{coachFirst} usually shares notes within a day. You'll get a notification.</p>
                )}
              </section>
            ) : null}
          </div>

          <section className={card}>
            <h2 className="text-subtitle">Need help?</h2>
            <p className="text-body-m text-dark-300">
              Questions about this session go to {coachFirst}. For a safety, no-show or payment problem, report an issue and the AthaNext team follows up.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link to={helpLinkFrom(`/sessions/${id}`)} className={secondaryButton}>
                Get help
              </Link>
              <ReportIssueButton onClick={() => setReporting(true)} />
            </div>
          </section>
        </div>

        <div className="flex flex-col items-stretch gap-2 md:hidden [&>*]:w-full">{actions}</div>
      </div>

      <RescheduleDialog
        open={rescheduleOpen}
        occurrenceId={s.id}
        bookingId={s.booking.id}
        coachId={s.coach.id}
        coachFirst={coachFirst}
        title={title}
        start={start}
        sessionType={s.sessionType}
        durationMinutes={s.durationMinutes}
        price={s.price}
        onClose={() => setRescheduleOpen(false)}
        onMoved={(label, occurrenceId) => {
          setRescheduleOpen(false);
          toast({ title: `Moved to ${label}` });
          refresh();
          if (occurrenceId !== id) navigate(ROUTES.COACH_SESSION.replace(":id", occurrenceId), { replace: true });
        }}
        onError={(err) =>
          toast({ title: "Couldn't reschedule", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" })
        }
      />

      <ReportIssueDialog
        bookingId={reporting ? s.booking.id : null}
        sessionLabel={`${title}, ${dayLabel}`}
        onClose={() => setReporting(false)}
      />

      <Dialog open={confirmWithdraw} onOpenChange={setConfirmWithdraw}>
        <DialogContent className={dialogContent}>
          <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
            <DialogTitle className="text-section">Withdraw this request?</DialogTitle>
            <DialogDescription className="text-body-m text-dark-300">
              The coach is told you no longer need this time. Nothing was charged.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 px-5 pb-5 sm:px-[25px]">
            <button type="button" className={secondaryButton} onClick={() => setConfirmWithdraw(false)}>
              Cancel
            </button>
            <button type="button" className={dangerButton} disabled={withdraw.isPending} onClick={() => withdraw.mutate()}>
              {withdraw.isPending ? "Withdrawing…" : "Withdraw request"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent className={dialogContent}>
          <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
            <DialogTitle className="text-section">Cancel this session?</DialogTitle>
            <DialogDescription className={meta}>
              {title}, {dayLabel}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 px-5 pb-5 sm:px-[25px]">
            <InfoBox icon={Info} className={late && status === "booked" ? "border border-info-300 bg-info-50 text-info-700" : undefined}>
              {status === "booked" && ["paid", "credit"].includes(s.booking.paymentStatus)
                ? late
                  ? `This session is less than ${plural(noticeHours, "hour")} away, so it is not refunded.`
                  : s.booking.paymentStatus === "credit"
                    ? "Your package credit comes back right away."
                    : `You get a session credit with ${coachFirst} right away.`
                : "The time opens again for other families."}
            </InfoBox>
            <label className="flex flex-col gap-1.5">
              <span className={label}>Reason</span>
              <select className={input} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}>
                <option value="">Choose a reason</option>
                {["Schedule conflict", "Sick or injured", "Travel", "Weather", "Other"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <div className="flex justify-between gap-2">
              <button type="button" className={secondaryButton} onClick={() => setConfirmCancel(false)}>Keep session</button>
              <button type="button" className={dangerButton} disabled={cancel.isPending || !cancelReason} onClick={() => cancel.mutate()}>
                {cancel.isPending ? "Cancelling…" : "Cancel session"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AthleteSessionPage;
