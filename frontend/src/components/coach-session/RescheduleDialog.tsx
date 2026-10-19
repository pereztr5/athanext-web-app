/**
 * Reschedule (Working Copy): the next 14 days with how many open slots each has, the open
 * times on the chosen day, and an optional message to the family. The session takes over the
 * open slot it moves into; payment stays the same.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check } from "@/components/icons";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { coachSessionAPI } from "@/api/coachSession";
import { scheduleAPI } from "@/api/schedule";
import { dayTile, dayTileNumber, dayTileWeekday, input, primaryButton, secondaryButton, timeTile, timeTileNote } from "@/components/schedule/styles";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { cn } from "@/lib/utils";
import { SESSION_TIME_ZONE } from "@/utils/dateHelpers";
import { addDaysISO, formatDayISO, formatMinutes, layoutDays, minutesInZone, viewerToEastern } from "@/utils/schedule";
import { isoDateInZone } from "@/utils/viewerTime";
import { Field, FieldError, ModalBody, ModalFooter, ModalHeader } from "./parts";
import { cap, spDialog } from "./styles";

const short = (iso: string) => formatDayISO(iso, { weekday: "short", month: "short", day: "numeric" });

export const RescheduleDialog = ({
  open,
  occurrenceId,
  title,
  start,
  durationMinutes,
  onClose,
  onMoved,
  onError,
}: {
  open: boolean;
  occurrenceId: string;
  title: string;
  start: Date;
  durationMinutes: number;
  onClose: () => void;
  onMoved: (label: string, told: number) => void;
  onError: (error: unknown) => void;
}) => {
  const timeZone = useViewerTimeZone();
  const today = isoDateInZone(new Date(), timeZone);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDaysISO(today, i)), [today]);
  const current = isoDateInZone(start, timeZone);
  const [day, setDay] = useState(current);
  const [pick, setPick] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDay(days.includes(current) ? current : days[0]);
    setPick(null);
    setMessage("");
    setError(null);
  }, [open, current, days]);

  // Sessions are stored on Eastern dates; a day either side covers any viewer zone.
  const schedule = useQuery({
    queryKey: ["coach-schedule", "reschedule", today],
    enabled: open,
    queryFn: () => {
      const etToday = isoDateInZone(new Date(), SESSION_TIME_ZONE);
      return scheduleAPI.get(addDaysISO(etToday, -1), addDaysISO(etToday, 15));
    },
  });

  // Open start times per day that fit this session and don't clash with anything else.
  const openTimes = useMemo(() => {
    const map = new Map<string, number[]>();
    if (!schedule.data) return map;
    const laid = layoutDays({ dates: days, sessions: schedule.data.sessions, busy: schedule.data.busy, timeOff: schedule.data.timeOff, timeZone });
    laid.forEach((d) => {
      if (d.dayOff) return map.set(d.date, []);
      const blocking = d.items.filter((item) => item.kind !== "open" && item.session?.id !== occurrenceId);
      const times = d.items
        .filter((item) => item.kind === "open" && item.session?.id !== occurrenceId)
        .filter((item) => item.end.getTime() - item.start.getTime() >= durationMinutes * 60000)
        .filter((item) => {
          const end = new Date(item.start.getTime() + durationMinutes * 60000);
          return !blocking.some((b) => b.start < end && item.start < b.end);
        })
        .map((item) => minutesInZone(item.start, timeZone));
      map.set(d.date, Array.from(new Set(times)).sort((a, b) => a - b));
    });
    return map;
  }, [schedule.data, days, timeZone, occurrenceId, durationMinutes]);
  const slots = openTimes.get(day) ?? [];

  const move = useMutation({
    mutationFn: () => {
      const at = viewerToEastern(day, pick!, timeZone);
      return coachSessionAPI.move(occurrenceId, at.date, at.start, message.trim());
    },
    onSuccess: (told) => onMoved(`${short(day)}, ${formatMinutes(pick!)}`, told),
    onError,
  });

  const save = () => {
    if (pick === null) {
      setError("Pick a new time");
      return;
    }
    move.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={spDialog}>
        <ModalHeader title="Reschedule" sub={`${title}, now ${short(current)} at ${formatMinutes(minutesInZone(start, timeZone))}`} />
        <ModalBody>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5">
            {days.map((d) => {
              const n = openTimes.get(d)?.length ?? 0;
              const on = d === day;
              return (
                <button
                  key={d}
                  type="button"
                  className={dayTile(on)}
                  aria-pressed={on}
                  disabled={!schedule.data || !n}
                  onClick={() => {
                    setDay(d);
                    setPick(null);
                  }}
                >
                  <span className={dayTileWeekday(on)}>{formatDayISO(d, { weekday: "short" })}</span>
                  <b className={dayTileNumber}>{formatDayISO(d, { day: "numeric" })}</b>
                  <span className={dayTileWeekday(on)}>{schedule.data ? (n ? `${n} open` : "Full") : "…"}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-label-xsm text-dark-300">Open times on {short(day)}</span>
            {slots.length ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
                {slots.map((m) => {
                  const on = pick === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      className={cn(timeTile(on), "h-[44px]")}
                      aria-pressed={on}
                      onClick={() => {
                        setPick(m);
                        setError(null);
                      }}
                    >
                      {formatMinutes(m)}
                      {on ? (
                        <span className={timeTileNote(on)}>
                          <Check strokeWidth={3} aria-hidden="true" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <span className={cap}>{schedule.isLoading ? "Loading open times…" : "No open times this day"}</span>
            )}
            <FieldError>{error}</FieldError>
          </div>
          <Field title="Message to the family" optional>
            <textarea className={cn(input, "h-auto py-2")} rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
          </Field>
          <p className={cap}>The family is notified right away. Payment stays the same.</p>
        </ModalBody>
        <ModalFooter>
          <button type="button" className={secondaryButton} onClick={onClose}>
            Keep current time
          </button>
          <button type="button" className={primaryButton} disabled={move.isPending} onClick={save}>
            Move session
          </button>
        </ModalFooter>
      </DialogContent>
    </Dialog>
  );
};
