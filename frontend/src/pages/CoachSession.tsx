/**
 * The coach's page for one session (ATH-80), simplified: title, one status tag and the type;
 * one facts card (when, where with Directions, how it was paid, who); the focus from last
 * time on upcoming 1-on-1s; each group athlete with payment and attendance; the feedback card
 * after the session. Only Message and Reschedule as buttons, and Cancel as a quiet link.
 */
import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, ChevronLeft, ChevronRight, Clock, MapPin, MessageCircle, Pencil, Plus, Target, Ticket, Video } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BrandPill } from "@/components/brand";
import { coachSessionAPI, type CoachSessionBooking } from "@/api/coachSession";
import { card, dangerTextButton, dialogContent, input, label, meta, primaryButton, secondaryButton, textButton } from "@/components/schedule/styles";
import { useRole } from "@/hooks/useRole";
import { useToast } from "@/hooks/use-toast";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { getZonedISODate } from "@/utils/dateHelpers";
import { scoreWord } from "@/utils/feedback";
import { ALL_START_MINUTES, addDaysISO, formatDayISO, formatMinutes, minutesInZone, plural, sessionEnd, sessionStart, viewerToEastern } from "@/utils/schedule";
import { formatInstantSpan, isoDateInZone } from "@/utils/viewerTime";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const LIVE = new Set(["requested", "pending_payment", "booked", "completed", "no_show"]);

const payPill = (b: CoachSessionBooking) =>
  b.status === "requested" ? (
    <BrandPill tone="amber">Request</BrandPill>
  ) : b.paymentStatus === "paid" ? (
    <BrandPill tone="green">Paid</BrandPill>
  ) : (
    <BrandPill tone="amber">Not paid</BrandPill>
  );

const CoachSessionPage = () => {
  const { id } = useParams();
  const { isCoach, ready } = useRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const timeZone = useViewerTimeZone();
  const [mode, setMode] = useState<"reschedule" | "cancel" | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newStart, setNewStart] = useState(17 * 60);
  const [message, setMessage] = useState("");

  const query = useQuery({
    queryKey: ["coach-session", id],
    enabled: Boolean(id) && isCoach,
    queryFn: () => coachSessionAPI.get(id!),
  });
  const s = query.data;

  const done = (title: string) => {
    toast({ title });
    setMode(null);
    queryClient.invalidateQueries({ queryKey: ["coach-session", id] });
    queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
  };
  const fail = (error: unknown) =>
    toast({ title: "Something went wrong", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });

  const reschedule = useMutation({
    mutationFn: () => {
      const at = viewerToEastern(newDate, newStart, timeZone);
      return coachSessionAPI.reschedule(id!, at.date, at.start, message);
    },
    onSuccess: (sent) =>
      done(`Moved to ${formatDayISO(newDate, { weekday: "short", month: "short", day: "numeric" })}, ${formatMinutes(newStart)}${sent ? `. ${plural(sent, "family", "families")} told` : ""}`),
    onError: fail,
  });
  const cancel = useMutation({
    mutationFn: () => coachSessionAPI.cancel(id!, message),
    onSuccess: (sent) => {
      done(`Session cancelled${sent ? `. ${plural(sent, "family", "families")} told` : ""}`);
      navigate(ROUTES.MY_SESSIONS);
    },
    onError: fail,
  });

  if (!ready) return null;
  if (!isCoach) return <Navigate to={ROUTES.MY_SESSIONS} replace />;
  if (query.isError) {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-10">
        <p className="text-[14px] text-[#972B2B]">Session not found. It may have been removed.</p>
      </div>
    );
  }
  if (!s) return <p className={cn(meta, "px-4 py-10 text-center")}>Loading…</p>;

  const group = s.sessionType === "group";
  const start = sessionStart(s);
  const end = sessionEnd(s);
  const live = s.bookings.filter((b) => LIVE.has(b.status));
  const booked = live.filter((b) => b.status !== "requested");
  const first = live[0];
  const now = new Date();
  const happening = s.started && !s.ended;
  const upcoming = !s.started && s.isEnabled;
  const cancelled = !s.isEnabled;
  const noShow = s.feedback?.noShow;
  const title = group ? s.sessionName : `1-on-1 with ${first?.name ?? "an athlete"}`;
  const status = cancelled ? (
    <BrandPill tone="amber">Cancelled</BrandPill>
  ) : first?.status === "requested" && !group ? (
    <BrandPill tone="amber">Request</BrandPill>
  ) : happening ? (
    <BrandPill tone="blue">Happening now</BrandPill>
  ) : s.ended && noShow ? (
    <BrandPill tone="amber">No-show</BrandPill>
  ) : s.ended ? (
    <BrandPill tone="neutral">Completed</BrandPill>
  ) : group ? (
    <BrandPill tone="teal">Group</BrandPill>
  ) : (
    <BrandPill tone="green">Confirmed</BrandPill>
  );
  const sub = group
    ? `${s.pillar ? `${s.pillar} · ` : ""}${booked.length} of ${s.capacity} spots · ${money(s.price)} per athlete`
    : `${s.pillar ? `${s.pillar} · ` : ""}${s.durationMinutes} min`;
  const where = s.location === "online" ? "Video call" : s.place || "In person";
  const payLine = !first
    ? "Nobody booked yet"
    : first.status === "requested"
      ? "Charged when you accept"
      : first.paymentStatus === "paid"
        ? `Paid in app, ${money(s.price)}`
        : `Waiting for payment, ${money(s.price)}`;

  const openReschedule = () => {
    setNewDate(getZonedISODate(start, timeZone) < isoDateInZone(now, timeZone) ? isoDateInZone(now, timeZone) : getZonedISODate(start, timeZone));
    setNewStart(minutesInZone(start, timeZone));
    setMessage("");
    setMode("reschedule");
  };

  const fact = (Icon: typeof Clock, a: string, b?: string | null, right?: JSX.Element | null) => (
    <div className="flex items-start gap-3 py-3">
      <Icon className="mt-[2px] size-4 flex-none text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b className="text-[14px] font-medium">{a}</b>
        {b ? <span className={meta}>{b}</span> : null}
      </span>
      {right}
    </div>
  );

  const actions = upcoming ? (
    <>
      <Link to={ROUTES.CHAT} className={secondaryButton}>
        <MessageCircle strokeWidth={1.5} aria-hidden="true" />
        Message{group ? " group" : ""}
      </Link>
      <button type="button" className={secondaryButton} onClick={openReschedule}>
        <CalendarClock strokeWidth={1.5} aria-hidden="true" />
        Reschedule
      </button>
    </>
  ) : s.started && !cancelled && live.length ? (
    <Link to={`${ROUTES.COACH_SESSION_FEEDBACK}?slotId=${s.id}`} className={s.feedback ? secondaryButton : primaryButton}>
      {s.feedback ? <Pencil strokeWidth={1.5} aria-hidden="true" /> : <Plus strokeWidth={1.5} aria-hidden="true" />}
      {s.feedback ? "Edit feedback" : "Add feedback"}
    </Link>
  ) : null;

  return (
    <div className="px-4 pb-16 md:px-10">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
        <button type="button" className={cn(textButton, "self-start text-[#767980]")} onClick={() => navigate(-1)}>
          <ChevronLeft strokeWidth={1.5} aria-hidden="true" />
          Back
        </button>
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[28px] font-bold leading-[30px] tracking-[-1.2px] text-[#1A202C]">{title}</h1>
              {status}
            </div>
            <span className={meta}>{sub}</span>
          </div>
          {actions ? <div className="flex gap-2">{actions}</div> : null}
        </header>

        <section className={cn(card, "gap-0 divide-y divide-[#EAEADF] py-2")}>
          {fact(Clock, formatDayISO(getZonedISODate(start, timeZone), { weekday: "short", month: "short", day: "numeric" }), formatInstantSpan(start, end, timeZone))}
          {s.location === "online"
            ? fact(Video, "Video call", "The link goes out with the confirmation")
            : fact(
                MapPin,
                where,
                null,
                s.place ? (
                  <a className={textButton} href={`https://www.google.com/maps/search/${encodeURIComponent(s.place)}`} target="_blank" rel="noreferrer">
                    Directions
                  </a>
                ) : null
              )}
          {!group ? fact(Ticket, payLine) : null}
          {!group && first ? (
            <Link to={`/athletes/${first.athleteId}`} className="flex items-center gap-3 py-3 hover:bg-[#F4F4EB]">
              <span className="flex size-[36px] items-center justify-center rounded-full bg-[#D9D9CF] text-[12px] font-semibold text-[#484D56]">
                {first.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <b className="text-[14px] font-medium">{first.name}</b>
                <span className={meta}>{s.ended && first.attendance ? (first.attendance === "present" ? "Came" : "Didn't come") : "Athlete"}</span>
              </span>
              <ChevronRight className="size-4 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
            </Link>
          ) : null}
        </section>

        {upcoming && !group && s.lastSummary ? (
          <div className="flex items-start gap-3 rounded-[10px] bg-[#E5EDF7] p-4">
            <Target className="mt-[2px] size-4 flex-none text-[#0054B4]" strokeWidth={1.5} aria-hidden="true" />
            <span className="flex flex-col gap-0.5">
              <span className={meta}>From last time ({formatDayISO(s.lastSummary.date, { month: "short", day: "numeric" })})</span>
              <span className="text-[14px] text-[#1A202C]">{s.lastSummary.summary}</span>
            </span>
          </div>
        ) : null}

        {group ? (
          <section className={card}>
            <h2 className="text-[18px] font-medium">Athletes</h2>
            {live.length ? (
              <div className="flex flex-col divide-y divide-[#EAEADF]">
                {live.map((b) => (
                  <Link key={b.id} to={`/athletes/${b.athleteId}`} className="flex items-center gap-3 py-2.5 hover:bg-[#F4F4EB]">
                    <span className="flex size-[32px] items-center justify-center rounded-full bg-[#D9D9CF] text-[11px] font-semibold text-[#484D56]">
                      {b.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                    </span>
                    <span className="grow text-[14px]">{b.name}</span>
                    {s.ended && b.attendance && b.attendance !== "present" ? <BrandPill tone="amber">Absent</BrandPill> : null}
                    {payPill(b)}
                  </Link>
                ))}
              </div>
            ) : (
              <p className={meta}>Nobody yet. Share it from My Schedule.</p>
            )}
          </section>
        ) : null}

        {s.ended && !cancelled && live.length ? (
          s.feedback ? (
            <section className={card}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[18px] font-medium">{s.feedback.noShow ? "No-show" : "Feedback"}</h2>
                {!s.feedback.noShow && s.feedback.score ? (
                  <span className="text-[14px]">
                    <b className="text-[18px] font-semibold">{s.feedback.score}</b>/10 · {scoreWord(s.feedback.score)}
                  </span>
                ) : null}
              </div>
              {s.feedback.summary ? (
                <p className="whitespace-pre-wrap text-[14px] leading-[20px] text-[#484D56]">{s.feedback.summary}</p>
              ) : (
                <p className={meta}>{s.feedback.noShow ? "No message sent. The session stays charged." : "No summary."}</p>
              )}
              <span className={meta}>
                {s.feedback.summary ? `Shared with ${group ? "each family who came" : `${first?.name.split(" ")[0]}'s family`}` : ""}
                {s.feedback.editCount ? " · Edited" : ""}
              </span>
              {group ? (
                <Link to={`${ROUTES.COACH_SESSION_FEEDBACK}?slotId=${s.id}&notes=1`} className={cn(textButton, "self-start")}>
                  <Plus strokeWidth={1.5} aria-hidden="true" />
                  Note for an athlete
                </Link>
              ) : null}
            </section>
          ) : (
            <p className="rounded-[10px] bg-[#FCEFDA] px-4 py-3 text-[14px] text-[#906A29]">
              Feedback due. {group ? "Families see it" : "The family sees it"} once you send it.
            </p>
          )
        ) : null}

        {upcoming ? (
          <button type="button" className={cn(dangerTextButton, "self-start")} onClick={() => { setMessage(""); setMode("cancel"); }}>
            Cancel session
          </button>
        ) : null}
      </div>

      <Dialog open={mode !== null} onOpenChange={(open) => !open && setMode(null)}>
        <DialogContent className={dialogContent}>
          <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
            <DialogTitle className="text-[22px] font-semibold tracking-[-0.05em]">{mode === "cancel" ? "Cancel this session?" : "Reschedule"}</DialogTitle>
            <DialogDescription className={meta}>
              {booked.length || live.length
                ? `${plural(live.length, "family", "families")} ${live.length === 1 ? "gets" : "get"} a message.`
                : "Nobody is booked yet."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 px-5 pb-5 sm:px-[25px]">
            {mode === "reschedule" ? (
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className={label}>New day</span>
                  <input
                    className={input}
                    type="date"
                    min={isoDateInZone(now, timeZone)}
                    max={addDaysISO(isoDateInZone(now, timeZone), 90)}
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={label}>Start</span>
                  <select className={input} value={newStart} onChange={(e) => setNewStart(Number(e.target.value))}>
                    {ALL_START_MINUTES.map((m) => (
                      <option key={m} value={m}>
                        {formatMinutes(m)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              <p className="text-[14px] leading-[20px] text-[#484D56]">
                The session is removed from your schedule and anyone booked is told. Sessions a family has already paid for can't be
                cancelled here yet; message them to move it instead.
              </p>
            )}
            <label className="flex flex-col gap-1.5">
              <span className={label}>Message (optional)</span>
              <textarea
                className={cn(input, "h-auto py-2")}
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={mode === "cancel" ? "For example: Sorry, I'm unwell today." : "For example: Can we do the morning instead?"}
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className={secondaryButton} onClick={() => setMode(null)}>
                Back
              </button>
              {mode === "reschedule" ? (
                <button type="button" className={primaryButton} disabled={!newDate || reschedule.isPending} onClick={() => reschedule.mutate()}>
                  Move session
                </button>
              ) : (
                <button
                  type="button"
                  className="inline-flex h-[34px] items-center rounded-[8px] border border-[#FDB5B5] bg-[#FEDADA] px-4 text-[14px] font-medium text-[#972B2B] disabled:opacity-50"
                  disabled={cancel.isPending}
                  onClick={() => cancel.mutate()}
                >
                  Cancel session
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CoachSessionPage;
