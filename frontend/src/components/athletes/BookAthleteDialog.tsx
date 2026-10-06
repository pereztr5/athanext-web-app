/**
 * Book from My Athletes (ATH-74): the athlete's usual time, if one is open, and the next
 * open 1-on-1s. Sending the time lets them book and pay from My Sessions. Charging a card,
 * using a credit, or marking it paid outside waits on the payments model.
 */
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { rosterAPI } from "@/api/roster";
import { scheduleAPI } from "@/api/schedule";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dialogContent, meta, primaryButton, secondaryButton } from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { money } from "@/utils/booking";
import { getZonedISODate, zonedWallTimeToUtc } from "@/utils/dateHelpers";
import { formatClock, formatDayISO, sessionLink } from "@/utils/schedule";
import { useAuth } from "@/contexts/AuthContext";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { useCoachDetails } from "@/hooks/useCoachDetails";

const when = (date: string, start: string, timeZone: string) => {
  const at = zonedWallTimeToUtc(date, start) ?? new Date(NaN);
  return `${formatDayISO(getZonedISODate(at, timeZone), { weekday: "short", month: "short", day: "numeric" })} at ${formatClock(at, timeZone)}`;
};

export const BookAthleteDialog = ({
  athleteId,
  name,
  onClose,
}: {
  athleteId: string | null;
  name: string;
  onClose: () => void;
}) => {
  const timeZone = useViewerTimeZone();
  const { userProfile } = useAuth();
  const { coach: me } = useCoachDetails(userProfile?.coach_id ?? undefined);
  const paysDirect = (me as { pay_mode?: string } | undefined)?.pay_mode === "self";
  const { toast } = useToast();
  const [picked, setPicked] = useState<string | null>(null);
  const times = useQuery({
    queryKey: ["roster-open-times", athleteId],
    enabled: Boolean(athleteId),
    queryFn: () => rosterAPI.openTimes(athleteId!),
  });
  const first = name.split(" ")[0] || name;
  const selected = times.data?.find((t) => t.id === picked) ?? times.data?.find((t) => t.suggested) ?? times.data?.[0] ?? null;

  const send = useMutation({
    mutationFn: () => {
      if (!selected || !athleteId) throw new Error("Pick a time");
      const label = when(selected.date, selected.startTime, timeZone);
      const link = sessionLink(null, userProfile?.coach_id ?? "", selected.id);
      return scheduleAPI.offerSession(
        [selected.id],
        [athleteId],
        false,
        paysDirect
          ? `${first}, I have ${label} open (${money(selected.price)}, you pay me directly). Book it here: ${link}`
          : `${first}, I have ${label} open (${money(selected.price)}). Book it here: ${link}`,
      );
    },
    onSuccess: () => {
      toast({
        title: `Sent to ${first}`,
        description: "They get a message with a link to book and pay. Charging them from here waits on the payments model.",
      });
      onClose();
    },
    onError: (err: unknown) => {
      toast({ title: err instanceof Error ? err.message : "Couldn't send that time", variant: "destructive" });
    },
  });

  return (
    <Dialog open={Boolean(athleteId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={dialogContent}>
        <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
          <DialogTitle className="text-[22px] font-semibold leading-[28px] tracking-[-0.05em]">Book {first}</DialogTitle>
          <DialogDescription className={meta}>
            Their usual time is marked when it's open. They get a link to book and pay.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 px-5 pb-5 sm:px-[25px]">
          {times.isLoading ? <p className={meta}>Finding open times…</p> : null}
          {times.data && !times.data.length ? <p className={meta}>No open 1-on-1 times in the booking window. Add one from My Schedule.</p> : null}
          <div className="flex flex-col gap-2">
            {(times.data ?? []).map((slot) => {
              const on = selected?.id === slot.id;
              return (
                <button
                  key={slot.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked(slot.id)}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-[8px] border px-3 py-2.5 text-left",
                    on ? "border-[#6698D2] bg-[#E5EDF7]" : "border-[#EAEADF] bg-[#F9F9F5]",
                  )}
                >
                  <span className="flex flex-col">
                    <b className="text-[14px] font-medium">{when(slot.date, slot.startTime, timeZone)}</b>
                    <span className={meta}>{slot.suggested ? "Usual time · " : ""}{slot.place || "In person"}</span>
                  </span>
                  <b className="text-[14px]">{money(slot.price)}</b>
                </button>
              );
            })}
          </div>
          <p className="rounded-[8px] bg-[#F1F1E6] px-3 py-2.5 text-[14px] leading-[18px] text-[#484D56]">
            {paysDirect
              ? `${first} gets a message with a link to book. They pay you directly.`
              : `${first} gets a message with a link to book and pay. Using a credit, or marking it paid outside AthaNext, comes with the payments model.`}
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryButton} onClick={onClose}>Cancel</button>
            <button type="button" className={primaryButton} disabled={!selected || send.isPending} onClick={() => send.mutate()}>
              {send.isPending ? "Sending…" : "Send time"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
