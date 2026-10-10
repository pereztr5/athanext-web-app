/**
 * Booking requests (ATH-71, ATH-85, Working Copy): a full page under My Schedule
 * (/schedule?requests=1). Each card: who asked and for whom, hours left, what and when, the
 * family's note, then Decline (reason and message), Other time (1-on-1) or Message (group),
 * and Accept. Times the coach suggested wait under "Waiting for the family".
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Clock, Inbox, User, Users } from "lucide-react";
import { BrandPill } from "@/components/brand";
import { bookingRequestsAPI, type BookingRequest } from "@/api/bookingRequests";
import { DeclineDialog } from "@/components/coach-session/DeclineDialog";
import { Avatar } from "@/components/coach-session/parts";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { getZonedISODate } from "@/utils/dateHelpers";
import { formatClock, formatDayISO, plural } from "@/utils/schedule";
import { formatDateInZone, formatInstantSpan } from "@/utils/viewerTime";
import { card, pageTitle, primaryButton, secondaryButton, smallButton } from "./styles";
import { SuggestTimesDialog } from "./views/SuggestTimesDialog";

// Supabase errors are plain objects with a message, not Error instances.
const errorText = (err: unknown, fallback: string) =>
  (err && typeof err === "object" && "message" in err && typeof err.message === "string" && err.message) || fallback;

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

const ageOn = (birthDate: string | null, todayISO: string) => {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = todayISO.split("-").map(Number);
  const age = ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
  return age > 0 && age < 100 ? age : null;
};

const hoursLeft = (expiresAt: string | null, now: Date) =>
  expiresAt ? Math.max(0, Math.round((Date.parse(expiresAt) - now.getTime()) / 3_600_000)) : null;

const RequestCard = ({
  request,
  timeZone,
  now,
  busy,
  onDecline,
  onSuggest,
  onMessage,
  onAccept,
}: {
  request: BookingRequest;
  timeZone: string;
  now: Date;
  busy: boolean;
  onDecline: () => void;
  onSuggest: () => void;
  onMessage: () => void;
  onAccept: () => void;
}) => {
  const group = request.sessionType === "group";
  const full = group && request.taken >= request.capacity;
  const start = new Date(request.start);
  const hours = hoursLeft(request.expiresAt, now);
  const first = request.athleteName.split(" ")[0];
  const age = ageOn(request.athleteBirthDate, getZonedISODate(now, timeZone));
  const forWho = `${request.parentName ? `for ${first}` : first}${age ? `, ${age}` : ""}`;

  return (
    <div className="flex flex-col gap-2.5 rounded-[12px] border border-[#EAEADF] bg-[#F7F7F0] p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar name={request.parentName || request.athleteName} imageUrl={request.parentName ? null : request.athletePhoto} size={36} />
          <span className="flex min-w-0 flex-col gap-0.5">
            <b className="truncate text-[15px] font-semibold leading-[18px] text-[#1A202C]">{request.parentName || request.athleteName}</b>
            <span className="text-[12px] leading-[14px] text-[#767980]">
              {forWho} · {request.familyBadge || "New family"}
            </span>
          </span>
        </span>
        {hours !== null ? (
          <span className={cn("inline-flex flex-none items-center gap-1 whitespace-nowrap text-[12px] text-[#767980] [&>svg]:size-[13px]", hours <= 6 && "font-semibold text-[#B4231B]")}>
            <Clock strokeWidth={1.5} aria-hidden="true" />
            {hours ? `${hours} h` : "Expiring"}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[14px]">
        {group ? (
          <BrandPill tone="teal">
            <Users strokeWidth={1.5} aria-hidden="true" />
            Group
          </BrandPill>
        ) : (
          <BrandPill tone="sunk">
            <User strokeWidth={1.5} aria-hidden="true" />
            1-on-1
          </BrandPill>
        )}
        <b className="text-[14px] font-semibold text-[#1A202C]">{request.sessionName}</b>
        <span className="text-[#484D56]">
          {formatDateInZone(start, timeZone, { weekday: "short", month: "short", day: "numeric" })} · {formatClock(start, timeZone)}
        </span>
        {group ? <span className="text-[12px] text-[#767980]">{request.taken} of {request.capacity} spots taken</span> : null}
      </div>

      {request.notes ? <p className="text-[13px] italic leading-[16px] text-[#767980]">“{request.notes}”</p> : null}

      <div className="flex gap-2">
        <button type="button" className={cn(secondaryButton, smallButton)} disabled={busy} onClick={onDecline}>
          Decline
        </button>
        {group ? (
          request.athleteId ? (
            <button type="button" className={cn(secondaryButton, smallButton)} onClick={onMessage}>
              Message
            </button>
          ) : null
        ) : (
          <button type="button" className={cn(secondaryButton, smallButton)} disabled={busy} onClick={onSuggest}>
            Other time
          </button>
        )}
        <button type="button" className={cn(primaryButton, smallButton, "min-w-0 flex-1")} disabled={busy || full} onClick={onAccept}>
          {full ? "Group is full" : `Accept · ${money(request.price)}`}
        </button>
      </div>
    </div>
  );
};

export const RequestsPage = ({
  requests,
  loading,
  timeZone,
  now,
  respondingId,
  onAccept,
  onBack,
  onChanged,
}: {
  requests: BookingRequest[];
  loading: boolean;
  timeZone: string;
  now: Date;
  respondingId: string | null;
  onAccept: (bookingId: string) => void;
  onBack: () => void;
  onChanged: () => void;
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [declining, setDeclining] = useState<BookingRequest | null>(null);
  const [suggesting, setSuggesting] = useState<BookingRequest | null>(null);
  const waiting = useQuery({ queryKey: ["waiting-suggestions"], queryFn: () => bookingRequestsAPI.waiting() });

  const message = useMutation({
    mutationFn: (athleteId: string) => bookingRequestsAPI.openConversation(athleteId),
    onSuccess: (conversationId) => navigate(`${ROUTES.CHAT}?conversationId=${conversationId}`),
    onError: (err: unknown) => toast({ title: "Couldn't open the chat", description: errorText(err, ""), variant: "destructive" }),
  });

  const changed = () => {
    queryClient.invalidateQueries({ queryKey: ["waiting-suggestions"] });
    onChanged();
  };

  const declineSub = (r: BookingRequest) => {
    const start = new Date(r.start);
    const who = r.parentName ? `${r.parentName} for ${r.athleteName}` : r.athleteName;
    return `${who}, ${formatDayISO(getZonedISODate(start, timeZone), { weekday: "short", month: "short", day: "numeric" })} at ${formatClock(start, timeZone)}`;
  };

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
      <button
        type="button"
        className="-mb-2 inline-flex items-center gap-1 self-start text-[14px] font-medium text-[#767980] hover:text-[#1A202C] [&>svg]:size-4"
        onClick={onBack}
      >
        <ChevronLeft strokeWidth={1.5} aria-hidden="true" />
        My Schedule
      </button>
      <header className="flex flex-col gap-[10px]">
        <h1 className={pageTitle}>Booking requests</h1>
        <p className="text-[14px] leading-[18px] text-[#767980]">
          New families ask first. Accept within 24 hours or the time opens again.
        </p>
      </header>

      {loading ? (
        <p className="text-[14px] text-[#767980]">Loading…</p>
      ) : requests.length ? (
        <div className="flex flex-col gap-2.5">
          {requests.map((request) => (
            <RequestCard
              key={request.bookingId}
              request={request}
              timeZone={timeZone}
              now={now}
              busy={respondingId !== null}
              onDecline={() => setDeclining(request)}
              onSuggest={() => setSuggesting(request)}
              onMessage={() => request.athleteId && message.mutate(request.athleteId)}
              onAccept={() => onAccept(request.bookingId)}
            />
          ))}
        </div>
      ) : (
        <section className={card}>
          <div className="flex flex-col items-center gap-2.5 px-4 py-7 text-center text-[#767980]">
            <Inbox className="size-7 text-[#A3A6AB]" strokeWidth={1.5} aria-hidden="true" />
            <span className="text-[16px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]">You are all caught up</span>
            <p className="max-w-[44ch] text-[14px]">New booking requests show up here.</p>
          </div>
        </section>
      )}

      {waiting.data?.length ? (
        <section className="flex flex-col gap-2 pt-2">
          <h2 className="text-[16px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]">Waiting for the family</h2>
          <ul className="flex flex-col divide-y divide-[#EAEADF]">
            {waiting.data.map((item) => (
              <li key={item.occurrenceId} className="flex flex-col gap-0.5 py-2">
                <b className="text-[14px] font-medium">{item.athleteName}</b>
                <span className="text-[12px] leading-[14px] text-[#767980]">
                  You suggested {formatDateInZone(new Date(item.start), timeZone, { weekday: "short", month: "short", day: "numeric" })},{" "}
                  {formatInstantSpan(new Date(item.start), new Date(item.end), timeZone)} · {money(item.price)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <DeclineDialog
        open={Boolean(declining)}
        bookingId={declining?.bookingId ?? null}
        sub={declining ? declineSub(declining) : ""}
        onClose={() => setDeclining(null)}
        onDeclined={() => {
          setDeclining(null);
          toast({ title: "Request declined", description: "The slot is open again." });
          changed();
        }}
        onError={(err) => toast({ title: "Couldn't decline the request", description: errorText(err, "Please try again."), variant: "destructive" })}
      />
      <SuggestTimesDialog
        request={suggesting}
        timeZone={timeZone}
        now={now}
        onClose={() => setSuggesting(null)}
        onSent={(count) => {
          const who = suggesting ? (suggesting.parentName || suggesting.athleteName).split(" ")[0] : "the family";
          setSuggesting(null);
          toast({ title: `Sent ${plural(count, "option")} to ${who}` });
          changed();
        }}
      />
    </div>
  );
};
