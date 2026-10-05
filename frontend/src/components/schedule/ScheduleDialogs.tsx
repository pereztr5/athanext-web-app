/**
 * Smaller My Schedule sheets (ATH-71): Clear day, Schedule settings (booking rules, Google
 * Calendar, days off) and the booking requests list.
 */
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck2, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BrandPill } from "@/components/brand";
import type { BookingRequest } from "@/api/bookingRequests";
import { calendarSyncAPI, scheduleAPI, type CoachSchedule, type NewFamilyBooking, type TimeOffDay } from "@/api/schedule";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDayISO, plural } from "@/utils/schedule";
import { formatExpiry } from "@/utils/requestWaiting";
import { formatDateInZone, formatInstantSpan } from "@/utils/viewerTime";
import {
  dangerButton,
  dialogContent,
  input,
  label,
  meta,
  primaryButton,
  secondaryButton,
  segButton,
  segGroup,
  textButton,
} from "./styles";

const Header = ({ title, description }: { title: string; description?: string }) => (
  <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
    <DialogTitle className="text-[22px] font-semibold leading-[28px] tracking-[-0.05em]">{title}</DialogTitle>
    {description ? (
      <DialogDescription className={meta}>{description}</DialogDescription>
    ) : (
      <DialogDescription className="sr-only">Schedule</DialogDescription>
    )}
  </DialogHeader>
);

export const ClearDayDialog = ({
  date,
  openSlots,
  bookedSessions,
  onClose,
  onCleared,
}: {
  date: string | null;
  openSlots: number;
  bookedSessions: number;
  onClose: () => void;
  onCleared: (date: string, closed: number) => void;
}) => {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setNote("");
    setError(null);
  }, [date]);

  const clear = useMutation({
    mutationFn: () => scheduleAPI.clearDay(date!, note.trim() || null),
    onSuccess: (closed) => onCleared(date!, closed),
    onError: (err: unknown) => setError(err instanceof Error ? err.message : "Couldn't clear the day."),
  });

  return (
    <Dialog open={Boolean(date)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={dialogContent}>
        {date ? (
          <>
            <Header title={`Clear ${formatDayISO(date, { weekday: "long", month: "short", day: "numeric" })}?`} />
            <div className="flex flex-col gap-4 px-5 pb-5 sm:px-[25px]">
              <p className="text-[14px] leading-[20px] text-[#484D56]">
                {openSlots ? `Closes ${plural(openSlots, "open slot")} so families can't book this day.` : "Families won't be able to book this day."}
                {bookedSessions ? ` ${plural(bookedSessions, "session")} already booked ${bookedSessions > 1 ? "stay" : "stays"} booked.` : ""}
              </p>
              <label className="flex flex-col gap-1.5">
                <span className={label}>Note (optional)</span>
                <input className={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example, Tournament" maxLength={200} />
              </label>
              {error ? <p role="alert" className="text-[14px] text-[#972B2B]">{error}</p> : null}
              <div className="flex justify-end gap-2">
                <button type="button" className={secondaryButton} onClick={onClose}>
                  Cancel
                </button>
                <button type="button" className={dangerButton} disabled={clear.isPending} onClick={() => clear.mutate()}>
                  Clear day
                </button>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export const ScheduleSettingsDialog = ({
  open,
  onOpenChange,
  schedule,
  upcomingTimeOff,
  onRestoreDay,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: CoachSchedule | undefined;
  upcomingTimeOff: TimeOffDay[];
  onRestoreDay: (date: string) => void;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newFamilies, setNewFamilies] = useState<NewFamilyBooking>("request");
  const [weeks, setWeeks] = useState(4);

  useEffect(() => {
    if (!open || !schedule) return;
    setNewFamilies(schedule.rules.newFamilyBooking);
    setWeeks(schedule.rules.bookingWindowWeeks);
  }, [open, schedule]);

  const fail = (err: unknown) =>
    toast({ title: "Something went wrong", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });

  const save = useMutation({
    mutationFn: () => scheduleAPI.setRules(newFamilies, weeks),
    onSuccess: () => {
      toast({ title: "Booking rules saved" });
      queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
      onOpenChange(false);
    },
    onError: fail,
  });

  const connect = useMutation({
    mutationFn: () => calendarSyncAPI.connectUrl(),
    onSuccess: (url) => {
      window.location.href = url;
    },
    onError: fail,
  });
  const sync = useMutation({
    mutationFn: () => calendarSyncAPI.sync(),
    onSuccess: (synced) => {
      toast({ title: synced ? "Busy times updated" : "Couldn't reach Google Calendar" });
      queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
    },
    onError: fail,
  });
  const disconnect = useMutation({
    mutationFn: () => calendarSyncAPI.disconnect(),
    onSuccess: () => {
      toast({ title: "Google Calendar disconnected" });
      queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
    },
    onError: fail,
  });

  const calendar = schedule?.calendar ?? null;
  const changed =
    schedule && (newFamilies !== schedule.rules.newFamilyBooking || weeks !== schedule.rules.bookingWindowWeeks);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogContent}>
        <Header title="Schedule settings" />
        <div className="flex flex-col gap-6 px-5 pb-5 sm:px-[25px]">
          <section className="flex flex-col gap-3">
            <h3 className="text-[16px] font-medium">Booking rules</h3>
            <div className="flex flex-col gap-1.5">
              <span className={label}>Families new to you</span>
              <div className={segGroup} role="group" aria-label="Families new to you">
                <button type="button" className={segButton(newFamilies === "request")} aria-pressed={newFamilies === "request"} onClick={() => setNewFamilies("request")}>
                  Send a request
                </button>
                <button type="button" className={segButton(newFamilies === "instant")} aria-pressed={newFamilies === "instant"} onClick={() => setNewFamilies("instant")}>
                  Instant booking
                </button>
              </div>
              <span className={meta}>
                {newFamilies === "request"
                  ? "Their booking is held for 24 hours until you accept. They're only charged if you do."
                  : "They book and pay straight away."}{" "}
                Families who already train with you always book instantly.
              </span>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className={label}>Open slots show</span>
              <select className={input} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => (
                  <option key={w} value={w}>
                    {plural(w, "week")} ahead
                  </option>
                ))}
              </select>
            </label>
            {changed ? (
              <button type="button" className={cn(primaryButton, "self-end")} disabled={save.isPending} onClick={() => save.mutate()}>
                Save rules
              </button>
            ) : null}
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-[16px] font-medium">Google Calendar</h3>
            {calendar ? (
              <>
                <div className="flex items-start gap-2 rounded-[8px] bg-[#F1F1E6] px-3 py-2.5">
                  <CalendarCheck2 className="mt-[1px] size-4 flex-none text-[#1E7431]" strokeWidth={1.5} aria-hidden="true" />
                  <span className="flex flex-col gap-0.5">
                    <b className="text-[14px] font-medium">Connected{calendar.accountEmail ? ` as ${calendar.accountEmail}` : ""}</b>
                    <span className={meta}>
                      Busy times hide your open slots.
                      {calendar.lastSyncedAt
                        ? ` Updated ${formatDateInZone(new Date(calendar.lastSyncedAt), Intl.DateTimeFormat().resolvedOptions().timeZone, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.`
                        : ""}
                    </span>
                    {calendar.syncError ? (
                      <span className="text-[12px] text-[#972B2B]">
                        {calendar.syncError === "reconnect" ? "Google stopped the connection. Connect again." : `Last update failed: ${calendar.syncError}`}
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={secondaryButton} disabled={sync.isPending} onClick={() => sync.mutate()}>
                    <RefreshCw strokeWidth={1.5} aria-hidden="true" />
                    Update now
                  </button>
                  {calendar.syncError === "reconnect" ? (
                    <button type="button" className={primaryButton} disabled={connect.isPending} onClick={() => connect.mutate()}>
                      Connect again
                    </button>
                  ) : null}
                  <button type="button" className={textButton} disabled={disconnect.isPending} onClick={() => disconnect.mutate()}>
                    Disconnect
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[14px] leading-[20px] text-[#484D56]">
                  Connect your Google Calendar so families can't book times you're busy. AthaNext only sees when you're busy, never what the events are.
                </p>
                <button type="button" className={cn(primaryButton, "self-start")} disabled={connect.isPending} onClick={() => connect.mutate()}>
                  Connect Google Calendar
                </button>
              </>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-[16px] font-medium">Days off</h3>
            {upcomingTimeOff.length ? (
              <ul className="flex flex-col divide-y divide-[#EAEADF]">
                {upcomingTimeOff.map((t) => (
                  <li key={t.date} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-[14px]">
                      {formatDayISO(t.date, { weekday: "short", month: "short", day: "numeric" })}
                      {t.note ? <span className="text-[#767980]"> · {t.note}</span> : null}
                    </span>
                    <button type="button" className={textButton} onClick={() => onRestoreDay(t.date)}>
                      Undo
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={meta}>No days off coming up. Use Clear day on any day you're away.</p>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const RequestsDialog = ({
  open,
  onOpenChange,
  requests,
  timeZone,
  now,
  respondingId,
  onRespond,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requests: BookingRequest[];
  timeZone: string;
  now: Date;
  respondingId: string | null;
  onRespond: (bookingId: string, accept: boolean) => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className={dialogContent}>
      <Header title="Booking requests" description="Held for 24 hours. Families are charged only if you accept." />
      <div className="flex flex-col gap-3 px-5 pb-5 sm:px-[25px]">
        {requests.length ? (
          requests.map((request) => {
            const start = new Date(request.start);
            return (
              <div key={request.bookingId} className="flex flex-col gap-3 rounded-[8px] border border-[#EAEADF] bg-[#F9F9F5] p-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <b className="text-[14px] font-medium">{request.athleteName}</b>
                    <BrandPill tone="amber">{formatExpiry(request.expiresAt, now)}</BrandPill>
                  </div>
                  <span className={meta}>
                    {request.sessionType === "group" ? `${request.sessionName} · group` : "1-on-1"} · ${Math.round(request.price)}
                  </span>
                  <span className={meta}>
                    {formatDateInZone(start, timeZone, { weekday: "short", month: "short", day: "numeric" })},{" "}
                    {formatInstantSpan(start, new Date(request.end), timeZone)}
                  </span>
                  {request.notes ? <p className="text-[12px] italic text-[#484D56]">“{request.notes}”</p> : null}
                </div>
                <div className="flex gap-2">
                  <button type="button" className={cn(secondaryButton, "flex-1")} disabled={respondingId !== null} onClick={() => onRespond(request.bookingId, false)}>
                    Decline
                  </button>
                  <button type="button" className={cn(primaryButton, "flex-1")} disabled={respondingId !== null} onClick={() => onRespond(request.bookingId, true)}>
                    Accept
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <p className={meta}>No requests waiting.</p>
        )}
      </div>
    </DialogContent>
  </Dialog>
);
