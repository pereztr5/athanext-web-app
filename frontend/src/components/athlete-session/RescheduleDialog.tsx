/**
 * Family reschedule (Working Copy): the next 14 days, open times of this coach with the
 * same session type, length and price, then move the booking. Payment stays the same.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check } from "@/components/icons";
import { bookAPI, type BookableSession } from "@/api/book";
import { MissingRpcError, athleteSessionAPI } from "@/api/athleteSession";
import { Banner } from "@/components/ui/banner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, FieldError, ModalBody, ModalFooter, ModalHeader } from "@/components/coach-session/parts";
import { spDialog } from "@/components/coach-session/styles";
import {
  dayTile,
  dayTileNumber,
  dayTileWeekday,
  input,
  primaryButton,
  secondaryButton,
  timeTile,
  timeTileNote,
} from "@/components/schedule/styles";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { cn } from "@/lib/utils";
import { bookableStart } from "@/utils/booking";
import { SESSION_TIME_ZONE, getZonedISODate } from "@/utils/dateHelpers";
import { addDaysISO, formatClock, formatDayISO } from "@/utils/schedule";
import { isoDateInZone } from "@/utils/viewerTime";

const short = (iso: string) => formatDayISO(iso, { weekday: "short", month: "short", day: "numeric" });

const samePrice = (a: number, b: number) => Math.round(a * 100) === Math.round(b * 100);

const canMoveTo = (slot: BookableSession, occurrenceId: string, sessionType: BookableSession["sessionType"], durationMinutes: number, price: number) =>
  slot.id !== occurrenceId &&
  slot.sessionType === sessionType &&
  slot.durationMinutes === durationMinutes &&
  samePrice(slot.price, price) &&
  !slot.myStatus &&
  (slot.sessionType === "group" ? slot.bookedCount < slot.capacity : slot.bookedCount === 0) &&
  bookableStart(slot).getTime() > Date.now();

export const RescheduleDialog = ({
  open,
  occurrenceId,
  bookingId,
  coachId,
  coachFirst,
  title,
  start,
  sessionType,
  durationMinutes,
  price,
  onClose,
  onMoved,
  onError,
}: {
  open: boolean;
  occurrenceId: string;
  bookingId: string;
  coachId: string;
  coachFirst: string;
  title: string;
  start: Date;
  sessionType: "individual" | "group";
  durationMinutes: number;
  price: number;
  onClose: () => void;
  onMoved: (label: string, occurrenceId: string) => void;
  onError: (error: unknown) => void;
}) => {
  const timeZone = useViewerTimeZone();
  const today = isoDateInZone(new Date(), timeZone);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDaysISO(today, i)), [today]);
  const currentDay = isoDateInZone(start, timeZone);
  const [day, setDay] = useState(currentDay);
  const [pick, setPick] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDay(days.includes(currentDay) ? currentDay : days[0]!);
    setPick(null);
    setMessage("");
    setError(null);
    setUnavailable(false);
  }, [open, currentDay, days]);

  const easternToday = isoDateInZone(new Date(), SESSION_TIME_ZONE);
  const range = useMemo(
    () => ({ from: addDaysISO(easternToday, -1), to: addDaysISO(easternToday, 15) }),
    [easternToday]
  );

  const slotsQuery = useQuery({
    queryKey: ["athlete-reschedule-slots", coachId, range.from, range.to],
    enabled: open && Boolean(coachId),
    queryFn: () => bookAPI.sessions(coachId, range.from, range.to),
  });

  const openByDay = useMemo(() => {
    const map = new Map<string, BookableSession[]>(days.map((d) => [d, []]));
    (slotsQuery.data?.sessions ?? []).forEach((slot) => {
      if (!canMoveTo(slot, occurrenceId, sessionType, durationMinutes, price)) return;
      const viewerDay = getZonedISODate(bookableStart(slot), timeZone);
      map.get(viewerDay)?.push(slot);
    });
    map.forEach((list) => list.sort((a, b) => bookableStart(a).getTime() - bookableStart(b).getTime()));
    return map;
  }, [slotsQuery.data, days, occurrenceId, sessionType, durationMinutes, price, timeZone]);

  const slots = openByDay.get(day) ?? [];
  const picked = slots.find((slot) => slot.id === pick) ?? null;

  const move = useMutation({
    mutationFn: () => athleteSessionAPI.reschedule(bookingId, pick!, message),
    onSuccess: (result) => {
      const when = picked ? bookableStart(picked) : start;
      const label = `${short(isoDateInZone(when, timeZone))}, ${formatClock(when, timeZone)}`;
      onMoved(label, result.occurrenceId);
    },
    onError: (err: unknown) => {
      if (err instanceof MissingRpcError) {
        setUnavailable(true);
        return;
      }
      onError(err);
    },
  });

  const save = () => {
    if (unavailable) return;
    if (!pick) {
      setError("Pick a new time");
      return;
    }
    move.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className={spDialog}>
        <ModalHeader
          title="Reschedule"
          sub={`${title}, now ${short(currentDay)} at ${formatClock(start, timeZone)}`}
        />
        <ModalBody>
          {unavailable ? <Banner tone="neutral">Reschedule isn't available yet</Banner> : null}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5">
            {days.map((d) => {
              const n = openByDay.get(d)?.length ?? 0;
              const on = d === day;
              return (
                <button
                  key={d}
                  type="button"
                  className={dayTile(on)}
                  aria-pressed={on}
                  disabled={unavailable || !slotsQuery.data || !n}
                  onClick={() => {
                    setDay(d);
                    setPick(null);
                    setError(null);
                  }}
                >
                  <span className={dayTileWeekday(on)}>{formatDayISO(d, { weekday: "short" })}</span>
                  <b className={dayTileNumber}>{formatDayISO(d, { day: "numeric" })}</b>
                  <span className={dayTileWeekday(on)}>{slotsQuery.data ? (n ? `${n} open` : "Full") : "…"}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-label-xsm text-dark-300">Open times on {short(day)}</span>
            {slots.length ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
                {slots.map((slot) => {
                  const on = pick === slot.id;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      className={cn(timeTile(on), "h-[44px]")}
                      aria-pressed={on}
                      onClick={() => {
                        setPick(slot.id);
                        setError(null);
                      }}
                    >
                      {formatClock(bookableStart(slot), timeZone)}
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
              <span className="text-caption text-dark-300">
                {slotsQuery.isLoading ? "Loading open times…" : slotsQuery.isError ? "Open times didn't load. Try again." : "No open times this day"}
              </span>
            )}
            <FieldError>{error}</FieldError>
          </div>
          <Field title={`Message to ${coachFirst}`} optional>
            <textarea
              className={cn(input, "h-auto py-2")}
              rows={2}
              maxLength={500}
              value={message}
              disabled={unavailable}
              onChange={(e) => setMessage(e.target.value)}
            />
          </Field>
          <p className="text-caption text-dark-300">Your coach is notified right away. Payment and credits stay the same.</p>
        </ModalBody>
        <ModalFooter>
          <button type="button" className={secondaryButton} onClick={onClose}>
            Keep current time
          </button>
          <button type="button" className={primaryButton} disabled={move.isPending || unavailable} onClick={save}>
            {move.isPending ? "Moving…" : "Move session"}
          </button>
        </ModalFooter>
      </DialogContent>
    </Dialog>
  );
};
