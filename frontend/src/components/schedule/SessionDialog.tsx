/**
 * Tapping a session in My schedule (ATH-71).
 * Open and offered slots: share them, remove one week, change every week or stop repeating.
 * Groups open the group sheet, camp days the camp day sheet. Booked 1-on-1s and requests go
 * straight to the session page.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, MapPin, Repeat, Video, X } from "@/components/icons";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { scheduleAPI, type ScheduleRules, type ScheduleSeries, type ScheduleSession } from "@/api/schedule";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ALL_START_MINUTES,
  bookedAthletes,
  formatClock,
  formatDayISO,
  formatMinutes,
  minutesInZone,
  requestsFor,
  sessionEnd,
  sessionKind,
  sessionStart,
  viewerToEastern,
  WEEKDAY_NAMES,
} from "@/utils/schedule";
import { getZonedISODate } from "@/utils/dateHelpers";
import { formatInstantSpan } from "@/utils/viewerTime";
import { CampDaySheet } from "@/components/camps/CampDaySheet";
import { ShareSession } from "./ShareSession";
import { GroupSheet } from "./views/GroupSheet";
import {
  choice,
  dangerTextButton,
  dialogContent,
  input,
  label,
  meta,
  primaryButton,
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

  useEffect(() => {
    setChanging(false);
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
      title: "That didn't save",
      description: error instanceof Error ? error.message : "Try again.",
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

  if (session.camp) {
    return <CampDaySheet session={{ ...session, camp: session.camp }} coachSlug={rules.slug} timeZone={timeZone} onClose={onClose} />;
  }

  const kind = sessionKind(session);
  if (kind === "group") {
    return <GroupSheet session={session} timeZone={timeZone} onClose={onClose} onRespond={onRespond} respondingId={respondingId} />;
  }

  const start = sessionStart(session);
  const end = sessionEnd(session);
  const day = getZonedISODate(start, timeZone);
  const when = `${formatDayISO(day, { weekday: "short", month: "short", day: "numeric" })} · ${formatInstantSpan(start, end, timeZone)}`;
  const where = session.location === "online" ? "Video call" : session.place || "In person";
  const booked = bookedAthletes(session);
  const requests = requestsFor(session);
  const removable = !booked.length && !requests.length;
  const shareable = !session.isDraft && (kind === "open" || kind === "offered");
  const weekday = WEEKDAY_NAMES[(repeating?.dayOfWeek ?? 1) - 1];

  const title =
    kind === "open"
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

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={dialogContent}>
        <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
          <DialogTitle className="text-section">{title}</DialogTitle>
          <DialogDescription className={meta}>
            {when} · {where}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-5 pb-5 sm:px-[25px]">
          <div className="flex items-start gap-2 rounded-control border border-light-525 bg-light px-3 py-2.5">
            <CircleCheck className="mt-[1px] size-4 flex-none text-success-700" strokeWidth={1.5} aria-hidden="true" />
            <span className="flex flex-col gap-0.5">
              <b className="text-label-sm">
                {`1-on-1 · ${session.durationMinutes} min · ${money(session.price)}`}
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

          {shareable ? (
            <ShareSession
              sessions={[session]}
              coachId={coachId}
              coachName={coachName}
              slug={rules.slug}
              timeZone={timeZone}
              onDone={() => onClose()}
            />
          ) : null}

          {repeating && !changing ? (
            <div className="flex items-center gap-2 rounded-control border border-light-525 bg-light px-3 py-2.5">
              <Repeat className="size-4 flex-none text-dark-300" strokeWidth={1.5} aria-hidden="true" />
              <span className="grow text-body-m">
                Repeats every {weekday} at {formatClock(start, timeZone)}
                {repeating.endsOn ? ` until ${formatDayISO(repeating.endsOn, { month: "short", day: "numeric" })}` : ""}
              </span>
              <button type="button" className={textButton} onClick={startChange}>
                Change every week
              </button>
            </div>
          ) : null}

          {repeating && changing ? (
            <div className="flex flex-col gap-3 rounded-card border border-light-525 p-3">
              <b className="text-label-sm">Every {weekday}</b>
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

          {removable && (kind === "open" || kind === "offered") ? (
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
