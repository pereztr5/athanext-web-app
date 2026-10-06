/**
 * Booking requests (ATH-71, ATH-85). Each request: who, when, note, then Decline, Suggest
 * another time (1-on-1), Message and Accept. A full group can't be accepted. Times the coach
 * suggested wait in "Waiting for the family" until the family books one.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BrandPill } from "@/components/brand";
import { bookingRequestsAPI, type BookingRequest } from "@/api/bookingRequests";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { getZonedISODate } from "@/utils/dateHelpers";
import { ageGroup } from "@/utils/athleteHome";
import { formatExpiry } from "@/utils/requestWaiting";
import { ALL_START_MINUTES, formatMinutes, minutesInZone, viewerToEastern } from "@/utils/schedule";
import { formatDateInZone, formatInstantSpan } from "@/utils/viewerTime";
import { dialogContent, input, label, meta, primaryButton, secondaryButton, textButton } from "./styles";

// Supabase errors are plain objects with a message, not Error instances.
const errorText = (err: unknown, fallback: string) =>
  (err && typeof err === "object" && "message" in err && typeof err.message === "string" && err.message) || fallback;

const when = (start: Date, end: Date, timeZone: string) =>
  `${formatDateInZone(start, timeZone, { weekday: "short", month: "short", day: "numeric" })}, ${formatInstantSpan(start, end, timeZone)}`;

const SuggestTime = ({
  request,
  timeZone,
  onCancel,
  onSent,
}: {
  request: BookingRequest;
  timeZone: string;
  onCancel: () => void;
  onSent: () => void;
}) => {
  const { toast } = useToast();
  const today = getZonedISODate(new Date(), timeZone);
  const asked = new Date(request.start);
  const [date, setDate] = useState(getZonedISODate(asked, timeZone));
  const [minutes, setMinutes] = useState(() => {
    const m = minutesInZone(asked, timeZone);
    return ALL_START_MINUTES.includes(m) ? m : 17 * 60;
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const first = request.athleteName.split(" ")[0];
  const label_ = `${formatDateInZone(new Date(`${date}T12:00:00Z`), "UTC", { weekday: "short", month: "short", day: "numeric" })} at ${formatMinutes(minutes)}`;

  useEffect(() => {
    setMessage(`Hi! That time doesn't work for me. How about ${label_}? You can book it from My Sessions.`);
    // Only refill while the coach hasn't typed their own message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, minutes]);

  const send = useMutation({
    mutationFn: () => {
      const eastern = viewerToEastern(date, minutes, timeZone);
      return bookingRequestsAPI.suggestTime(request.bookingId, eastern.date, `${eastern.start}:00`, message);
    },
    onSuccess: () => {
      toast({ title: `Suggested ${label_} to ${first}`, description: "It waits in Waiting for the family until they book it." });
      onSent();
    },
    onError: (err: unknown) => setError(errorText(err, "Couldn't send it.")),
  });

  return (
    <div className="flex flex-col gap-3 rounded-[8px] border border-[#CCDDF0] bg-[#F4F8FC] p-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1.5">
          <span className={label}>Day</span>
          <input className={input} type="date" min={today} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Start</span>
          <select className={input} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            {ALL_START_MINUTES.map((m) => (
              <option key={m} value={m}>
                {formatMinutes(m)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className={label}>Message to {first}'s family</span>
        <textarea className={cn(input, "h-auto py-2 leading-[18px]")} rows={3} value={message} maxLength={1000} onChange={(e) => setMessage(e.target.value)} />
      </label>
      {error ? <p role="alert" className="text-[14px] text-[#972B2B]">{error}</p> : null}
      <div className="flex gap-2">
        <button type="button" className={cn(primaryButton, "flex-1")} disabled={send.isPending} onClick={() => { setError(null); send.mutate(); }}>
          {send.isPending ? "Sending…" : "Send suggestion"}
        </button>
        <button type="button" className={secondaryButton} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
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
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [suggesting, setSuggesting] = useState<string | null>(null);
  const waiting = useQuery({ queryKey: ["waiting-suggestions"], queryFn: () => bookingRequestsAPI.waiting(), enabled: open });

  useEffect(() => {
    if (!open) setSuggesting(null);
  }, [open]);

  const message = useMutation({
    mutationFn: (athleteId: string) => bookingRequestsAPI.openConversation(athleteId),
    onSuccess: (conversationId) => navigate(`${ROUTES.CHAT}?conversationId=${conversationId}`),
    onError: (err: unknown) =>
      toast({ title: "Couldn't open the chat", description: errorText(err, ""), variant: "destructive" }),
  });

  const suggested = () => {
    setSuggesting(null);
    queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
    queryClient.invalidateQueries({ queryKey: ["waiting-suggestions"] });
    queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogContent}>
        <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
          <DialogTitle className="text-[22px] font-semibold leading-[28px] tracking-[-0.05em]">Booking requests</DialogTitle>
          <DialogDescription className={meta}>Held for 24 hours. Families are charged only if you accept.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 px-5 pb-5 sm:px-[25px]">
          {requests.length ? (
            requests.map((request) => {
              const start = new Date(request.start);
              const group = request.sessionType === "group";
              const full = group && request.taken >= request.capacity;
              return (
                <div key={request.bookingId} className="flex flex-col gap-3 rounded-[8px] border border-[#EAEADF] bg-[#F9F9F5] p-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <b className="text-[14px] font-medium">
                        {[
                          request.athleteName.split(" ")[0],
                          ageGroup(request.athleteBirthDate, getZonedISODate(now, timeZone)),
                          request.athletePosition,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </b>
                      <BrandPill tone="amber">{formatExpiry(request.expiresAt, now)}</BrandPill>
                    </div>
                    <span className={meta}>
                      {group ? `${request.sessionName} · group · ${request.taken} of ${request.capacity} spots taken` : "1-on-1"} · ${Math.round(request.price)}
                    </span>
                    <span className={meta}>{when(start, new Date(request.end), timeZone)}</span>
                    {request.notes ? <p className="text-[12px] italic text-[#484D56]">“{request.notes}”</p> : null}
                  </div>
                  {suggesting === request.bookingId ? (
                    <SuggestTime request={request} timeZone={timeZone} onCancel={() => setSuggesting(null)} onSent={suggested} />
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className={cn(secondaryButton, "flex-1")}
                          disabled={respondingId !== null}
                          onClick={() => onRespond(request.bookingId, false)}
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          className={cn(primaryButton, "flex-1")}
                          disabled={respondingId !== null || full}
                          onClick={() => onRespond(request.bookingId, true)}
                        >
                          {full ? "Group is full" : "Accept"}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {!group ? (
                          <button type="button" className={textButton} onClick={() => setSuggesting(request.bookingId)}>
                            Suggest another time
                          </button>
                        ) : null}
                        {request.athleteId ? (
                          <button
                            type="button"
                            className={textButton}
                            disabled={message.isPending}
                            onClick={() => message.mutate(request.athleteId!)}
                          >
                            <MessageCircle strokeWidth={1.5} aria-hidden="true" />
                            Message
                          </button>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>
              );
            })
          ) : (
            <p className={meta}>No requests waiting.</p>
          )}

          {waiting.data?.length ? (
            <section className="flex flex-col gap-2 pt-2">
              <h3 className="text-[16px] font-medium">Waiting for the family</h3>
              <ul className="flex flex-col divide-y divide-[#EAEADF]">
                {waiting.data.map((item) => (
                  <li key={item.occurrenceId} className="flex flex-col gap-0.5 py-2">
                    <b className="text-[14px] font-medium">{item.athleteName}</b>
                    <span className={meta}>
                      You suggested {when(new Date(item.start), new Date(item.end), timeZone)} · ${Math.round(item.price)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};
