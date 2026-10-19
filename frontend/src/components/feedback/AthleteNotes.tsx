import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, ChevronUp, Plus } from "@/components/icons";
import type { FeedbackAthlete } from "@/api/feedback";
import { secondaryButton, smallButton, textButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { NOTE_STARTERS, appendSentence, caption, firstName, textarea } from "./helpers";
import { FeedbackAvatar, Question, StarterChips } from "./parts";

/** "Notes for each athlete" on a group check-in: one row per athlete who came, sent with the summary. */
export const AthleteNotes = ({
  athletes,
  notes,
  onChange,
}: {
  athletes: FeedbackAthlete[];
  notes: Record<string, string>;
  onChange: (bookingId: string, note: string) => void;
}) => {
  const [open, setOpen] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const has = (a: FeedbackAthlete) => Boolean((notes[a.bookingId] ?? "").trim());
  const done = athletes.filter(has).length;

  useEffect(() => {
    if (!open) return;
    areaRef.current?.focus();
    areaRef.current?.scrollIntoView({ block: "nearest" });
  }, [open]);

  return (
    <>
      <Question title="Notes for each athlete">
        <span className={caption}>Optional</span>
      </Question>
      <div className="flex items-center justify-between gap-3">
        <span className={caption}>Only that athlete's family sees it.</span>
        <span className={caption}>
          <b className="font-medium text-dark">
            {done} of {athletes.length}
          </b>{" "}
          added
        </span>
      </div>
      <div className="-mt-1.5 h-[5px] overflow-hidden rounded-full bg-light-550" aria-hidden="true">
        <i className="block h-full rounded-full bg-primary transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${(done / athletes.length) * 100}%` }} />
      </div>
      <div className="flex flex-col rounded-card border border-light-525 bg-light-300">
        {athletes.map((a, i) => {
          const text = notes[a.bookingId] ?? "";
          const isOpen = open === a.bookingId;
          const next = athletes.slice(i + 1).find((y) => !has(y)) ?? athletes[i + 1];
          return (
            <div key={a.bookingId} className={cn(i > 0 && "border-t border-light-525")}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : a.bookingId)}
                className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left"
              >
                <FeedbackAvatar name={a.name} imageUrl={a.imageUrl} size={32} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-label-sm text-dark">{a.name}</span>
                  <span className={cn(caption, "truncate")}>{has(a) && !isOpen ? text : "Athlete"}</span>
                </span>
                {isOpen ? (
                  <ChevronUp className="size-4 flex-none text-dark-300" strokeWidth={1.5} aria-hidden="true" />
                ) : has(a) ? (
                  <span className="inline-flex flex-none items-center gap-[3px] text-label-xsm text-success-700">
                    <Check className="size-3" strokeWidth={2} aria-hidden="true" />
                    Added
                  </span>
                ) : (
                  <span className="inline-flex flex-none items-center gap-[3px] text-label-xsm text-primary">
                    <Plus className="size-3" strokeWidth={2} aria-hidden="true" />
                    Note
                  </span>
                )}
              </button>
              {isOpen ? (
                <div className="flex flex-col gap-2.5 px-3.5 pb-3.5">
                  <StarterChips
                    chips={NOTE_STARTERS}
                    onPick={(c) => {
                      onChange(a.bookingId, appendSentence(text, c));
                      areaRef.current?.focus();
                    }}
                  />
                  <textarea
                    ref={areaRef}
                    className={textarea}
                    rows={3}
                    maxLength={2000}
                    value={text}
                    onChange={(e) => onChange(a.bookingId, e.target.value)}
                    placeholder={`A note for ${firstName(a.name)}'s family`}
                    aria-label={`Note for ${a.name}`}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <button type="button" className={textButton} onClick={() => setOpen(null)}>
                      Done
                    </button>
                    {next ? (
                      <button type="button" className={cn(secondaryButton, smallButton)} onClick={() => setOpen(next.bookingId)}>
                        Next: {firstName(next.name)}
                        <ChevronRight strokeWidth={1.5} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
};
