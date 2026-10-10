/**
 * Other time (Working Copy "Suggest another time"): pick up to 3 of the coach's open times in
 * the next two weeks and a message. The family books one; a new family's booking is a request
 * again, so the 24 hours start over.
 */
import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { bookingRequestsAPI, type BookingRequest } from "@/api/bookingRequests";
import { scheduleAPI } from "@/api/schedule";
import { Field, FieldError, ModalBody, ModalFooter, ModalHeader } from "@/components/coach-session/parts";
import { spDialog } from "@/components/coach-session/styles";
import { cn } from "@/lib/utils";
import { getZonedISODate } from "@/utils/dateHelpers";
import { addDaysISO, formatClock, formatDayISO, plural, sessionKind, sessionStart } from "@/utils/schedule";
import { input, primaryButton, secondaryButton, timeTile, timeTileNote } from "../styles";

const MAX_PICKS = 3;
const MAX_OPTIONS = 9;

// Supabase errors are plain objects with a message, not Error instances.
const errorText = (err: unknown, fallback: string) =>
  (err && typeof err === "object" && "message" in err && typeof err.message === "string" && err.message) || fallback;

export const SuggestTimesDialog = ({
  request,
  timeZone,
  now,
  onClose,
  onSent,
}: {
  request: BookingRequest | null;
  timeZone: string;
  now: Date;
  onClose: () => void;
  onSent: (count: number) => void;
}) => {
  const [picks, setPicks] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const today = getZonedISODate(now, timeZone);
  const who = request ? request.parentName || request.athleteName : "";
  const first = who.split(" ")[0];

  useEffect(() => {
    if (!request) return;
    setPicks([]);
    setError(null);
    const asked = new Date(request.start);
    setMessage(
      `Hi ${(request.parentName || request.athleteName).split(" ")[0]}, ${formatDayISO(getZonedISODate(asked, timeZone), { weekday: "long" })} at ${formatClock(asked, timeZone)} doesn't work for me, but any of these would. Pick the one that suits you best.`
    );
  }, [request, timeZone]);

  const from = today;
  const to = addDaysISO(today, 13);
  const schedule = useQuery({
    queryKey: ["coach-schedule", from, to],
    enabled: Boolean(request),
    queryFn: () => scheduleAPI.get(from, to),
  });
  const options = useMemo(
    () =>
      (schedule.data?.sessions ?? [])
        .filter((s) => s.id !== request?.occurrenceId && !s.isDraft && sessionKind(s) === "open" && sessionStart(s) > now)
        .sort((a, b) => sessionStart(a).getTime() - sessionStart(b).getTime())
        .slice(0, MAX_OPTIONS),
    [schedule.data, request?.occurrenceId, now]
  );

  const send = useMutation({
    mutationFn: () => bookingRequestsAPI.suggestOpenTimes(request!.bookingId, picks, message.trim()),
    onSuccess: (count) => onSent(count || picks.length),
    onError: (err: unknown) => setError(errorText(err, "Couldn't send it.")),
  });

  const toggle = (id: string) => {
    setError(null);
    setPicks((current) =>
      current.includes(id) ? current.filter((p) => p !== id) : current.length < MAX_PICKS ? [...current, id] : current
    );
    if (!picks.includes(id) && picks.length >= MAX_PICKS) setError("Up to 3 times");
  };

  return (
    <Dialog open={Boolean(request)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={spDialog}>
        <ModalHeader
          title="Suggest another time"
          sub={`For ${who}. Pick up to 3 of your open times. They choose one and pay, and the 24 hours start again.`}
        />
        <ModalBody>
          {schedule.isLoading ? (
            <p className="text-[14px] text-[#767980]">Loading your open times…</p>
          ) : options.length ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {options.map((s) => {
                const start = sessionStart(s);
                const on = picks.includes(s.id);
                return (
                  <button key={s.id} type="button" aria-pressed={on} className={cn(timeTile(on), "h-[58px]")} onClick={() => toggle(s.id)}>
                    <span>{formatDayISO(getZonedISODate(start, timeZone), { weekday: "short", day: "numeric" })}</span>
                    <small className={timeTileNote(on)}>
                      {on ? <Check strokeWidth={2} aria-hidden="true" /> : null}
                      {formatClock(start, timeZone)}
                    </small>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-[14px] text-[#767980]">No open times in the next two weeks. Add open slots with Create session first.</p>
          )}
          <Field title={`Message to ${first}`}>
            <textarea className={cn(input, "h-auto py-2 leading-[18px]")} rows={3} value={message} maxLength={1000} onChange={(e) => setMessage(e.target.value)} />
          </Field>
          <FieldError>{error}</FieldError>
        </ModalBody>
        <ModalFooter>
          <button type="button" className={secondaryButton} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={primaryButton} disabled={!picks.length || send.isPending} onClick={() => send.mutate()}>
            {picks.length ? `Send ${plural(picks.length, "option")} to ${first}` : "Pick at least one time"}
          </button>
        </ModalFooter>
      </DialogContent>
    </Dialog>
  );
};
