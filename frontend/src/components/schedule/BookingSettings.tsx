/**
 * Booking rules and Google Calendar sync, shared by My Schedule's Schedule settings and the
 * coach's Account Settings (ATH-87).
 */
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck2, RefreshCw } from "lucide-react";
import { calendarSyncAPI, scheduleAPI, type CoachSchedule, type NewFamilyBooking } from "@/api/schedule";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { plural } from "@/utils/schedule";
import { formatDateInZone } from "@/utils/viewerTime";
import { input, label, meta, primaryButton, secondaryButton, segButton, segGroup, textButton } from "./styles";

const useFail = () => {
  const { toast } = useToast();
  return (err: unknown) =>
    toast({ title: "Something went wrong", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
};

export const BookingRulesSection = ({
  rules,
  onSaved,
}: {
  rules: CoachSchedule["rules"] | undefined;
  onSaved?: () => void;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fail = useFail();
  const [newFamilies, setNewFamilies] = useState<NewFamilyBooking>("request");
  const [weeks, setWeeks] = useState(4);

  useEffect(() => {
    if (!rules) return;
    setNewFamilies(rules.newFamilyBooking);
    setWeeks(rules.bookingWindowWeeks);
  }, [rules]);

  const save = useMutation({
    mutationFn: () => scheduleAPI.setRules(newFamilies, weeks),
    onSuccess: () => {
      toast({ title: "Booking rules saved" });
      queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
      onSaved?.();
    },
    onError: fail,
  });

  const changed = rules && (newFamilies !== rules.newFamilyBooking || weeks !== rules.bookingWindowWeeks);

  return (
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
  );
};

export const CalendarSyncSection = ({ calendar }: { calendar: CoachSchedule["calendar"] | undefined }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fail = useFail();

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

  return (
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
              {!calendar.canWrite ? (
                <span className="text-[12px] text-[#906A29]">Connect again to add accepted bookings to your calendar.</span>
              ) : null}
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
            {calendar.syncError === "reconnect" || !calendar.canWrite ? (
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
  );
};
