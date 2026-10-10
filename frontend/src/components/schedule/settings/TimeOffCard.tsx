import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarOff, Plus, X } from "lucide-react";
import { scheduleAPI, type TimeOffDay } from "@/api/schedule";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDayISO, plural } from "@/utils/schedule";
import { card, input, secondaryButton, smallButton } from "../styles";
import { CardHeading, caption } from "./shared";
import { useFail } from "./useFail";

export const TimeOffCard = ({ days, today, loading }: { days: TimeOffDay[]; today: string; loading: boolean }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fail = useFail();
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["schedule-settings"] });
    queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
  };
  const short = (iso: string) => formatDayISO(iso, { weekday: "short", month: "short", day: "numeric" });

  const add = useMutation({
    mutationFn: () => scheduleAPI.clearDay(date, note.trim() || null),
    onSuccess: (closed) => {
      toast({ title: `${short(date)} is off`, description: closed ? `${plural(closed, "open slot")} closed.` : undefined });
      setDate("");
      setNote("");
      refresh();
    },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (day: string) => scheduleAPI.restoreDay(day),
    onSuccess: () => {
      toast({ title: "Day off removed" });
      refresh();
    },
    onError: fail,
  });

  const submit = () => {
    if (!date) {
      toast({ title: "Pick a day" });
      return;
    }
    add.mutate();
  };

  const upcoming = days.filter((d) => d.date >= today);

  return (
    <section className={card}>
      <CardHeading icon={CalendarOff} title="Time off" />
      <p className={cn(caption, "-mt-2.5")}>Days you're away. Families can't book them.</p>
      {loading ? (
        <div className="h-[34px] animate-pulse rounded-[8px] bg-[#F1F1E6]" />
      ) : upcoming.length ? (
        upcoming.map((d) => (
          <div key={d.date} className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium">{formatDayISO(d.date, { weekday: "long", month: "short", day: "numeric" })}</span>
              {d.note ? <span className={caption}>{d.note}</span> : null}
            </div>
            <button
              type="button"
              className="inline-flex size-[30px] flex-none items-center justify-center rounded-[8px] text-[#767980] hover:bg-[#F4F4EB] hover:text-[#1A202C] disabled:opacity-50"
              aria-label={`Remove ${short(d.date)}`}
              disabled={remove.isPending && remove.variables === d.date}
              onClick={() => remove.mutate(d.date)}
            >
              <X className="size-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        ))
      ) : (
        <p className="text-[14px] text-[#767980]">No time off coming up.</p>
      )}
      <div className="flex flex-col gap-2">
        <input className={input} type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Day off" />
        <input
          className={input}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note, for example Tournament (optional)"
          aria-label="Note"
          maxLength={200}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button type="button" className={cn(secondaryButton, smallButton, "self-start")} disabled={add.isPending} onClick={submit}>
          <Plus strokeWidth={1.5} aria-hidden="true" />
          Add day off
        </button>
      </div>
    </section>
  );
};
