/**
 * Sunday check-in sheet (Working Copy): "Any time off next week?" Tap the days you're away;
 * saving clears those days on My schedule and opens again any day you switched back.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { scheduleAPI } from "@/api/schedule";
import { BrandPill } from "@/components/brand";
import { cn } from "@/lib/utils";
import { dialogContent, meta, primaryButton } from "@/components/schedule/styles";
import { addDaysISO, formatDayISO, plural, type ScheduleDay } from "@/utils/schedule";

export const WeekOffDialog = ({
  open,
  onOpenChange,
  monday,
  days,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monday: string;
  /** The seven days from `monday`, laid out by layoutDays. */
  days: ScheduleDay[];
  onSaved: () => void;
}) => {
  const { toast } = useToast();
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setOff(Object.fromEntries(days.map((d) => [d.date, Boolean(d.dayOff)])));
  }, [open, days]);

  const save = async () => {
    setSaving(true);
    try {
      for (const d of days) {
        if (off[d.date] && !d.dayOff) await scheduleAPI.clearDay(d.date, null);
        if (!off[d.date] && d.dayOff) await scheduleAPI.restoreDay(d.date);
      }
      const n = days.filter((d) => off[d.date]).length;
      toast({ title: n ? `${plural(n, "day")} off next week` : "No time off next week" });
      onSaved();
      onOpenChange(false);
    } catch {
      toast({ title: "Couldn't save your days off", description: "Try again in a moment.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogContent}>
        <DialogHeader className="gap-1 border-b border-light-525 px-5 pb-4 pt-5 text-left">
          <DialogTitle className="text-card-title">Any time off next week?</DialogTitle>
          <DialogDescription className={meta}>
            {formatDayISO(monday, { month: "short", day: "numeric" })} to {formatDayISO(addDaysISO(monday, 6), { month: "short", day: "numeric" })}. Tap the
            days you're away. Families can't book them.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 px-5 py-4">
          {days.map((d) => {
            const isOff = Boolean(off[d.date]);
            const openCount = d.items.filter((i) => i.kind === "open").length;
            const bookedCount = d.items.filter((i) => i.kind === "booked" || i.kind === "group").length;
            return (
              <button
                key={d.date}
                type="button"
                aria-pressed={isOff}
                onClick={() => setOff((o) => ({ ...o, [d.date]: !o[d.date] }))}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-control border border-light-525 px-3.5 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  isOff ? "border-dashed bg-light-400" : "bg-light-300"
                )}
              >
                <span className="flex min-w-0 grow flex-col gap-0.5">
                  <b className="text-label-sm">{formatDayISO(d.date, { weekday: "long", month: "short", day: "numeric" })}</b>
                  <span className="text-caption text-dark-300">
                    {openCount ? plural(openCount, "open time") : "No open times"}
                    {bookedCount ? ` · ${plural(bookedCount, "session")} booked` : ""}
                  </span>
                </span>
                <BrandPill tone={isOff ? "amber" : "teal"}>{isOff ? "Off" : "Working"}</BrandPill>
              </button>
            );
          })}
          <p className="text-caption text-dark-300">
            Sessions already booked on a day off stay booked. Move or cancel them from the session if you need to.
          </p>
        </div>
        <div className="border-t border-light-525 px-5 py-4">
          <button type="button" className={cn(primaryButton, "w-full")} disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
