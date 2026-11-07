/**
 * Tapping a group in My schedule (Working Copy group sheet): who's booked and how they paid,
 * money collected, requests to join, then Message group, Add athlete and Session details.
 */
import { errorMessage } from "@/utils/errorMessage";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, MessageCircle, Pencil, Plus } from "@/components/icons";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { chatAPI } from "@/api/chat";
import type { ScheduleSession } from "@/api/schedule";
import { AddToGroupDialog } from "@/components/coach-session/AddToGroupDialog";
import { Avatar, ModalBody, ModalHeader } from "@/components/coach-session/parts";
import { spDialog } from "@/components/coach-session/styles";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { getZonedISODate } from "@/utils/dateHelpers";
import { bookedAthletes, formatClock, formatDayISO, plural, requestsFor, sessionEnd, sessionStart } from "@/utils/schedule";
import { formatInstantSpan } from "@/utils/viewerTime";
import { label, meta, primaryButton, secondaryButton, smallButton, textButton } from "../styles";
import { FillBar, GroupPayPill } from "./parts";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

const expiresIn = (expiresAt: string | null) => {
  if (!expiresAt) return null;
  const hours = Math.round((Date.parse(expiresAt) - Date.now()) / 3_600_000);
  return hours > 0 ? `${hours} h left to answer` : "Expiring";
};

export const GroupSheet = ({
  session,
  timeZone,
  onClose,
  onRespond,
  respondingId,
}: {
  session: ScheduleSession;
  timeZone: string;
  onClose: () => void;
  onRespond: (bookingId: string, accept: boolean) => void;
  respondingId: string | null;
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);

  const start = sessionStart(session);
  const end = sessionEnd(session);
  const day = formatDayISO(getZonedISODate(start, timeZone), { weekday: "short", month: "short", day: "numeric" });
  const where = session.location === "online" ? "Video call" : session.place || "In person";
  const booked = bookedAthletes(session);
  const requests = requestsFor(session);
  const collected = booked.filter((b) => b.paymentStatus === "paid").length * session.price;

  // The coach's group channel; plain Messages if there isn't one.
  const message = useMutation({
    mutationFn: () => chatAPI.openMyCoachChannel(),
    onSuccess: (conversationId) => navigate(conversationId ? `${ROUTES.CHAT}?conversationId=${conversationId}` : ROUTES.CHAT),
    onError: () => navigate(ROUTES.CHAT),
  });

  return (
    <>
      <Dialog open={!adding} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className={spDialog}>
          <ModalHeader title={session.sessionName || "Group session"} sub={`${day} · ${formatInstantSpan(start, end, timeZone)} · ${where}`} />
          <ModalBody>
            {session.isDraft ? (
              <div className="flex items-start gap-2.5 rounded-control border border-info-300 bg-info-50 px-3.5 py-3 text-paragraph-sm text-info-700">
                <Pencil className="size-4 flex-none" strokeWidth={1.5} aria-hidden="true" />
                <span>
                  Draft. Families can't see this yet.{" "}
                  <Link to={ROUTES.SCHEDULE_PLAN} className="font-medium underline">
                    Publish it from New schedule
                  </Link>
                  .
                </span>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <b className="text-subtitle text-secondary-700">
                  {booked.length} of {session.capacity} booked
                </b>
                <span className={meta}>{money(collected)} collected</span>
              </div>
              <FillBar booked={booked.length} capacity={session.capacity} />
            </div>

            {booked.length ? (
              <div className="flex flex-col">
                {booked.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-3 border-b border-light-525 py-2">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={b.athleteName} size={32} />
                      <span className="truncate text-label-sm">{b.athleteName}</span>
                    </span>
                    <GroupPayPill booking={b} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-body-m text-dark-300">Nobody has joined yet.</p>
            )}

            {requests.length ? (
              <div className="flex flex-col">
                <span className={label}>Asking to join</span>
                {requests.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 border-b border-light-525 py-2">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={r.athleteName} size={32} />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-label-sm">{r.athleteName}</span>
                        <span className={meta}>{[expiresIn(r.expiresAt), money(session.price)].filter(Boolean).join(" · ")}</span>
                      </span>
                    </span>
                    <button
                      type="button"
                      className={cn(primaryButton, smallButton)}
                      disabled={respondingId !== null || booked.length >= session.capacity}
                      onClick={() => onRespond(r.id, true)}
                    >
                      Accept
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </ModalBody>
          <div className="flex flex-col items-end gap-3 border-t border-light-525 px-4 py-4 sm:px-[25px]">
            <div className="grid w-full grid-cols-2 gap-2">
              <button type="button" className={cn(secondaryButton, "min-w-0 px-2")} disabled={message.isPending} onClick={() => message.mutate()}>
                <MessageCircle strokeWidth={1.5} aria-hidden="true" />
                Message group
              </button>
              <button
                type="button"
                className={cn(primaryButton, "min-w-0 px-2")}
                disabled={booked.length >= session.capacity}
                onClick={() => setAdding(true)}
              >
                <Plus strokeWidth={1.5} aria-hidden="true" />
                Add athlete
              </button>
            </div>
            <Link to={`/sessions/${session.id}`} className={textButton}>
              Session details
              <ChevronRight strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </div>
        </DialogContent>
      </Dialog>
      {adding ? (
        <AddToGroupDialog
          open
          occurrenceId={session.id}
          title={session.sessionName}
          sub={`${day} at ${formatClock(start, timeZone)} · ${plural(Math.max(0, session.capacity - booked.length), "spot")} left`}
          price={session.price}
          bookedIds={booked.map((b) => b.athleteId)}
          onClose={() => setAdding(false)}
          onAdded={(text) => {
            toast({ title: text });
            queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
            onClose();
          }}
          onError={(error) =>
            toast({ title: "That didn't save", description: errorMessage(error, "Try again."), variant: "destructive" })
          }
        />
      ) : null}
    </>
  );
};
