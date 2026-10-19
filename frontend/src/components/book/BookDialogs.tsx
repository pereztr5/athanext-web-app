/**
 * Book a Session sheets (ATH-73, ATH-94): review the picked times across coaches, use credits,
 * pay (or send requests), and request a time that isn't listed. Working Copy `AN.modals.review`
 * and `AN.modals['req-time']`.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Info, Plus, UserCheck, X } from "@/components/icons";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BrandPill } from "@/components/brand";
import { bookAPI, type BookableSession, type BookingCoach } from "@/api/book";
import { Switch } from "@/components/ui/switch";
import { CheckoutTermsLine } from "@/components/legal/LegalLinks";
import { useAuth } from "@/contexts/AuthContext";
import { useBookingFees } from "@/hooks/useBookingFees";
import { ROUTES } from "@/routes";
import { planBooking } from "@/utils/bookPlan";
import { savePendingRequests } from "@/utils/pendingRequests";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { bookableEnd, bookableStart, money } from "@/utils/booking";
import { getZonedISODate } from "@/utils/dateHelpers";
import { addDaysISO, formatDayISO, formatMinutes, plural, viewerToEastern } from "@/utils/schedule";
import { formatInstantSpan } from "@/utils/viewerTime";
import { input, label, meta, primaryButton, secondaryButton, textButton } from "@/components/schedule/styles";
import { canApplePay } from "./applePay";
import { FeeLines } from "./FeeLines";
import {
  ApplePayButton,
  InfoBox,
  PayMethodList,
  sheetBody,
  sheetContent,
  sheetFooter,
  sheetHeader,
  sheetTitle,
  stat28,
  type PayMethod,
} from "./checkoutParts";

/** Request a time: every 30 minutes from 6:00 am to 8:30 pm. */
const REQUEST_START_MINUTES = Array.from({ length: 30 }, (_, i) => 6 * 60 + i * 30);
const CANCEL_HOURS = 24;

export const ReviewDialog = ({
  open,
  onOpenChange,
  coaches,
  picked,
  pillar,
  athleteId,
  timeZone,
  onRemove,
  onBooked,
  useCredits,
  onUseCreditsChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Coaches of the picked times, by id. */
  coaches: Record<string, BookingCoach>;
  picked: BookableSession[];
  pillar: string | null;
  athleteId: string | null;
  timeZone: string;
  onRemove: (session: BookableSession) => void;
  onBooked: () => void;
  /** Shared with the page's "Your booking" column. */
  useCredits: boolean;
  onUseCreditsChange: (value: boolean) => void;
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fees = useBookingFees(athleteId);
  const [applePay] = useState(canApplePay);
  const [method, setMethod] = useState<PayMethod>(applePay ? "apple" : "card");
  const [choosing, setChoosing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setError(null);
    setChoosing(false);
    setOffline(false);
    setMethod(applePay ? "apple" : "card");
  }, [open, applePay]);

  const planCoaches = useMemo(() => {
    if (!offline) return coaches;
    const next: Record<string, BookingCoach> = {};
    for (const [id, c] of Object.entries(coaches)) {
      next[id] = c.offlinePayAvailable ? { ...c, paysDirect: true } : c;
    }
    return next;
  }, [coaches, offline]);

  const plan = planBooking(picked, planCoaches, useCredits, fees);
  const firstName = (coachId: string) => coaches[coachId]?.name.split(" ")[0] ?? "the coach";
  const coachNames = (list: BookableSession[]) => [...new Set(list.map((s) => firstName(s.coachId)))];
  const email = user?.email ?? "your email";
  const offlineAvail = picked.some((s) => coaches[s.coachId]?.offlinePayAvailable && !coaches[s.coachId]?.paysDirect);
  const offlineName = firstName(picked.find((s) => coaches[s.coachId]?.offlinePayAvailable)?.coachId ?? picked[0]?.coachId ?? "");

  const book = useMutation({
    mutationFn: async () => {
      if (!athleteId) throw new Error("Sign in as an athlete or parent to book.");
      const result = { bookingIds: [] as string[], url: undefined as string | undefined };
      if (plan.direct.length) {
        const r = await bookAPI.checkout(plan.direct.map((s) => s.id), athleteId, true, offline);
        result.bookingIds.push(...r.bookingIds);
      }
      if (plan.instant.length) {
        const r = await bookAPI.checkout(plan.instant.map((s) => s.id), athleteId, useCredits);
        result.bookingIds.push(...r.bookingIds);
        if (r.url) {
          // Requests get their card hold after this payment, from the confirmation page.
          if (plan.requests.length) {
            savePendingRequests({ occurrenceIds: plan.requests.map((s) => s.id), athleteId, coachNames: coachNames(plan.requests) });
          }
          result.url = r.url;
          return result;
        }
      }
      if (plan.requests.length) {
        const r = await bookAPI.checkout(plan.requests.map((s) => s.id), athleteId);
        result.bookingIds.push(...r.bookingIds);
        result.url = r.url;
      }
      return result;
    },
    onSuccess: (result) => {
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["bookable-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["my-coaches"] });
      onBooked();
      if (result.bookingIds.length) navigate(`${ROUTES.BOOKING_CONFIRMATION}?bookings=${result.bookingIds.join(",")}`);
      else toast({ title: "Booked" });
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : "Couldn't book these sessions."),
  });

  const row = (s: BookableSession, request: boolean) => {
    const start = bookableStart(s);
    const d = getZonedISODate(start, timeZone);
    const group = s.sessionType === "group";
    const coach = coaches[s.coachId];
    const span = formatInstantSpan(start, bookableEnd(s), timeZone).replace(/ to /g, "–");
    const where = s.location === "online" ? "Video call" : s.place || coach?.locations[0] || "In person";
    return (
      <div key={s.id} className="flex items-center gap-3 rounded-card border border-light-525 p-3">
        <span
          className={cn(
            "flex h-[48px] w-[44px] flex-none flex-col items-center justify-center rounded-card",
            request ? "border border-dashed border-info-700 bg-light-300 text-info-700" : "bg-primary text-light"
          )}
        >
          <small className="text-label-xsm">{formatDayISO(d, { weekday: "short" })}</small>
          <b className="text-card-title">{formatDayISO(d, { day: "numeric" })}</b>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <b className="text-label-sm">
              {group ? `${s.sessionName} with ${firstName(s.coachId)}` : `${s.pillar || pillar || coach?.specialties[0] || "1-on-1"} with ${firstName(s.coachId)}`}
            </b>
            {group ? <BrandPill tone="teal">Group</BrandPill> : <BrandPill tone="blue">1-on-1</BrandPill>}
          </span>
          <span className={meta}>
            {formatDayISO(d, { month: "short", day: "numeric" })}, {span} · {where}
          </span>
        </span>
        <span className="flex-none text-label-sm tabular-nums">
          {request ? (
            <span className="text-dark-200">{money(s.price)}</span>
          ) : plan.covered.has(s.id) ? (
            <BrandPill tone="green">Credit</BrandPill>
          ) : (
            money(s.price)
          )}
        </span>
        <button
          type="button"
          className="inline-flex size-[30px] flex-none items-center justify-center rounded-control text-dark-300 hover:bg-light hover:text-dark [&>svg]:size-4"
          aria-label="Remove"
          onClick={() => onRemove(s)}
        >
          <X strokeWidth={1.5} />
        </button>
      </div>
    );
  };

  const now = [...plan.instant, ...plan.direct];
  const requests = plan.requests;
  const charged = plan.dueNow > 0;
  const directName = coachNames(plan.direct).join(" and ");
  const directNote = plan.direct.map((s) => coaches[s.coachId]?.payNote).find(Boolean);
  const disabled = !picked.length || !athleteId || book.isPending;
  const payLabel = `Pay ${money(plan.dueNow)}`;
  const confirmLabel = now.length
    ? `${plan.covered.size && !plan.direct.length ? `Confirm with ${plural(plan.covered.size, "credit")}` : "Confirm booking"}${
        requests.length ? ` and send ${plural(requests.length, "request")}` : ""
      }`
    : requests.length > 1
      ? `Send ${plural(requests.length, "request")}`
      : "Send request";
  const mainButton = book.isPending ? (
    <button type="button" className={cn(primaryButton, "h-[48px] w-full")} disabled>
      Working…
    </button>
  ) : charged && method === "apple" ? (
    <ApplePayButton label={`${payLabel} with`} className="h-[48px] w-full" disabled={disabled} onClick={() => book.mutate()} />
  ) : (
    <button type="button" className={cn(primaryButton, "h-[48px] w-full")} disabled={disabled} onClick={() => book.mutate()}>
      {charged ? payLabel : confirmLabel}
    </button>
  );

  const sectionLabel = (text: string) => <span className={label}>{text}</span>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={sheetContent}>
        <DialogHeader className={sheetHeader}>
          <DialogTitle className={sheetTitle}>
            {!picked.length ? "Your booking" : requests.length && !now.length ? "Review your request" : "Review your booking"}
          </DialogTitle>
          <DialogDescription className="sr-only">The times you picked and what happens next.</DialogDescription>
        </DialogHeader>

        {!picked.length ? (
          <>
            <div className={sheetBody}>
              <p className="text-body-m text-dark-300">Nothing in your booking yet.</p>
            </div>
            <div className={sheetFooter}>
              <button type="button" className={cn(primaryButton, "h-[48px] w-full")} onClick={() => onOpenChange(false)}>
                Pick a time
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={sheetBody}>
              {now.length && requests.length ? sectionLabel("Booking now") : null}
              {now.length ? <div className="flex flex-col gap-2.5">{now.map((s) => row(s, false))}</div> : null}
              {requests.length ? (
                <>
                  {now.length ? sectionLabel("Requests") : null}
                  <div className="flex flex-col gap-2.5">{requests.map((s) => row(s, true))}</div>
                  <InfoBox icon={UserCheck}>
                    {coachNames(requests).join(" and ")} {coachNames(requests).length > 1 ? "approve" : "approves"} new families first. Times are held
                    for 24 hours, and you're only charged {money(plan.ifAccepted)} if accepted.
                  </InfoBox>
                </>
              ) : null}

              <button
                type="button"
                className="flex h-[44px] w-full flex-none items-center justify-center gap-1.5 rounded-control border border-dashed border-light-600 text-label-sm text-primary hover:bg-light-400"
                onClick={() => onOpenChange(false)}
              >
                <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
                Add another session
              </button>

              {plan.availableCredits > 0 ? (
                <label className="flex items-center justify-between gap-3">
                  <span className="flex flex-col gap-1">
                    <b className="text-label-sm">Use package credits</b>
                    <span className={meta}>Applied before payment</span>
                  </span>
                  <Switch checked={useCredits} onCheckedChange={onUseCreditsChange} aria-label="Use package credits" />
                </label>
              ) : null}

              {now.length ? (
                <div className="flex flex-none flex-col gap-2.5 rounded-control bg-light-400 px-4 py-3.5 text-body-m">
                  {plan.subtotal || plan.covered.size || !plan.direct.length ? (
                    <>
                      <div className="flex justify-between gap-3">
                        <span className="text-dark-300">{plan.direct.length ? "Paid in AthaNext" : plan.instant.length > 1 ? "Sessions" : "Session"}</span>
                        <span className="tabular-nums">{money(plan.subtotal)}</span>
                      </div>
                      <FeeLines platformFees={plan.platformFees} processingFees={plan.processingFees} />
                      <div className="h-px bg-light-525" />
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-subtitle">{requests.length || plan.direct.length ? "Due now" : "Total"}</span>
                        <span className={stat28}>{money(plan.dueNow)}</span>
                      </div>
                    </>
                  ) : null}
                  {plan.direct.length ? (
                    <>
                      {plan.subtotal || plan.covered.size ? <div className="h-px bg-light-525" /> : null}
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-subtitle">Pay {directName} directly</span>
                        <span className={stat28}>{money(plan.payDirect)}</span>
                      </div>
                      <span className={meta}>
                        {directNote ||
                          (offline
                            ? `Nothing is charged in AthaNext. It shows as pending until ${directName} confirms receipt.`
                            : `${directName} takes payment directly. Nothing is charged in AthaNext.`)}
                      </span>
                    </>
                  ) : null}
                </div>
              ) : null}

              {error ? (
                <p role="alert" className="rounded-control border border-error-300 bg-error-50 px-3 py-2 text-body-m text-error-700">
                  {error}
                </p>
              ) : null}
              {!athleteId ? <p className={meta}>Sign in as an athlete or parent to book.</p> : null}
            </div>

            {choosing && charged && !offline ? (
              <div className={cn(sheetFooter, "flex-col")}>
                <span className={label}>Pay with</span>
                <PayMethodList name="review-pay" value={method} onChange={setMethod} applePay={applePay} />
                <div className="flex justify-between gap-2.5">
                  <button type="button" className={cn(secondaryButton, "h-[44px] flex-1 sm:flex-none")} onClick={() => setChoosing(false)}>
                    Back
                  </button>
                  {method === "apple" ? (
                    <ApplePayButton label={`${payLabel} with`} className="flex-1 sm:flex-none" disabled={disabled} onClick={() => book.mutate()} />
                  ) : (
                    <button type="button" className={cn(primaryButton, "h-[44px] flex-1 sm:flex-none")} disabled={disabled} onClick={() => book.mutate()}>
                      {book.isPending ? "Working…" : payLabel}
                    </button>
                  )}
                </div>
                <CheckoutTermsLine />
              </div>
            ) : (
              <div className={cn(sheetFooter, "flex-col")}>
                {mainButton}
                {charged ? <CheckoutTermsLine /> : null}
                {charged && requests.length ? (
                  <span className={cn(meta, "text-center")}>
                    {plural(requests.length, "request")} {requests.length > 1 ? "are" : "is"} sent at the same time.
                  </span>
                ) : null}
                <span className={cn(meta, "text-center")}>
                  Free cancellation with {CANCEL_HOURS} hours notice.{" "}
                  {charged ? `Receipt goes to ${email}.` : now.length ? `Confirmation goes to ${email}.` : "You get a message when they reply."}
                </span>
                {charged || offlineAvail ? (
                  <div className="flex w-full flex-wrap items-center justify-between gap-2">
                    {charged && !offline ? (
                      <button type="button" className={cn(textButton, "text-dark-300")} onClick={() => setChoosing(true)}>
                        Change payment method
                      </button>
                    ) : (
                      <span />
                    )}
                    {offlineAvail ? (
                      <span className="flex flex-col items-end gap-1">
                        <button type="button" className={cn(textButton, "text-dark-300")} onClick={() => setOffline((v) => !v)}>
                          {offline ? "Pay by card instead" : `Pay ${offlineName} directly instead`}
                        </button>
                        {offline ? (
                          <span className={cn(meta, "text-right")}>
                            Card adds a payment processing fee of {fees.stripePerc}% + ${Number(fees.stripeFixed ?? 0).toFixed(2)}, Stripe&apos;s rate.
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </>
        )}
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
  const [held, setHeld] = useState(coach);
  useEffect(() => {
    if (coach) setHeld(coach);
  }, [coach]);
  const shown = coach ?? held;
  const [day, setDay] = useState(addDaysISO(todayISO, 2));
  const [start, setStart] = useState(17 * 60);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!coach) return;
    setDay(addDaysISO(todayISO, 2));
    setStart(17 * 60);
    setNote("");
    setError(null);
  }, [coach, todayISO]);

  // The coach's 1-on-1 length and price, from times already loaded on the page.
  const known = useMemo(() => {
    if (!shown) return null;
    for (const [, data] of queryClient.getQueriesData<{ sessions: BookableSession[] }>({ queryKey: ["bookable-sessions", shown.id] })) {
      const session = data?.sessions.find((s) => s.sessionType === "individual");
      if (session) return session;
    }
    return null;
  }, [shown, queryClient]);
  const minutes = known?.durationMinutes ?? 60;
  const price = known?.price ?? shown?.oneOnOneFrom ?? shown?.hourlyRate ?? null;

  const first = shown?.name.split(" ")[0] ?? "the coach";
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
      <DialogContent className={sheetContent}>
        <DialogHeader className={sheetHeader}>
          <DialogTitle className={sheetTitle}>Request another time with {first}</DialogTitle>
          <DialogDescription className="text-body-m text-dark-300">
            1-on-1 · {pillar ?? shown?.specialties[0] ?? "session"} · {minutes} min{price ? ` · ${money(price)}` : ""}
            <span className="mt-1.5 block text-caption text-dark-300">
              Requests are for 1-on-1 sessions only. Group times are fixed on the schedule.
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className={sheetBody}>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={label}>Day</span>
              <input className={input} type="date" min={todayISO} value={day} onChange={(e) => setDay(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={label}>Start time</span>
              <select className={input} value={start} onChange={(e) => setStart(Number(e.target.value))}>
                {REQUEST_START_MINUTES.map((m) => (
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
              placeholder="For example, any weekday after 5 works, or we can do 30 minutes earlier"
            />
          </label>
          <InfoBox icon={Info}>Nothing is charged until {first} accepts. You get a message either way, usually within a day.</InfoBox>
          {error ? (
            <p role="alert" className="rounded-control border border-info-300 bg-info-50 px-3 py-2 text-body-m text-info-700">
              {error}
            </p>
          ) : null}
        </div>
        <div className={cn(sheetFooter, "flex-nowrap justify-between")}>
          <button type="button" className={cn(secondaryButton, "flex-1 sm:flex-none")} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={cn(primaryButton, "flex-1 sm:flex-none")}
            disabled={!day || day < todayISO || send.isPending}
            onClick={() => send.mutate()}
          >
            Send request
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
