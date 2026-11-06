/**
 * Book from My Athletes (Working Copy coach4.js quick flow): up to 3 suggested times (the usual
 * time when it's open, then the next open slots), one payment line with Change, one Book button.
 * "Pick another time or several" opens a week picker with groups to join, then a short review.
 * Credit and paid-outside bookings can be undone from the toast; a payment link goes out as an
 * offer the family books and pays from.
 */
import { errorMessage } from "@/utils/errorMessage";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, ChevronLeft, Plus, Ticket, User, Users, X } from "@/components/icons";
import { rosterAPI } from "@/api/roster";
import { scheduleAPI } from "@/api/schedule";
import { BrandPill } from "@/components/brand";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToastAction } from "@/components/ui/toast";
import { dialogContent, label, meta, primaryButton, textButton } from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { money } from "@/utils/booking";
import { formatClock, formatDayISO, plural, sessionLink } from "@/utils/schedule";
import { useAuth } from "@/contexts/AuthContext";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { PickTimes } from "./book/PickTimes";
import {
  byStart, clock, fromOpenTime, lengthMinutes, paymentChoices, paymentLabel, placeLabel, startsAt, suggestTimes,
  viewerDay, whenLabel, type BookTime, type PayContext, type Payment,
} from "./book/bookHelpers";

type Step = "quick" | "pick" | "review";
const MAX_TIMES = 10;

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");

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
  const [step, setStep] = useState<Step>("quick");
  const [selected, setSelected] = useState(0);
  const [picked, setPicked] = useState<BookTime[]>([]);
  const [payment, setPayment] = useState<Payment | null>(null);
  useEffect(() => {
    setStep("quick");
    setSelected(0);
    setPicked([]);
    setPayment(null);
  }, [athleteId]);

  const times = useQuery({
    queryKey: ["roster-open-times", athleteId, "suggest"],
    enabled: Boolean(athleteId),
    queryFn: () => rosterAPI.openTimes(athleteId!, 40),
  });
  const options = useQuery({
    queryKey: ["roster-book-payment", athleteId],
    enabled: Boolean(athleteId),
    queryFn: () => rosterAPI.bookPayment(athleteId!),
  });
  // Same query as the athlete page, so it's usually cached: photo, next session, parent.
  const detail = useQuery({
    queryKey: ["coach-athlete", athleteId],
    enabled: Boolean(athleteId),
    queryFn: () => rosterAPI.athlete(athleteId!),
  });

  const first = name.split(" ")[0] || name;
  const athlete = detail.data?.athlete;
  const minor = athlete?.age != null && athlete.age < 18;
  const payer = (minor && athlete?.accountName && athlete.accountName !== athlete.name ? athlete.accountName : name).split(" ")[0] || first;
  const ctx: PayContext = {
    credits: options.data?.credits ?? 0,
    ownClient: Boolean(options.data?.ownClient),
    paysDirect: Boolean(options.data?.paysDirect),
    payer,
  };

  const suggestions = useMemo(() => suggestTimes(times.data ?? [], timeZone), [times.data, timeZone]);
  const current = suggestions[selected] ?? suggestions[0] ?? null;
  const lines = step === "quick" ? (current ? [fromOpenTime(current.slot)] : []) : [...picked].sort(byStart);
  const total = lines.reduce((n, t) => n + t.price, 0);
  const choices = paymentChoices(ctx, lines.length);
  const pay: Payment = payment && choices.includes(payment) ? payment : choices[0];
  const cyclePayment = () => setPayment(choices[(choices.indexOf(pay) + 1) % choices.length]);

  const toggle = (t: BookTime) =>
    setPicked((prev) => {
      if (prev.some((p) => p.id === t.id)) {
        const next = prev.filter((p) => p.id !== t.id);
        if (!next.length && step === "review") setStep("pick");
        return next;
      }
      if (prev.length >= MAX_TIMES) {
        toast({ title: `Pick up to ${MAX_TIMES} times at once` });
        return prev;
      }
      return [...prev, t];
    });

  const invalidate = () => {
    for (const key of ["coach-roster", "coach-athlete", "roster-open-times", "roster-book-week", "roster-book-payment", "sessions"]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };

  const send = useMutation({
    mutationFn: async ({ items, method }: { items: BookTime[]; method: Payment }) => {
      if (!items.length || !athleteId) throw new Error("Pick a time");
      const ids = items.map((t) => t.id);
      if (method === "credit" || method === "outside") return { ids: await rosterAPI.book(athleteId, ids, method), items, method };
      const label = items.length === 1 ? whenLabel(items[0], timeZone, " at ") : plural(items.length, "time");
      const link = sessionLink(null, userProfile?.coach_id ?? "", items[0].id);
      const sum = money(items.reduce((n, t) => n + t.price, 0));
      await scheduleAPI.offerSession(
        ids,
        [athleteId],
        false,
        ctx.paysDirect
          ? `${first}, I have ${label} for you (${sum}, you pay me directly). Book it here: ${link}`
          : `${first}, I have ${label} for you (${sum}). Book and pay here: ${link}`,
      );
      return { ids: [] as string[], items, method };
    },
    onSuccess: ({ ids, items, method }) => {
      invalidate();
      const what = items.length === 1 ? whenLabel(items[0], timeZone, " at ") : plural(items.length, "session");
      if (ids.length) {
        const undo = () =>
          rosterAPI
            .undoBooking(ids)
            .then(() => {
              invalidate();
              toast({ title: "Booking undone" });
            })
            .catch((e: Error) => toast({ title: "Couldn't undo", description: e.message, variant: "destructive" }));
        toast({
          title: items.length === 1 ? `Booked ${first} for ${what}` : `${what} booked for ${first}`,
          description: method === "credit" ? `Paid with ${plural(items.length, "credit")}` : "Paid outside AthaNext",
          action: <ToastAction altText="Undo the booking" onClick={undo}>Undo</ToastAction>,
        });
      } else {
        toast({
          title: `Sent ${what} to ${payer}`,
          description: ctx.paysDirect ? "They book from the link and pay you directly." : `${payer} got the payment link.`,
        });
      }
      onClose();
    },
    onError: (err: unknown) => toast({ title: errorMessage(err, "Couldn't book that time"), variant: "destructive" }),
  });

  const loading = options.isLoading || send.isPending;
  const verb = pay === "link" ? "Send" : "Book";
  const payLine = (
    <div className="flex items-center gap-2 rounded-control border border-light-525 bg-light-400 px-3 py-2.5 text-body-m text-dark-400">
      <Ticket className="size-4 flex-none" strokeWidth={1.5} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        {options.isLoading
          ? "Checking payment…"
          : [
              lines.length > 1 ? plural(lines.length, "session") : lines[0]?.kind === "group" ? lines[0].title ?? "Group session" : "Individual session",
              lines.length === 1 ? placeLabel(lines[0].place) : null,
              paymentLabel(pay, ctx, Math.max(1, lines.length), total),
            ].filter(Boolean).join(" · ")}
      </span>
      {choices.length > 1 ? (
        <button type="button" className={textButton} onClick={cyclePayment}>Change</button>
      ) : null}
    </div>
  );

  const header = {
    quick: { kicker: null, title: `Book ${first}` },
    pick: { kicker: "Book an athlete · 2 of 3", title: `Pick times for ${first}` },
    review: { kicker: "Book an athlete · 3 of 3", title: "Review and book" },
  }[step];

  return (
    <Dialog open={Boolean(athleteId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn(dialogContent, step === "pick" && "max-w-[640px]")}>
        <DialogHeader className="flex flex-col gap-1.5 space-y-0 px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
          {step !== "quick" ? (
            <button type="button" className={cn(textButton, "self-start text-dark-300")} onClick={() => setStep(step === "review" ? "pick" : "quick")}>
              <ChevronLeft strokeWidth={1.5} aria-hidden="true" />
              Back
            </button>
          ) : null}
          {header.kicker ? (
            <span className="text-label-xsm text-primary">{header.kicker}</span>
          ) : null}
          <DialogTitle className="text-section">{header.title}</DialogTitle>
          <DialogDescription className="sr-only">Pick a time and how it's paid.</DialogDescription>
        </DialogHeader>

        {step === "pick" && athleteId ? (
          <PickTimes
            athleteId={athleteId}
            timeZone={timeZone}
            picked={picked}
            summary={`${plural(picked.length, "session")} · ${pay === "credit" ? plural(picked.length, "credit") : money(total)}`}
            onToggle={toggle}
            onContinue={() => setStep("review")}
          />
        ) : (
          <div className="flex flex-col gap-3 px-5 pb-5 sm:px-[25px]">
            {step === "quick" ? (
              <>
                <div className="flex items-center gap-3 rounded-card border border-light-525 bg-light px-3 py-2.5">
                  {athlete?.imageUrl ? (
                    <img src={athlete.imageUrl} alt="" className="size-9 flex-none rounded-full object-cover" />
                  ) : (
                    <span className="flex size-9 flex-none items-center justify-center rounded-full bg-primary-50 text-label-sm text-primary">{initialsOf(name)}</span>
                  )}
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <b className="truncate text-label-sm">{athlete?.name ?? name}</b>
                    <span className={meta}>
                      {ctx.credits ? `${plural(ctx.credits, "credit")} left` : "No package"}
                      {athlete?.next ? ` · next session ${formatDayISO(viewerDay(athlete.next, timeZone), { weekday: "short", month: "short", day: "numeric" })}` : ""}
                    </span>
                  </span>
                </div>

                <span className={label}>Suggested times</span>
                {times.isLoading ? <p className={meta}>Finding open times…</p> : null}
                {times.data && !suggestions.length ? (
                  <p className="text-body-m text-dark-300">No open times in the booking window. Pick another time below.</p>
                ) : null}
                {suggestions.length ? (
                  <div className="flex flex-col gap-2" role="radiogroup" aria-label="Suggested times">
                    {suggestions.map((s, i) => {
                      const on = current?.slot.id === s.slot.id;
                      return (
                        <button
                          key={s.slot.id}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => setSelected(i)}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-control border px-3.5 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                            on ? "border-primary bg-primary-50" : "border-light-525 bg-light-300 hover:border-primary-300",
                          )}
                        >
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <b className="text-label-sm">{whenLabel(s.slot, timeZone)}</b>
                            <span className={meta}>{s.why} · {lengthMinutes(s.slot)} min</span>
                          </span>
                          <span className={cn("size-5 flex-none rounded-full", on ? "border-[6px] border-primary bg-light-50" : "border-[1.5px] border-dark-250")} />
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                <button
                  type="button"
                  className={cn(textButton, "self-start")}
                  onClick={() => {
                    setPicked([]);
                    setStep("pick");
                  }}
                >
                  <Calendar strokeWidth={1.5} aria-hidden="true" />
                  Pick another time or several
                </button>
                {payLine}
                <button
                  type="button"
                  className={cn(primaryButton, "mt-1 h-[48px] w-full")}
                  disabled={!current || loading}
                  onClick={() => current && send.mutate({ items: [fromOpenTime(current.slot)], method: pay })}
                >
                  {send.isPending ? "Booking…" : current ? `${verb} ${whenLabel(current.slot, timeZone, " at ")}` : "Pick a time"}
                </button>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-2.5">
                  {lines.map((t, i) => {
                    const d = viewerDay(t, timeZone);
                    const end = new Date(startsAt(t).getTime() + lengthMinutes(t) * 60_000);
                    const credit = pay === "credit" && i < ctx.credits;
                    return (
                      <div key={t.id} className="flex items-center gap-3 rounded-card border border-light-525 p-3">
                        <span className="flex h-12 w-11 flex-none flex-col items-center justify-center rounded-card bg-primary text-light">
                          <small className="text-caption text-primary-100">{formatDayISO(d, { weekday: "short" })}</small>
                          <b className="text-subtitle">{formatDayISO(d, { day: "numeric" })}</b>
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-label-sm">{t.kind === "group" ? t.title ?? "Group session" : "Individual session"}</span>
                            {t.kind === "group" ? (
                              <BrandPill tone="teal"><Users aria-hidden="true" />Group</BrandPill>
                            ) : (
                              <BrandPill tone="neutral"><User aria-hidden="true" />1-on-1</BrandPill>
                            )}
                          </span>
                          <span className={meta}>
                            {formatDayISO(d, { month: "short", day: "numeric" })}, {clock(t, timeZone)} – {formatClock(end, timeZone)} · {placeLabel(t.place)}
                          </span>
                        </div>
                        <span className="text-label-sm tabular-nums">{credit ? <BrandPill tone="green">Credit</BrandPill> : money(t.price)}</span>
                        <button
                          type="button"
                          className="inline-flex size-[30px] flex-none items-center justify-center rounded-control text-dark-300 hover:bg-light-400 hover:text-dark"
                          aria-label="Remove"
                          onClick={() => toggle(t)}
                        >
                          <X className="size-4" strokeWidth={1.5} aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="flex h-11 w-full items-center justify-center gap-1.5 rounded-control border border-dashed border-light-600 text-label-sm text-primary"
                  onClick={() => setStep("pick")}
                >
                  <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
                  Add another time
                </button>
                {payLine}
                <button
                  type="button"
                  className={cn(primaryButton, "mt-1 h-[48px] w-full")}
                  disabled={!lines.length || loading}
                  onClick={() => send.mutate({ items: lines, method: pay })}
                >
                  {send.isPending
                    ? "Booking…"
                    : lines.length === 1
                      ? `${verb} ${whenLabel(lines[0], timeZone, " at ")}`
                      : `${verb} ${plural(lines.length, "session")} for ${first}`}
                </button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
