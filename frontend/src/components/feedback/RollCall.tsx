/**
 * Roll call for group feedback: everyone starts as Here, so the coach only taps the athletes
 * who missed it. One row per athlete with a Here / Missed switch.
 */
import { Check, X } from "@/components/icons";
import type { FeedbackAthlete } from "@/api/feedback";
import { segButton, segGroup, textButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { rollCallCount, rollCallLine } from "@/utils/feedback";
import { caption, firstName, shortName } from "./helpers";
import { FeedbackAvatar, Question } from "./parts";

/** Phone: 40px, no icons. Desktop: the standard segmented chip with an icon. */
const segment = "h-10 px-3 md:h-7 [&>svg]:hidden md:[&>svg]:block";
/** Selected Missed: info fill and border instead of the light chip. */
const missedOn = "border-info-300 bg-info-100 text-info-800 hover:text-info-800";

export const RollCall = ({
  athletes,
  absent,
  onChange,
  disabled,
  missedGetsShortMessage,
}: {
  athletes: FeedbackAthlete[];
  /** Athlete ids marked as missed. */
  absent: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
  missedGetsShortMessage: boolean;
}) => {
  const missed = athletes.filter((a) => absent.has(a.athleteId));
  const set = (athleteId: string, isMissed: boolean) => {
    const next = new Set(absent);
    if (isMissed) next.add(athleteId);
    else next.delete(athleteId);
    onChange(next);
  };

  return (
    <>
      <Question title="Who was here?">
        <span className="flex items-center gap-3">
          {missed.length && !disabled ? (
            <button type="button" className={textButton} onClick={() => onChange(new Set())}>
              Mark all here
            </button>
          ) : null}
          <span className="text-label-sm tabular-nums text-primary" aria-live="polite">
            {rollCallCount(athletes.length, missed.length)}
          </span>
        </span>
      </Question>
      {athletes.length ? (
        <ul className="flex flex-col gap-2">
          {athletes.map((a) => {
            const isMissed = absent.has(a.athleteId);
            return (
              <li
                key={a.bookingId}
                className={cn(
                  "flex items-center gap-3 rounded-control border px-3 py-2.5",
                  isMissed ? "border-info-300 bg-info-50" : "border-light-525 bg-light-300"
                )}
              >
                <FeedbackAvatar name={a.name} imageUrl={a.imageUrl} className={cn(isMissed && "opacity-60")} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <b className="truncate text-label-sm text-dark">{shortName(a.name)}</b>
                    {a.parentName ? <span className={cn(caption, "hidden truncate md:inline")}>{a.parentName}</span> : null}
                  </span>
                  {isMissed ? <span className="text-label-xsm text-info-800">Marked as missed. No individual note.</span> : null}
                </span>
                <div className={cn(segGroup, "flex-none")} role="group" aria-label={`Was ${firstName(a.name)} here?`}>
                  <button
                    type="button"
                    className={cn(segButton(!isMissed), segment)}
                    aria-pressed={!isMissed}
                    disabled={disabled}
                    onClick={() => set(a.athleteId, false)}
                  >
                    <Check strokeWidth={1.5} aria-hidden="true" />
                    Here
                  </button>
                  <button
                    type="button"
                    className={cn(segButton(false), segment, isMissed && missedOn)}
                    aria-pressed={isMissed}
                    disabled={disabled}
                    onClick={() => set(a.athleteId, true)}
                  >
                    <X strokeWidth={1.5} aria-hidden="true" />
                    Missed
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <span className={caption}>No athletes on this session.</span>
      )}
      {athletes.length ? (
        <p className={caption}>
          {rollCallLine({
            cameCount: athletes.length - missed.length,
            missedNames: missed.map((a) => firstName(a.name)),
            missedGetsShortMessage,
          })}
        </p>
      ) : null}
    </>
  );
};
