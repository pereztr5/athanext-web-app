/**
 * Smaller My Schedule sheets (ATH-71): Clear day. Schedule settings and booking requests
 * are pages now (pages/ScheduleSettings.tsx, components/schedule/RequestsPage.tsx).
 */
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { scheduleAPI } from "@/api/schedule";
import { formatDayISO, plural } from "@/utils/schedule";
import {
  dangerButton,
  dialogContent,
  input,
  label,
  meta,
  secondaryButton,
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
