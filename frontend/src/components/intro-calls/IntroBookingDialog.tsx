/** Family booking sheet for a free intro call (Working Copy `intro-book`): day, time, answers. */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { introCallsAPI, type CoachIntro } from "@/api/introCalls";
import {
  dayTile,
  dayTileNumber,
  dayTileWeekday,
  dialogContent,
  input,
  label,
  primaryButton,
  secondaryButton,
  timeTile,
} from "@/components/schedule/styles";
import { useAuth } from "@/contexts/AuthContext";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { cn } from "@/lib/utils";
import { ageOn } from "@/utils/athleteHome";
import { formatClock, formatDayISO } from "@/utils/schedule";
import { isoDateInZone, timeZoneAbbreviation } from "@/utils/viewerTime";
import { INTRO_KEYS, capText, errorText, firstName, introWhen, mText } from "./helpers";
import { SheetHeader } from "./parts";

export const IntroBookingDialog = ({
  open,
  coachId,
  coachName,
  intro,
  onClose,
}: {
  open: boolean;
  coachId: string;
  coachName: string;
  intro: CoachIntro;
  onClose: () => void;
}) => {
  const timeZone = useViewerTimeZone();
  const queryClient = useQueryClient();
  const { userName, userProfile } = useAuth();
  const coachFirst = firstName(coachName) || "the coach";
  const athleteFirst = firstName(intro.athlete?.name) || "your athlete";
  const parent = userName || userProfile?.name || "You";

  const days = useMemo(() => {
    const byDay = new Map<string, string[]>();
    for (const t of intro.times) {
      const day = isoDateInZone(new Date(t), timeZone);
      byDay.set(day, [...(byDay.get(day) ?? []), t]);
    }
    return [...byDay.entries()].map(([date, times]) => ({ date, times }));
  }, [intro.times, timeZone]);

  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const first = days[0];
    setDay(first?.date ?? null);
    setSlot(first?.times[0] ?? null);
    const age = intro.athlete ? ageOn(intro.athlete.birthDate, isoDateInZone(new Date(), timeZone)) : null;
    setAnswers(
      intro.questions.map((q, i) => (i === 0 && /age/i.test(q) && intro.athlete ? `${athleteFirst}${age != null ? `, ${age}` : ""}` : ""))
    );
    setDone(null);
    setError(null);
    // Reset when the sheet opens; later refreshes of the times keep the family's picks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pickDay = (date: string) => {
    setDay(date);
    setSlot(days.find((d) => d.date === date)?.times[0] ?? null);
  };

  const book = useMutation({
    mutationFn: () => introCallsAPI.book(coachId, slot!, answers.map((a) => a.trim())),
    onSuccess: () => {
      setDone(slot);
      void queryClient.invalidateQueries({ queryKey: INTRO_KEYS.coach(coachId) });
    },
    onError: (err) => {
      setError(errorText(err, "Couldn't book the intro call."));
      void queryClient.invalidateQueries({ queryKey: INTRO_KEYS.coach(coachId) });
    },
  });

  const times = days.find((d) => d.date === day)?.times ?? [];
  const video = intro.format === "video";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(dialogContent, "max-w-[560px]")}>
        {done ? (
          <>
            <SheetHeader title="Intro call booked" />
            <div className="flex flex-col items-center gap-3 px-5 pb-1 pt-3 text-center sm:px-[25px]">
              <span className="flex size-14 items-center justify-center rounded-full bg-[#CBE7D1] text-[#1E7431]">
                <Check className="size-6" strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="text-[16px] font-medium leading-[20px] tracking-[-0.05em] text-[#1A202C]">
                {introWhen(done, timeZone)} · {intro.minutes} min with {coachName}
              </span>
              <p className="max-w-[420px] text-[14px] leading-[20px] text-[#767980]">
                {video ? `Join from ${coachFirst}'s profile at the time.` : `${coachFirst} calls you at the time.`} {coachFirst} has your answers ahead of the call.{" "}
                {parent} joins as {athleteFirst}'s parent.
              </p>
            </div>
            <div className="flex justify-end px-5 pb-5 pt-4 sm:px-[25px]">
              <button type="button" className={primaryButton} onClick={onClose}>
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <SheetHeader
              title={`Free intro call with ${coachFirst}`}
              description={`${intro.minutes} min · ${video ? "Video call" : "Phone call"} · free · one per family`}
            />
            <div className="flex flex-col gap-4 px-5 pb-5 sm:px-[25px]">
              {!days.length ? (
                <p className="rounded-[8px] bg-[#F4F4EB] px-[14px] py-3 text-[14px] leading-[20px] text-[#484D56]">
                  {coachFirst} has no open times in the next two weeks. Check back soon or send a message.
                </p>
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    <span className={label}>Pick a day</span>
                    <div className="flex flex-wrap gap-2">
                      {days.map((d) => {
                        const on = d.date === day;
                        return (
                          <button
                            key={d.date}
                            type="button"
                            className={cn(dayTile(on), "w-14 md:w-16")}
                            aria-pressed={on}
                            aria-label={formatDayISO(d.date, { weekday: "long", month: "long", day: "numeric" })}
                            onClick={() => pickDay(d.date)}
                          >
                            <small className={cn(dayTileWeekday(on), "text-[11px] font-semibold uppercase tracking-[0.02em]")}>
                              {formatDayISO(d.date, { weekday: "short" })}
                            </small>
                            <b className={dayTileNumber}>{formatDayISO(d.date, { day: "numeric" })}</b>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className={label}>Pick a time</span>
                    <div className="flex flex-wrap gap-2">
                      {times.map((t) => {
                        const on = t === slot;
                        return (
                          <button key={t} type="button" className={cn(timeTile(on), "h-[38px] px-[14px] text-[14px] font-medium")} aria-pressed={on} onClick={() => setSlot(t)}>
                            {formatClock(new Date(t), timeZone)}
                          </button>
                        );
                      })}
                    </div>
                    <span className={capText}>
                      {timeZoneAbbreviation(timeZone)} time. Only {coachFirst}'s open times show.
                    </span>
                  </div>
                </>
              )}
              {intro.questions.map((q, i) => (
                <label key={i} className="flex flex-col gap-1.5">
                  <span className={label}>{q}</span>
                  {i === 0 ? (
                    <input className={input} value={answers[i] ?? ""} maxLength={500} onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))} />
                  ) : (
                    <textarea
                      className={cn(input, "h-auto py-2.5 leading-[18px]")}
                      rows={2}
                      value={answers[i] ?? ""}
                      maxLength={500}
                      placeholder="For example: First touch under pressure"
                      onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
                    />
                  )}
                </label>
              ))}
              <div className="flex items-start gap-[10px] rounded-[8px] bg-[#F4F4EB] px-[14px] py-3">
                <ShieldCheck className="mt-px size-[18px] flex-none text-[#117A96]" strokeWidth={1.5} aria-hidden="true" />
                <span className="flex flex-col gap-1">
                  <span className={mText}>
                    {parent} joins as {athleteFirst}'s parent
                  </span>
                  <span className={capText}>
                    {video
                      ? `No payment. You join from ${coachFirst}'s video link in the app, so no phone numbers are shared.`
                      : `No payment. ${coachFirst} calls the number on your account.`}
                  </span>
                </span>
              </div>
              {error ? (
                <p role="alert" className="text-[14px] text-[#972B2B]">
                  {error}
                </p>
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" className={secondaryButton} onClick={onClose}>
                  Cancel
                </button>
                <button type="button" className={primaryButton} disabled={!slot || book.isPending} onClick={() => book.mutate()}>
                  Book free intro call
                </button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
