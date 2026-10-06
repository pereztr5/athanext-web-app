/**
 * Book a Session sheets (ATH-73): review the picked times and pay (or send requests), and
 * request a time that isn't listed.
 */
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, UserCheck, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BrandPill } from "@/components/brand";
import { bookAPI, type BookableSession, type BookingCoach } from "@/api/book";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { bookableEnd, bookableStart, money } from "@/utils/booking";
import { getZonedISODate } from "@/utils/dateHelpers";
import { addDaysISO, ALL_START_MINUTES, formatDayISO, formatMinutes, plural, viewerToEastern } from "@/utils/schedule";
import { formatInstantSpan } from "@/utils/viewerTime";
import { dialogContent, iconButton, input, label, meta, primaryButton, secondaryButton } from "@/components/schedule/styles";

export const ReviewDialog = ({
  open,
  onOpenChange,
  coach,
  picked,
  pillar,
  athleteId,
  timeZone,
  onRemove,
  onBooked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coach: BookingCoach | null;
  picked: BookableSession[];
  pillar: string | null;
  athleteId: string | null;
  timeZone: string;
  onRemove: (session: BookableSession) => void;
  onBooked: () => void;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setError(null), [open]);

  const total = picked.reduce((n, s) => n + s.price, 0);
  const requests = Boolean(coach?.needsRequest);
  const direct = Boolean(coach?.paysDirect);
  const first = coach?.name.split(" ")[0] ?? "The coach";

  const book = useMutation({
    mutationFn: () => bookAPI.checkout(picked.map((s) => s.id), athleteId!),
    onSuccess: (result) => {
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      if (result.direct) {
        setError(null);
        toast({
          title: picked.length > 1 ? `${plural(picked.length, "session")} booked` : "Session booked",
          description: `Pay ${first} directly${coach?.payNote ? `: ${coach.payNote.replace(/\.$/, "")}.` : "."} Nothing was charged in AthaNext.`,
        });
        queryClient.invalidateQueries({ queryKey: ["bookable-sessions"] });
        queryClient.invalidateQueries({ queryKey: ["sessions"] });
        onBooked();
        return;
      }
      toast({
        title: picked.length > 1 ? `${plural(picked.length, "request")} sent` : "Request sent",
        description: `${first} will accept or decline, usually within a day. You'll pay from My Sessions once they accept.`,
      });
      queryClient.invalidateQueries({ queryKey: ["bookable-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      onBooked();
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : "Couldn't book these sessions."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogContent}>
        <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
          <DialogTitle className="text-[22px] font-semibold leading-[28px] tracking-[-0.05em]">
            {requests ? "Review your request" : "Review your booking"}
          </DialogTitle>
          <DialogDescription className="sr-only">The times you picked and what happens next.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-5 pb-5 sm:px-[25px]">
          {picked.length ? (
            <div className="flex flex-col gap-2.5">
              {picked.map((s) => {
                const start = bookableStart(s);
                const d = getZonedISODate(start, timeZone);
                const group = s.sessionType === "group";
                return (
                  <div key={s.id} className="flex items-center gap-3 rounded-[8px] border border-[#EAEADF] bg-[#F9F9F5] p-3">
                    <span className={cn("flex w-[44px] flex-none flex-col items-center rounded-[8px] py-1.5", requests ? "bg-[#FCEFDA]" : "bg-[#E5EDF7]")}>
                      <small className="text-[11px] font-medium uppercase text-[#767980]">{formatDayISO(d, { weekday: "short" })}</small>
                      <b className="text-[18px] font-semibold leading-[20px]">{formatDayISO(d, { day: "numeric" })}</b>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <b className="text-[14px] font-medium">
                          {group ? `${s.sessionName} with ${first}` : `${s.pillar || pillar || "1-on-1"} with ${first}`}
                        </b>
                        {group ? <BrandPill tone="teal">Group</BrandPill> : <BrandPill tone="neutral">1-on-1</BrandPill>}
                      </span>
                      <span className={meta}>
                        {formatInstantSpan(start, bookableEnd(s), timeZone)} ·{" "}
                        {s.location === "online" ? "Video call" : s.place || coach?.locations[0] || "In person"}
                      </span>
                    </span>
                    <b className="text-[14px] font-medium">{money(s.price)}</b>
                    <button type="button" className={cn(iconButton, "size-[28px]")} aria-label="Remove" onClick={() => onRemove(s)}>
                      <X strokeWidth={1.5} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={meta}>Nothing picked yet.</p>
          )}

          {requests ? (
            <p className="flex items-start gap-2 rounded-[8px] bg-[#FCEFDA] px-3 py-2.5 text-[14px] leading-[18px] text-[#906A29]">
              <UserCheck className="mt-[1px] size-4 flex-none" strokeWidth={1.5} aria-hidden="true" />
              {first} approves new families first. Times are held for 24 hours
              {direct ? ". You pay them directly once they accept." : `, and you're only charged ${money(total)} if accepted.`}
            </p>
          ) : null}

          <button type="button" className="flex h-[40px] items-center justify-center gap-2 rounded-[8px] border border-dashed border-[#C1C1B8] text-[14px] font-medium text-[#0054B4] hover:bg-[#F4F4EB]" onClick={() => onOpenChange(false)}>
            <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
            Add another session
          </button>

          <div className="flex flex-col gap-2 rounded-[8px] bg-[#F1F1E6] px-4 py-3">
            <div className="flex justify-between text-[14px] text-[#484D56]">
              <span>{picked.length > 1 ? "Sessions" : "Session"}</span>
              <span>{money(total)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <b className="text-[16px] font-medium">{direct ? `Pay ${first} directly` : requests ? "Due if accepted" : "Total"}</b>
              <b className="text-[22px] font-semibold">{money(total)}</b>
            </div>
            <span className={meta}>
              {direct
                ? `${coach?.payNote ? `${coach.payNote}. ` : ""}${first} takes payment themselves. Nothing is charged in AthaNext.`
                : "Any booking fee is shown at checkout before you pay."}
            </span>
          </div>

          {error ? (
            <p role="alert" className="rounded-[8px] bg-[#FEDADA] px-3 py-2 text-[14px] text-[#972B2B]">
              {error}
            </p>
          ) : null}

          <button type="button" className={cn(primaryButton, "h-[44px] w-full")} disabled={!picked.length || !athleteId || book.isPending} onClick={() => book.mutate()}>
            {book.isPending
              ? requests
                ? "Sending…"
                : direct
                  ? "Booking…"
                  : "Opening checkout…"
              : requests
                ? `Send ${picked.length > 1 ? plural(picked.length, "request") : "request"}`
                : direct
                  ? "Confirm booking"
                  : `Pay ${money(total)}`}
          </button>
          {!athleteId ? <p className={meta}>Sign in as an athlete or parent to book.</p> : null}
          <span className={cn(meta, "text-center")}>
            Free cancellation with 24 hours notice. {requests
              ? "You get a message when they reply."
              : direct
                ? `You arrange payment with ${first}.`
                : "Card payments open Stripe's secure page. Nothing is saved to your account."}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const RequestTimeDialog = ({
  coach,
  pillar,
  todayISO,
  timeZone,
  onClose,
}: {
  coach: BookingCoach | null;
  pillar: string | null;
  todayISO: string;
  timeZone: string;
  onClose: () => void;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [day, setDay] = useState(addDaysISO(todayISO, 2));
  const [start, setStart] = useState(17 * 60);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDay(addDaysISO(todayISO, 2));
    setStart(17 * 60);
    setNote("");
    setError(null);
  }, [coach?.id, todayISO]);

  const first = coach?.name.split(" ")[0] ?? "the coach";
  const send = useMutation({
    mutationFn: () => {
      const at = viewerToEastern(day, start, timeZone);
      return bookAPI.requestTime(coach!.id, at.date, at.start, note.trim(), pillar);
    },
    onSuccess: () => {
      toast({
        title: `Request sent for ${formatDayISO(day, { weekday: "short", month: "short", day: "numeric" })}, ${formatMinutes(start)}`,
        description: `${first} usually replies within a day. Nothing is charged until they accept.`,
      });
      queryClient.invalidateQueries({ queryKey: ["bookable-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      onClose();
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : "Couldn't send the request."),
  });

  return (
    <Dialog open={Boolean(coach)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={dialogContent}>
        <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
          <DialogTitle className="text-[22px] font-semibold leading-[28px] tracking-[-0.05em]">Request a time with {first}</DialogTitle>
          <DialogDescription className={meta}>
            {pillar ?? "1-on-1"} · 60 min{coach?.hourlyRate ? ` · ${money(coach.hourlyRate)}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-5 pb-5 sm:px-[25px]">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={label}>Day</span>
              <input className={input} type="date" min={todayISO} value={day} onChange={(e) => setDay(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={label}>Start time</span>
              <select className={input} value={start} onChange={(e) => setStart(Number(e.target.value))}>
                {ALL_START_MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {formatMinutes(m)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className={label}>Note to {first} (optional)</span>
            <textarea
              className={cn(input, "h-auto py-2")}
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="For example, any weekday after 5 works"
            />
          </label>
          <p className={meta}>Nothing is charged until {first} accepts. You get a message either way, usually within a day.</p>
          {error ? (
            <p role="alert" className="rounded-[8px] bg-[#FCEFDA] px-3 py-2 text-[14px] text-[#906A29]">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryButton} onClick={onClose}>
              Cancel
            </button>
            <button type="button" className={primaryButton} disabled={!day || day < todayISO || send.isPending} onClick={() => send.mutate()}>
              Send request
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
