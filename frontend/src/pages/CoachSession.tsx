/**
 * The coach's page for one session (ATH-80, Working Copy): title, one status tag and the type;
 * one facts card (when, where with Directions, how it was paid, who); the focus from last
 * time on upcoming 1-on-1s; each group athlete with payment and attendance; the feedback card
 * after the session. Requests get Decline and Accept; booked sessions get Message and
 * Reschedule, with Cancel as a quiet link. On a phone the buttons sit at the bottom.
 * Camp days list the camp's registrations as the roster (attendance and feedback as usual);
 * sign-ups, payments and the schedule are managed on the camp, so there is no Add, Reschedule
 * or Cancel there.
 */
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AthleteSessionPage from "./AthleteSession";
import { useProfile } from "@/contexts/ProfileContext";
import { useCoachDetails } from "@/hooks/useCoachDetails";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarSync, ChevronLeft, ChevronRight, Eye, FileText, Lock, MapPin, MessageCircle, Pencil, Plus, Target, Ticket, Video } from "@/components/icons";
import { BrandPill } from "@/components/brand";
import { bookingRequestsAPI } from "@/api/bookingRequests";
import { chatAPI } from "@/api/chat";
import { coachSessionAPI, type CoachSessionBooking } from "@/api/coachSession";
import { getMeetingUrl } from "@/api/meetingLinks";
import { offlinePayAPI } from "@/api/offlinePay";
import { meta, primaryButton, secondaryButton, smallButton, textButton, dangerTextButton } from "@/components/schedule/styles";
import { buttonVariants } from "@/components/ui/button";
import { AddToGroupDialog } from "@/components/coach-session/AddToGroupDialog";
import { CancelDialog } from "@/components/coach-session/CancelDialog";
import { DeclineDialog } from "@/components/coach-session/DeclineDialog";
import { RescheduleDialog } from "@/components/coach-session/RescheduleDialog";
import { Avatar, InfoBox } from "@/components/coach-session/parts";
import { SessionHeader } from "@/components/session/SessionHeader";
import { cap, h3, spCard } from "@/components/coach-session/styles";
import { useRole } from "@/hooks/useRole";
import { useToast } from "@/hooks/use-toast";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { getZonedISODate } from "@/utils/dateHelpers";
import { scoreWord } from "@/utils/feedback";
import { formatDayISO, formatMinutes, minutesInZone, plural, sessionEnd, sessionStart } from "@/utils/schedule";
import { isoDateInZone } from "@/utils/viewerTime";
import { campDayTitle, isCampBooking } from "@/utils/campSessions";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const money2 = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const LIVE = new Set(["requested", "pending_payment", "booked", "completed", "no_show"]);
const SHOWN = 5;
// Closed bookings that aren't a family cancelling.
const NOT_FAMILY = /^(Declined|Cancelled by coach|Request expired|Coach suggested another time|Account deleted)/;

/** Group payment tags (Working Copy): nothing for families who pay the coach directly. */
const payPill = (b: CoachSessionBooking) =>
  b.status === "requested" ? (
    <BrandPill tone="amber">Request</BrandPill>
  ) : isCampBooking(b.paymentStatus) ? (
    <BrandPill tone="teal">Camp</BrandPill>
  ) : b.paymentStatus === "pending_offline" ? (
    <BrandPill tone="amber">Pending</BrandPill>
  ) : b.paymentStatus === "direct" ? null : b.paymentStatus === "refunded" ? (
    <BrandPill tone="sunk">Refunded</BrandPill>
  ) : b.paymentStatus === "credit" ? (
    <BrandPill tone="sunk">Credit</BrandPill>
  ) : b.paymentStatus === "paid" ? (
    <BrandPill tone="green">Paid</BrandPill>
  ) : b.paymentStatus === "outside" ? (
    <BrandPill tone="green">Paid outside</BrandPill>
  ) : b.status === "pending_payment" || b.paymentStatus === "requires_action" ? (
    <BrandPill tone="amber">Due</BrandPill>
  ) : (
    <BrandPill tone="amber">Not paid</BrandPill>
  );

/** "Parent Dana Patel" / "Athlete, 18+". */
const whoLine = (b: CoachSessionBooking) => (b.parentName ? `Parent ${b.parentName}` : b.age != null && b.age >= 18 ? "Athlete, 18+" : "Athlete");

const CoachSessionPage = () => {
  const { id } = useParams();
  const { isCoach, ready } = useRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const timeZone = useViewerTimeZone();
  const [mode, setMode] = useState<"reschedule" | "cancel" | "decline" | "add" | null>(null);
  const [showAll, setShowAll] = useState(false);

  const query = useQuery({
    queryKey: ["coach-session", id],
    enabled: Boolean(id) && isCoach,
    queryFn: () => coachSessionAPI.get(id!),
  });
  const s = query.data;
  // Booking only coaches (ATH-86) are paid by families directly.
  const { profile } = useProfile();
  const meeting = useQuery({
    queryKey: ["meeting-link", profile?.userProfile?.coach_id],
    enabled: isCoach && s?.location === "online" && Boolean(profile?.userProfile?.coach_id),
    queryFn: () => getMeetingUrl(profile!.userProfile!.coach_id as string),
  });
  const { coach: me } = useCoachDetails(isCoach ? profile?.userProfile?.coach_id ?? undefined : undefined);
  const paysDirect = (me as { pay_mode?: string } | undefined)?.pay_mode === "self";

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["coach-session", id] });
    queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
    queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
  };
  const done = (title: string, description?: string) => {
    toast({ title, description });
    setMode(null);
    refresh();
  };
  const fail = (error: unknown) =>
    toast({ title: "That didn't save", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });

  // Opens the athlete's thread or the coach's group channel; plain Messages if that fails.
  const message = useMutation({
    mutationFn: (athleteId: string | null) => (athleteId ? bookingRequestsAPI.openConversation(athleteId) : chatAPI.openMyCoachChannel()),
    onSuccess: (conversationId) => navigate(conversationId ? `${ROUTES.CHAT}?conversationId=${conversationId}` : ROUTES.CHAT),
    onError: () => navigate(ROUTES.CHAT),
  });
  const accept = useMutation({
    mutationFn: (bookingId: string) => bookingRequestsAPI.respond(bookingId, true),
    onSuccess: (status) =>
      done(
        "Request accepted",
        status === "charged" ? "It's booked and the family's card was charged." : status === "booked" ? "It's booked." : "The family can now pay to confirm the booking."
      ),
    onError: fail,
  });
  const confirmOffline = useMutation({
    mutationFn: (bookingId: string) => offlinePayAPI.confirm(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-offline-payments"] });
      done("Marked paid", "The family sees it as paid.");
    },
    onError: fail,
  });

  if (!ready) return null;
  // Athletes and parents get their own page for the same link (ATH-97).
  if (!isCoach) return <AthleteSessionPage />;
  if (query.isError) {
    return (
      <div className="mx-auto w-full max-w-wrapper px-4 py-10">
        <p className="text-body-m text-error-700">Session not found. It may have been removed.</p>
      </div>
    );
  }
  if (!s) return <p className={cn(meta, "px-4 py-10 text-center")}>Loading…</p>;

  const group = s.sessionType === "group";
  const camp = s.camp;
  const campLink = camp ? `${ROUTES.PROFILE}?camp=${camp.id}&view=registrations` : null;
  const start = sessionStart(s);
  const end = sessionEnd(s);
  const live = s.bookings.filter((b) => LIVE.has(b.status));
  const booked = live.filter((b) => b.status !== "requested");
  const lastCancelled = [...s.bookings].reverse().find((b) => b.status === "canceled") ?? null;
  const happening = s.started && !s.ended;
  const declined = !group && !live.length && Boolean(lastCancelled?.cancellationReason?.startsWith("Declined"));
  // A 1-on-1 the family cancelled stays open on the coach's schedule; the page shows it as cancelled.
  const familyCancelled =
    !group && s.isEnabled && !live.length && Boolean(lastCancelled) && !declined && !NOT_FAMILY.test(lastCancelled?.cancellationReason ?? "");
  const first = live[0] ?? (declined || familyCancelled ? lastCancelled ?? undefined : undefined);
  const cancelled = !s.isEnabled || familyCancelled;
  const request = !group && !cancelled && first?.status === "requested";
  const isLive = !cancelled && !s.ended && !request && (group || booked.length > 0);
  const noShow = s.feedback?.noShow;
  const who = first?.name ?? "an athlete";
  const title = camp ? campDayTitle(camp.name, camp.dayIndex) : group ? s.sessionName : `1-on-1 with ${who}`;
  const dayLabel = formatDayISO(getZonedISODate(start, timeZone), { weekday: "short", month: "short", day: "numeric" });
  const shortDay = (iso: string) => formatDayISO(iso, { month: "short", day: "numeric" });
  const startLabel = formatMinutes(minutesInZone(start, timeZone));

  const statusPill = cancelled ? (
    <BrandPill tone="amber">Cancelled</BrandPill>
  ) : declined ? (
    <BrandPill tone="sunk">Declined</BrandPill>
  ) : request ? (
    <BrandPill tone="amber">Request</BrandPill>
  ) : happening ? (
    <BrandPill tone="blue">Happening now</BrandPill>
  ) : s.ended && noShow ? (
    <BrandPill tone="amber">No-show</BrandPill>
  ) : s.ended ? (
    <BrandPill tone="sunk">Completed</BrandPill>
  ) : !group && !first ? (
    <BrandPill tone="neutral">Open</BrandPill>
  ) : !group ? (
    <BrandPill tone="green">Confirmed</BrandPill>
  ) : null;
  // Two lines: how it was paid, and the amount or credits left.
  const payLine = (): [string, string] => {
    if (!first) return paysDirect ? ["Family pays you directly", money(s.price)] : ["Not charged", ""];
    const p = first.paymentStatus;
    if (first.status === "requested") return paysDirect ? ["Family pays you directly", money(s.price)] : ["Charged when you accept", ""];
    if (p === "pending_offline") return ["Paid to you directly, pending", money(s.price)];
    if (p === "direct") return ["Family pays you directly", money(s.price)];
    if (p === "refunded") return ["Refunded", ""];
    if (p === "credit") return ["Paid with a credit", s.ended || first.status === "canceled" ? "" : `${plural(first.creditsLeft, "credit")} left`];
    if (p === "paid") return ["Paid in app", money2(first.paidAmount ?? s.price)];
    if (p === "outside") return s.price > 0 ? ["Paid outside AthaNext", money(s.price)] : ["Free session", ""];
    if (first.status === "canceled") return ["Not charged", ""];
    return ["Waiting for payment", `${money(s.price)} due`];
  };
  const [pay1, pay2] = payLine();

  // "Cancelled by you/the family on Oct 9. Weather. The family got a session credit."
  const cancelLine = (() => {
    if (!cancelled) return null;
    const parts: string[] = [];
    if (familyCancelled && lastCancelled) {
      const reason = lastCancelled.cancellationReason;
      const refund = lastCancelled.creditBack
        ? lastCancelled.paymentStatus === "credit"
          ? "The package credit went back"
          : "They got a session credit"
        : ["paid", "credit"].includes(lastCancelled.paymentStatus)
          ? "Not refunded, less than 24 hours' notice"
          : "Nothing was charged";
      parts.push(`Cancelled by the family${lastCancelled.canceledAt ? ` on ${shortDay(isoDateInZone(new Date(lastCancelled.canceledAt), timeZone))}` : ""}`);
      if (reason && !/^Cancelled by the family$/i.test(reason)) parts.push(reason);
      parts.push(refund);
    } else {
      const at = s.cancel?.at ? ` on ${shortDay(isoDateInZone(new Date(s.cancel.at), timeZone))}` : "";
      parts.push(`Cancelled by you${at}`);
      if (s.cancel?.reason) parts.push(s.cancel.reason);
      if (s.cancel?.refund) parts.push(s.cancel.refund);
    }
    return `${parts.join(". ")}.`;
  })();

  const fact = (Icon: typeof MapPin, a: string, b?: string | null, right?: JSX.Element | null) => (
    <div className="flex items-start gap-3">
      <Icon className="mt-[2px] size-[17px] flex-none text-dark-300" strokeWidth={1.5} aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-label-sm text-dark">{a}</span>
        {b ? <span className={cap}>{b}</span> : null}
      </span>
      {right}
    </div>
  );

  const actions = request ? (
    <>
      <button type="button" className={secondaryButton} onClick={() => setMode("decline")}>
        Decline
      </button>
      <button type="button" className={primaryButton} disabled={accept.isPending} onClick={() => accept.mutate(first!.id)}>
        Accept
      </button>
    </>
  ) : isLive ? (
    <>
      <button type="button" className={secondaryButton} disabled={message.isPending} onClick={() => message.mutate(group ? null : first?.athleteId ?? null)}>
        <MessageCircle strokeWidth={1.5} aria-hidden="true" />
        Message{group ? " group" : ""}
      </button>
      {campLink ? (
        <Link to={campLink} className={secondaryButton}>
          Manage camp
        </Link>
      ) : (
        <button type="button" className={secondaryButton} onClick={() => setMode("reschedule")}>
          <CalendarSync strokeWidth={1.5} aria-hidden="true" />
          Reschedule
        </button>
      )}
    </>
  ) : s.ended && !cancelled && booked.length ? (
    <Link to={`${ROUTES.COACH_SESSION_FEEDBACK}?slotId=${s.id}`} className={s.feedback ? secondaryButton : primaryButton}>
      {s.feedback ? <Pencil strokeWidth={1.5} aria-hidden="true" /> : <FileText strokeWidth={1.5} aria-hidden="true" />}
      {s.feedback ? "Edit feedback" : "Add feedback"}
    </Link>
  ) : null;

  const athleteRow = (b: CoachSessionBooking, extra?: JSX.Element | null, line?: string) => (
    <Link
      key={b.id}
      to={`/athletes/${b.athleteId}`}
      className="flex items-center gap-2.5 py-2 [&+&]:border-t [&+&]:border-light-525 hover:opacity-90"
    >
      <Avatar name={b.name} imageUrl={b.imageUrl} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-label-sm text-dark">{b.name}</span>
        <span className={cap}>{line ?? whoLine(b)}</span>
      </span>
      {extra}
    </Link>
  );

  const lastFocus = isLive && !group && first ? s.lastFocus : null;
  const shown = showAll ? live : live.slice(0, SHOWN);
  const notesFor = booked.filter((b) => b.note);
  const fb = s.feedback;
  // Families of athletes marked as missed get a short missed message instead of the summary.
  const sharedWith = group
    ? booked.some((b) => b.attendance && b.attendance !== "present")
      ? "the families who came"
      : "each family"
    : first?.parentName ?? "the family";

  return (
    <div className="px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-wrapper flex-col gap-4 md:gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" className={cn(buttonVariants({ variant: "back" }), "self-start")} onClick={() => navigate(-1)}>
            <ChevronLeft strokeWidth={1.5} aria-hidden="true" />
            Back
          </button>
          {actions ? <div className="hidden flex-wrap items-center gap-2 md:flex">{actions}</div> : null}
        </div>

        <SessionHeader
          timeZone={timeZone}
          session={{
            title,
            sessionType: s.sessionType,
            pillar: s.pillar,
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            location: s.location,
            place: s.place,
            statusPills: statusPill,
            people: live.map((b) => ({ name: b.name, imageUrl: b.imageUrl, line: whoLine(b) })),
            peopleLabel: camp
              ? `${live.length} of ${s.capacity} spots${camp.groupName ? ` · ${camp.groupName}` : ""}`
              : group
                ? `${live.length} of ${s.capacity} spots · ${money(s.price)} per athlete`
                : undefined,
          }}
        />

        {cancelLine ? <InfoBox>{cancelLine}</InfoBox> : null}
        {camp && !cancelled ? (
          <InfoBox>
            {`Day ${camp.dayIndex ?? 1}${camp.daysTotal ? ` of ${camp.daysTotal}` : ""} of ${camp.name}. Everyone signed up for this group is on the roster. Sign-ups, payments and the camp schedule are managed on the camp.`}
          </InfoBox>
        ) : null}

        <section className={spCard}>
          {s.location === "online"
            ? fact(
                Video,
                "Video call",
                meeting.data ? "The link for this session" : "Add a video link in Schedule settings",
                meeting.data ? (
                  <a className="text-label-sm text-primary hover:underline" href={meeting.data} target="_blank" rel="noreferrer">
                    Open
                  </a>
                ) : null
              )
            : fact(
                MapPin,
                s.place || "In person",
                null,
                s.place ? (
                  <a
                    className="text-label-sm text-primary hover:underline"
                    href={`https://www.google.com/maps/search/${encodeURIComponent(s.place)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Directions
                  </a>
                ) : null
              )}
          {!group
            ? fact(
                Ticket,
                pay1,
                pay2,
                first?.paymentStatus === "pending_offline" ? (
                  <button
                    type="button"
                    className={cn(secondaryButton, smallButton, "shrink-0")}
                    disabled={confirmOffline.isPending}
                    onClick={() => confirmOffline.mutate(first.id)}
                  >
                    Confirm received
                  </button>
                ) : null
              )
            : null}
          {!group && first ? (
            <>
              <div className="h-px bg-light-525" />
              {athleteRow(
                first,
                <ChevronRight className="size-4 flex-none text-dark-300" strokeWidth={1.5} aria-hidden="true" />,
                s.ended && first.attendance && !cancelled ? (first.attendance === "present" ? "Attended" : "No-show") : request ? `${whoLine(first)} · request` : undefined
              )}
            </>
          ) : null}
        </section>

        {lastFocus ? (
          <div className="flex items-center gap-3 rounded-card border border-primary-300 bg-primary-50 px-4 py-3">
            <Target className="size-[18px] flex-none text-primary" strokeWidth={1.5} aria-hidden="true" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className={cn(cap, "text-primary")}>Focus from last time</span>
              <span className="text-label-sm text-dark">{lastFocus.text}</span>
            </span>
          </div>
        ) : null}

        {group ? (
          <section className={spCard}>
            <div className="flex items-center justify-between gap-3">
              <h3 className={h3}>Athletes</h3>
              {campLink ? (
                <Link to={campLink} className={textButton}>
                  Registrations
                </Link>
              ) : isLive && live.length < s.capacity ? (
                <button type="button" className={textButton} onClick={() => setMode("add")}>
                  <Plus strokeWidth={1.5} aria-hidden="true" />
                  Add
                </button>
              ) : null}
            </div>
            {live.length ? (
              <div className="flex flex-col">
                {shown.map((b) =>
                  athleteRow(
                    b,
                    <>
                      {s.ended && b.attendance && b.attendance !== "present" ? <BrandPill tone="amber">Absent</BrandPill> : null}
                      {payPill(b)}
                    </>
                  )
                )}
              </div>
            ) : (
              <p className={cn(cap, "py-2")}>
                {camp ? "Nobody yet. Families who sign up for the camp show up here." : "Nobody yet. Share it from My schedule."}
              </p>
            )}
            {live.length > SHOWN ? (
              <button type="button" className={cn(textButton, "self-start")} onClick={() => setShowAll(!showAll)}>
                {showAll ? "Show fewer" : `Show ${live.length - SHOWN} more`}
              </button>
            ) : null}
          </section>
        ) : null}

        {s.ended && !cancelled && booked.length ? (
          fb ? (
            <section className={spCard}>
              <div className="flex items-center justify-between gap-3">
                <h3 className={h3}>{fb.noShow ? "No-show" : "Feedback"}</h3>
                {!fb.noShow && fb.score ? (
                  <span className="text-label-sm text-primary">
                    <b className="text-card-title">{fb.score}</b>/10 · {scoreWord(fb.score)}
                  </span>
                ) : null}
              </div>
              {fb.summary ? (
                <p className="whitespace-pre-wrap text-paragraph text-dark">{fb.summary}</p>
              ) : fb.noShow ? (
                <p className="text-body-m text-dark-300">No message sent. The session stays charged.</p>
              ) : null}
              <span className={cn(cap, "inline-flex items-center gap-1.5")}>
                {fb.summary || (!fb.noShow && fb.score) ? <Eye className="size-3" strokeWidth={1.5} aria-hidden="true" /> : <Lock className="size-3" strokeWidth={1.5} aria-hidden="true" />}
                {fb.summary
                  ? `Shared with ${sharedWith}${fb.editCount ? " · Edited" : ""}`
                  : !fb.noShow && fb.score
                    ? `Score shared with ${sharedWith}`
                    : "Private, only you can see this"}
              </span>
              {group ? (
                <>
                  <div className="h-px bg-light-525" />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className={cap}>
                      {notesFor.length ? `Notes sent for ${notesFor.map((b) => b.name.split(" ")[0]).join(", ")}` : "No notes for individual athletes yet"}
                    </span>
                    <Link to={`${ROUTES.COACH_SESSION_FEEDBACK}?slotId=${s.id}&notes=1`} className={textButton}>
                      <Plus strokeWidth={1.5} aria-hidden="true" />
                      Note for an athlete
                    </Link>
                  </div>
                </>
              ) : null}
            </section>
          ) : (
            <InfoBox warm icon="clock">
              Feedback due. {group ? "Families see it" : "The family sees it"} once you complete the session.
            </InfoBox>
          )
        ) : null}

        {actions ? <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-2 md:hidden [&>*]:w-full">{actions}</div> : null}

        {isLive && !camp ? (
          <button type="button" className={cn(dangerTextButton, "self-center md:self-start")} onClick={() => setMode("cancel")}>
            Cancel session
          </button>
        ) : null}
      </div>

      <RescheduleDialog
        open={mode === "reschedule"}
        occurrenceId={s.id}
        title={title}
        start={start}
        durationMinutes={s.durationMinutes}
        onClose={() => setMode(null)}
        onMoved={(label, told) => done(`Moved to ${label}`, told ? `${plural(told, "family", "families")} told` : undefined)}
        onError={fail}
      />
      <CancelDialog
        open={mode === "cancel"}
        occurrenceId={s.id}
        sub={`${title}, ${shortDay(getZonedISODate(start, timeZone))} at ${startLabel}`}
        group={group}
        paymentStatus={group ? null : first?.paymentStatus ?? null}
        onClose={() => setMode(null)}
        onCancelled={({ sent, credits }) => {
          done(
            "Session cancelled",
            [credits ? `${plural(credits, "credit")} given back` : "", sent ? `${plural(sent, "family", "families")} told` : ""].filter(Boolean).join(". ") || undefined
          );
          navigate(ROUTES.MY_SESSIONS);
        }}
        onError={fail}
      />
      <DeclineDialog
        open={mode === "decline"}
        bookingId={request ? first?.id ?? null : null}
        sub={`${first?.parentName ? `${first.parentName} for ` : ""}${who}, ${shortDay(getZonedISODate(start, timeZone))} at ${startLabel}`}
        onClose={() => setMode(null)}
        onDeclined={() => {
          done("Request declined", "The slot is open again.");
          navigate(-1);
        }}
        onError={fail}
      />
      {group && !camp ? (
        <AddToGroupDialog
          open={mode === "add"}
          occurrenceId={s.id}
          title={s.sessionName}
          sub={`${dayLabel} at ${startLabel} · ${plural(Math.max(0, s.capacity - live.length), "spot")} left`}
          price={s.price}
          bookedIds={live.map((b) => b.athleteId)}
          onClose={() => setMode(null)}
          onAdded={(text) => done(text)}
          onError={fail}
        />
      ) : null}
    </div>
  );
};

export default CoachSessionPage;
