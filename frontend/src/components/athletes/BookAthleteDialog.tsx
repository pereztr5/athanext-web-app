/**
 * Book from My Athletes (ATH-74, ATH-77): the athlete's usual time, if one is open, and the next
 * open 1-on-1s. Payment is picked automatically and shown as one line with Change: a credit
 * when the family has one, otherwise a link to book and pay, or paid outside AthaNext for the
 * coach's own clients. Booking with a credit or paid outside can be undone from the toast.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rosterAPI } from "@/api/roster";
import { scheduleAPI } from "@/api/schedule";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToastAction } from "@/components/ui/toast";
import { dialogContent, meta, primaryButton, secondaryButton, textButton } from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { money } from "@/utils/booking";
import { getZonedISODate, zonedWallTimeToUtc } from "@/utils/dateHelpers";
import { formatClock, formatDayISO, plural, sessionLink } from "@/utils/schedule";
import { useAuth } from "@/contexts/AuthContext";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";

type Payment = "credit" | "link" | "outside";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [several, setSeveral] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [changing, setChanging] = useState(false);
  useEffect(() => {
    setSeveral(false);
    setChosen([]);
    setPayment(null);
    setChanging(false);
  }, [athleteId]);

  const times = useQuery({
    queryKey: ["roster-open-times", athleteId, several],
    enabled: Boolean(athleteId),
    queryFn: () => rosterAPI.openTimes(athleteId!, several ? 30 : 8),
  });
  const options = useQuery({
    queryKey: ["roster-book-payment", athleteId],
    enabled: Boolean(athleteId),
    queryFn: () => rosterAPI.bookPayment(athleteId!),
  });
  const first = name.split(" ")[0] || name;
  const opts = options.data;
  const fallback = times.data?.find((t) => t.suggested) ?? times.data?.[0] ?? null;
  const picked = chosen.length ? (times.data ?? []).filter((t) => chosen.includes(t.id)) : fallback ? [fallback] : [];
  const credits = opts?.credits ?? 0;
  const auto: Payment = credits >= Math.max(1, picked.length) ? "credit" : "link";
  const pay: Payment = opts?.paysDirect ? "link" : payment ?? auto;
  const total = picked.reduce((n, t) => n + t.price, 0);

  const choices: { value: Payment; label: string; hint: string; ok: boolean }[] = [
    { value: "credit", label: "Use a credit", hint: credits ? `${plural(credits, "credit")} left` : "No credits left", ok: credits >= Math.max(1, picked.length) },
    { value: "link", label: "Send a link to pay", hint: `${first} books and pays by card`, ok: true },
    {
      value: "outside",
      label: "Paid outside AthaNext",
      hint: opts?.ownClient ? "Cash or transfer" : "Only for families you brought to AthaNext",
      ok: Boolean(opts?.ownClient),
    },
  ];
  const payLine = opts?.paysDirect
    ? `${first} books from a link and pays you directly`
    : pay === "credit"
      ? `Paid with ${plural(picked.length || 1, "credit")} (${plural(credits, "credit")} left)`
      : pay === "outside"
        ? "Paid outside AthaNext (cash or transfer)"
        : `${first} gets a link to book and pay ${money(total)}`;

  const toggle = (id: string) => {
    if (!several) {
      setChosen([id]);
      return;
    }
    const base = chosen.length ? chosen : fallback ? [fallback.id] : [];
    setChosen(base.includes(id) ? base.filter((x) => x !== id) : [...base, id]);
  };

  const send = useMutation({
    mutationFn: async () => {
      if (!picked.length || !athleteId) throw new Error("Pick a time");
      if (pay === "credit" || pay === "outside") {
        return { ids: await rosterAPI.book(athleteId, picked.map((t) => t.id), pay) };
      }
      const label = picked.length === 1 ? when(picked[0].date, picked[0].startTime, timeZone) : plural(picked.length, "time");
      const link = sessionLink(null, userProfile?.coach_id ?? "", picked[0].id);
      await scheduleAPI.offerSession(
        picked.map((t) => t.id),
        [athleteId],
        false,
        opts?.paysDirect
          ? `${first}, I have ${label} open (${money(total)}, you pay me directly). Book it here: ${link}`
          : `${first}, I have ${label} open (${money(total)}). Book it here: ${link}`,
      );
      return { ids: [] as string[] };
    },
    onSuccess: ({ ids }) => {
      queryClient.invalidateQueries({ queryKey: ["coach-roster"] });
      queryClient.invalidateQueries({ queryKey: ["roster-open-times"] });
      queryClient.invalidateQueries({ queryKey: ["roster-book-payment"] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      if (ids.length) {
        const undo = () =>
          rosterAPI
            .undoBooking(ids)
            .then(() => {
              queryClient.invalidateQueries({ queryKey: ["coach-roster"] });
              queryClient.invalidateQueries({ queryKey: ["sessions"] });
              toast({ title: "Booking undone" });
            })
            .catch((e: Error) => toast({ title: "Couldn't undo", description: e.message, variant: "destructive" }));
        toast({
          title: `${first} is booked`,
          description: `${picked.length === 1 ? when(picked[0].date, picked[0].startTime, timeZone) : plural(picked.length, "session")} · ${pay === "credit" ? "paid with a credit" : "paid outside AthaNext"}`,
          action: <ToastAction altText="Undo the booking" onClick={undo}>Undo</ToastAction>,
        });
      } else {
        toast({ title: `Sent to ${first}`, description: opts?.paysDirect ? "They book from the link and pay you directly." : "They get a message with a link to book and pay." });
      }
      onClose();
    },
    onError: (err: unknown) => toast({ title: err instanceof Error ? err.message : "Couldn't book that time", variant: "destructive" }),
  });

  return (
    <Dialog open={Boolean(athleteId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={dialogContent}>
        <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
          <DialogTitle className="text-[22px] font-semibold leading-[28px] tracking-[-0.05em]">Book {first}</DialogTitle>
          <DialogDescription className={meta}>
            {several ? "Pick one or several times." : "Their usual time is marked when it's open."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 px-5 pb-5 sm:px-[25px]">
          {times.isLoading ? <p className={meta}>Finding open times…</p> : null}
          {times.data && !times.data.length ? <p className={meta}>No open 1-on-1 times in the booking window. Add one from My Schedule.</p> : null}
          <div className="flex max-h-[320px] flex-col gap-2 overflow-y-auto">
            {(times.data ?? []).map((slot) => {
              const on = picked.some((t) => t.id === slot.id);
              return (
                <button
                  key={slot.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(slot.id)}
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
          {!several && times.data?.length ? (
            <button type="button" className={cn(textButton, "self-start")} onClick={() => setSeveral(true)}>
              Pick another time or several
            </button>
          ) : null}

          <div className="flex flex-col gap-2 rounded-[8px] bg-[#F1F1E6] px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[14px] leading-[18px] text-[#484D56]">{options.isLoading ? "Checking payment…" : payLine}</span>
              {!opts?.paysDirect && opts ? (
                <button type="button" className={textButton} onClick={() => setChanging((c) => !c)}>
                  {changing ? "Done" : "Change"}
                </button>
              ) : null}
            </div>
            {changing ? (
              <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="How it's paid">
                {choices.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={pay === c.value}
                    disabled={!c.ok}
                    onClick={() => {
                      setPayment(c.value);
                      setChanging(false);
                    }}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-[8px] border px-3 py-2 text-left disabled:opacity-50",
                      pay === c.value ? "border-[#6698D2] bg-[#E5EDF7]" : "border-[#EAEADF] bg-[#F9F9F5]",
                    )}
                  >
                    <b className="text-[14px] font-medium">{c.label}</b>
                    <span className={meta}>{c.hint}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryButton} onClick={onClose}>Cancel</button>
            <button type="button" className={primaryButton} disabled={!picked.length || send.isPending || options.isLoading} onClick={() => send.mutate()}>
              {send.isPending
                ? "Booking…"
                : pay === "link"
                  ? picked.length > 1 ? `Send ${plural(picked.length, "time")}` : "Send time"
                  : picked.length > 1 ? `Book ${plural(picked.length, "session")}` : "Book"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
