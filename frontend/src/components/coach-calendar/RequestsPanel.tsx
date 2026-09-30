/**
 * Pending booking requests beside the coach calendar (ATH-28). Requests never expire;
 * ones waiting over 24h are flagged so the coach answers them.
 */
import { AlertCircle, Inbox } from "lucide-react";
import { BrandPill } from "@/components/brand";
import { Button } from "@/components/ui/button";
import type { BookingRequest } from "@/api/bookingRequests";
import { formatDateInZone, formatInstantSpan } from "@/utils/viewerTime";
import { BOOKING_GRACE_AFTER_START_MS } from "@/utils/dateHelpers";
import { countOverdueRequests, formatWaiting, hoursWaiting, isRequestOverdue } from "@/utils/requestWaiting";

interface RequestsPanelProps {
  requests: BookingRequest[];
  isLoading: boolean;
  timeZone: string;
  now: Date;
  respondingId: string | null;
  onRespond: (bookingId: string, accept: boolean) => void;
}

export const RequestsPanel = ({ requests, isLoading, timeZone, now, respondingId, onRespond }: RequestsPanelProps) => {
  const overdueCount = countOverdueRequests(requests, now);
  return (
    <section className="flex flex-col gap-4 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] p-5">
      <div className="flex items-center gap-2">
        <Inbox className="size-5 flex-none text-[#0054B4]" strokeWidth={1.5} aria-hidden="true" />
        <h2 className="text-[20px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]">Booking requests</h2>
        <span className="text-[16px] font-medium leading-[18px] tracking-[-0.03em] text-[#767980]">{requests.length}</span>
      </div>
      {overdueCount > 0 ? (
        <div role="status" className="flex items-start gap-2 rounded-[8px] bg-[#FDF7EC] px-3 py-[10px]">
          <AlertCircle className="mt-[1px] size-4 flex-none text-[#906A29]" strokeWidth={1.5} aria-hidden="true" />
          <p className="text-[12px] leading-[16px] tracking-[-0.03em] text-[#906A29]">
            {overdueCount === 1 ? "1 request has" : `${overdueCount} requests have`} waited over 24 hours. The athlete is
            holding the slot until you answer.
          </p>
        </div>
      ) : null}
      {isLoading ? (
        <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">Loading requests…</p>
      ) : requests.length === 0 ? (
        <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">No requests waiting</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((request) => {
            const start = new Date(request.start);
            const started = now.getTime() > start.getTime() + BOOKING_GRACE_AFTER_START_MS;
            return (
              <li key={request.bookingId} className="flex flex-col gap-3 rounded-[8px] border border-[#EAEADF] bg-[#F9F9F5] p-3">
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]">{request.athleteName}</p>
                    {isRequestOverdue(request.requestedAt, now) ? (
                      <BrandPill tone="amber">Over 24h</BrandPill>
                    ) : (
                      <span className="text-[12px] leading-[14px] text-[#A3A6AB]">{formatWaiting(hoursWaiting(request.requestedAt, now))}</span>
                    )}
                  </div>
                  <p className="text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">{request.sessionName}</p>
                  <p className="text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">
                    {formatDateInZone(start, timeZone, { weekday: "short", month: "short", day: "numeric" })},{" "}
                    {formatInstantSpan(start, new Date(request.end), timeZone)}
                  </p>
                  {request.notes ? (
                    <p className="text-[12px] italic leading-[14px] tracking-[-0.03em] text-[#484D56]">“{request.notes}”</p>
                  ) : null}
                  {started ? (
                    <p className="text-[12px] leading-[14px] text-[#767980]">Session started, so it can only be declined.</p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={respondingId !== null}
                    onClick={() => onRespond(request.bookingId, false)}
                  >
                    Decline
                  </Button>
                  <Button size="sm" disabled={respondingId !== null || started} onClick={() => onRespond(request.bookingId, true)}>
                    Accept
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
