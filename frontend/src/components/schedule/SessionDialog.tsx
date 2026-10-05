/**
 * Tapping a session in My Schedule (ATH-71).
 * Open and offered slots: share them, remove one week, change every week or stop repeating.
 * Groups: who's in, requests to join, share. Booked 1-on-1s and requests: who and payment.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, MapPin, MessageCircle, Repeat, Video, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BrandPill } from "@/components/brand";
import { scheduleAPI, type ScheduleRules, type ScheduleSeries, type ScheduleSession } from "@/api/schedule";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import {
  ALL_START_MINUTES,
  bookedAthletes,
  formatClock,
  formatDayISO,
  formatMinutes,
  minutesInZone,
  plural,
  requestsFor,
  sessionEnd,
  sessionKind,
  sessionStart,
  viewerToEastern,
  WEEKDAY_NAMES,
} from "@/utils/schedule";
import { getZonedISODate } from "@/utils/dateHelpers";
import { formatInstantSpan } from "@/utils/viewerTime";
import { ShareSession } from "./ShareSession";
import {
  choice,
  dangerTextButton,
  dialogContent,
  input,
  label,
  meta,
  primaryButton,
  secondaryButton,
  textButton,
} from "./styles";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export const SessionDialog = ({
  session,
  series,
  onClose,
  rules,
  timeZone,
  coachId,
  coachName,
  onRespond,
  respondingId,
}: {
  session: ScheduleSession | null;
  series: ScheduleSeries[];
  onClose: () => void;
  rules: ScheduleRules;
  timeZone: string;
  coachId: string;
  coachName: string;
  onRespond: (bookingId: string, accept: boolean) => void;
  respondingId: string | null;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [changing, setChanging] = useState(false);
  const [newStart, setNewStart] = useState(0);
  const [newPlace, setNewPlace] = useState("");
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    setChanging(false);
    setSharing(false);
  }, [session?.id]);

  const repeating = useMemo(
    () => (session?.seriesId ? series.find((s) => s.id === session.seriesId) ?? null : null),
    [session?.seriesId, series]
  );

  const places = useMemo(
    () => [...(rules.locations.length ? rules.locations : ["In person"]), "Video call"],
    [rules.locations]
  );

  const done = (title: string, description?: string) => {
    toast({ title, description });
    queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
    onClose();
  };
  const fail = (error: unknown) =>
    toast({
      title: "Something went wrong",
      description: error instanceof Error ? error.message : "Please try again.",
      variant: "destructive",
    });

  const remove = useMutation({
    mutationFn: () => scheduleAPI.removeSession(session!.id),
    onSuccess: () => done(repeating ? "Removed this week" : "Session removed", repeating ? "The other weeks stay." : undefined),
    onError: fail,
  });

  const update = useMutation({
    mutationFn: () => {
      const { start } = viewerToEastern(getZonedISODate(sessionStart(session!), timeZone), newStart, timeZone);
      const online = newPlace === "Video call";
      return scheduleAPI.updateSeries(repeating!.id, start, online ? "online" : "in-person", online || newPlace === "In person" ? null : newPlace);
    },
    onSuccess: () =>
      done(`Every ${WEEKDAY_NAMES[repeating!.dayOfWeek - 1]} now starts at ${formatMinutes(newStart)}`, "Booked sessions stay as they are."),
    onError: fail,
  });

  const stop = useMutation({
    mutationFn: () => scheduleAPI.stopSeries(repeating!.id),
    onSuccess: () => done("Stopped repeating", "Booked sessions stay as they are."),
    onError: fail,
  });

  if (!session) return <Dialog open={false} />;

  const kind = sessionKind(session);
  const start = sessionStart(session);
  const end = sessionEnd(session);
  const day = getZonedISODate(start, timeZone);
  const when = `${formatDayISO(day, { weekday: "short", month: "short", day: "numeric" })} · ${formatInstantSpan(start, end, timeZone)}`;
  const where = session.location === "online" ? "Video call" : session.place || "In person";
  const booked = bookedAthletes(session);
  const requests = requestsFor(session);
  const removable = !booked.length && !requests.length;
  const shareable = kind === "open" || kind === "offered" || kind === "group";
  const weekday = WEEKDAY_NAMES[(repeating?.dayOfWeek ?? 1) - 1];

  const title =
    kind === "group"
      ? session.sessionName
      : kind === "open"
        ? "Open slot"
        : kind === "offered"
          ? "Offered session"
          : kind === "request"
            ? `${requests[0]?.athleteName} · request`
            : booked[0]?.athleteName ?? "1-on-1 session";

  const startChange = () => {
    setNewStart(minutesInZone(start, timeZone));
    setNewPlace(session.location === "online" ? "Video call" : session.place || places[0]);
    setChanging(true);
  };

  const statusPill = (status: string, paymentStatus: string) =>
    status === "requested" ? (
      <BrandPill tone="amber">Request</BrandPill>
    ) : paymentStatus === "paid" ? (
      <BrandPill tone="green">Paid</BrandPill>
    ) : status === "pending_payment" ? (
      <BrandPill tone="amber">Awaiting payment</BrandPill>
    ) : (
      <BrandPill tone="neutral">Booked</BrandPill>
    );

  const RequestButtons = ({ bookingId }: { bookingId: string }) => (
    <span className="flex flex-none gap-1.5">
      <button type="button" className={cn(secondaryButton, "h-[30px] px-3")} disabled={respondingId !== null} onClick={() => onRespond(bookingId, false)}>
        Decline
      </button>
      <button type="button" className={cn(primaryButton, "h-[30px] px-3")} disabled={respondingId !== null} onClick={() => onRespond(bookingId, true)}>
        Accept
      </button>
    </span>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={dialogContent}>
        <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
          <DialogTitle className="text-[22px] font-semibold leading-[28px] tracking-[-0.05em]">{title}</DialogTitle>
          <DialogDescription className={meta}>
            {when} · {where}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-5 pb-5 sm:px-[25px]">
          <div className="flex items-start gap-2 rounded-[8px] bg-[#F1F1E6] px-3 py-2.5">
            <CircleCheck className="mt-[1px] size-4 flex-none text-[#1E7431]" strokeWidth={1.5} aria-hidden="true" />
            <span className="flex flex-col gap-0.5">
              <b className="text-[14px] font-medium">
                {kind === "group"
                  ? `${session.capacity} spots · ${money(session.price)} per athlete`
                  : `1-on-1 · ${session.durationMinutes} min · ${money(session.price)}`}
              </b>
              <span className={meta}>
                {[
                  session.pillar,
                  session.position,
                  session.visibility === "clients" ? "Only your families" : null,
                  session.isDraft ? "Draft, families can't see it yet" : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || (kind === "open" ? "Families can book this" : where)}
              </span>
            </span>
          </div>

          {kind === "group" ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <b className="text-[16px] font-medium text-[#117A96]">
                  {booked.length} of {session.capacity} booked
                </b>
                <span className={meta}>{plural(session.capacity - booked.length, "spot")} left</span>
              </div>
              {booked.length ? (
                <ul className="flex flex-col divide-y divide-[#EAEADF]">
                  {booked.map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-3 py-2 text-[14px]">
                      {b.athleteName}
                      {statusPill(b.status, b.paymentStatus)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={meta}>Nobody has joined yet.</p>
              )}
            </div>
          ) : null}

          {kind === "booked" ? (
            <div className="flex flex-col gap-2">
              {booked.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-3 text-[14px]">
                  {b.athleteName}
                  {statusPill(b.status, b.paymentStatus)}
                </div>
              ))}
              {booked[0]?.notes ? <p className="text-[14px] italic text-[#484D56]">“{booked[0].notes}”</p> : null}
            </div>
          ) : null}

          {requests.length ? (
            <div className="flex flex-col gap-2">
              <span className={label}>{kind === "group" ? "Asking to join" : "Request"}</span>
              {requests.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-[8px] bg-[#FCEFDA] px-3 py-2">
                  <span className="flex flex-col gap-0.5">
                    <b className="text-[14px] font-medium">{r.athleteName}</b>
                    {r.notes ? <span className={meta}>“{r.notes}”</span> : null}
                  </span>
                  <RequestButtons bookingId={r.id} />
                </div>
              ))}
              <span className={meta}>Requests are held for 24 hours. The family pays once you accept.</span>
            </div>
          ) : null}

          {shareable && (sharing || kind !== "group") ? (
            <ShareSession
              sessions={[session]}
              coachId={coachId}
              coachName={coachName}
              slug={rules.slug}
              timeZone={timeZone}
              onDone={() => onClose()}
            />
          ) : null}
          {kind === "group" && !sharing ? (
            <div className="flex gap-2">
              <button type="button" className={cn(secondaryButton, "flex-1")} onClick={() => setSharing(true)}>
                Share or invite
              </button>
              <Link to={ROUTES.CHAT} className={cn(secondaryButton, "flex-1")}>
                <MessageCircle strokeWidth={1.5} aria-hidden="true" />
                Messages
              </Link>
            </div>
          ) : null}
          {kind === "booked" || kind === "request" ? (
            <div className="flex gap-2">
              <Link to={ROUTES.CHAT} className={cn(secondaryButton, "flex-1")}>
                <MessageCircle strokeWidth={1.5} aria-hidden="true" />
                Message
              </Link>
              <Link to={ROUTES.MY_SESSIONS} className={cn(secondaryButton, "flex-1")}>
                Session details
              </Link>
            </div>
          ) : null}

          {repeating && !changing ? (
            <div className="flex items-center gap-2 rounded-[8px] bg-[#F1F1E6] px-3 py-2.5">
              <Repeat className="size-4 flex-none text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
              <span className="grow text-[14px]">
                Repeats every {weekday} at {formatClock(start, timeZone)}
                {repeating.endsOn ? ` until ${formatDayISO(repeating.endsOn, { month: "short", day: "numeric" })}` : ""}
              </span>
              <button type="button" className={textButton} onClick={startChange}>
                Change every week
              </button>
            </div>
          ) : null}

          {repeating && changing ? (
            <div className="flex flex-col gap-3 rounded-[8px] border border-[#EAEADF] p-3">
              <b className="text-[14px] font-medium">Every {weekday}</b>
              <span className={meta}>Changes this for every week from now on. Booked sessions stay as they are.</span>
              <label className="flex flex-col gap-1.5">
                <span className={label}>Start time</span>
                <select className={input} value={newStart} onChange={(e) => setNewStart(Number(e.target.value))}>
                  {ALL_START_MINUTES.map((m) => (
                    <option key={m} value={m}>
                      {formatMinutes(m)}
                    </option>
                  ))}
                </select>
              </label>
              <span className={label}>Where</span>
              <div className="flex flex-wrap gap-2">
                {places.map((p) => (
                  <button key={p} type="button" aria-pressed={newPlace === p} className={choice(newPlace === p)} onClick={() => setNewPlace(p)}>
                    {p === "Video call" ? <Video strokeWidth={1.5} aria-hidden="true" /> : <MapPin strokeWidth={1.5} aria-hidden="true" />}
                    {p}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2">
                <button type="button" className={dangerTextButton} disabled={stop.isPending} onClick={() => stop.mutate()}>
                  Stop repeating
                </button>
                <button type="button" className={primaryButton} disabled={update.isPending} onClick={() => update.mutate()}>
                  Save for every {weekday}
                </button>
              </div>
            </div>
          ) : null}

          {removable && (kind === "open" || kind === "offered" || kind === "group") ? (
            <button
              type="button"
              className={cn(dangerTextButton, "self-start")}
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              <X strokeWidth={1.5} aria-hidden="true" />
              {repeating ? "Remove just this one" : kind === "open" ? "Remove this open slot" : "Remove this session"}
            </button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};
