/**
 * Book a Session sheets (ATH-73, ATH-94): review the picked times across coaches, use credits,
 * pay (or send requests), and request a time that isn't listed.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BrandPill } from "@/components/brand";
import { bookAPI, type BookableSession, type BookingCoach } from "@/api/book";
import { packagesAPI } from "@/api/packages";
import { Switch } from "@/components/ui/switch";
import { planBooking } from "@/utils/bookPlan";
import { savePendingRequests } from "@/utils/pendingRequests";
import { coachPricingPath } from "@/utils/coachSlug";
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
  coaches,
  picked,
  pillar,
  athleteId,
  timeZone,
  onRemove,
  onBooked,
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
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [useCredits, setUseCredits] = useState(true);
  useEffect(() => setError(null), [open]);

  const plan = planBooking(picked, coaches, useCredits);
  const firstName = (coachId: string) => coaches[coachId]?.name.split(" ")[0] ?? "the coach";
  const coachNames = (list: BookableSession[]) => [...new Set(list.map((s) => firstName(s.coachId)))];
  const instantCoachIds = [...new Set(plan.instant.map((s) => s.coachId))];
  const packages = useQuery({
    queryKey: ["review-packages", instantCoachIds.join(",")],
    enabled: open && instantCoachIds.length > 0,
    queryFn: async () => {
      const lists = await Promise.all(instantCoachIds.map((id) => packagesAPI.getCoachPackages(id).then((r) => r.data ?? [])));
      return lists.flat();
    },
  });
  // Package callout (ATH-94): the best saving per session against what's being paid now.
  const saving = (() => {
    let best: { coachId: string; name: string; sessions: number; save: number; slug: string | null } | null = null;
    for (const pkg of packages.data ?? []) {
      const coach = coaches[pkg.coach_id];
      if (!coach || coach.credits > 0) continue;
      const perSession = pkg.total_price / 100 / Math.max(1, pkg.session_count);
      const pays = plan.instant.filter((s) => s.coachId === pkg.coach_id).map((s) => s.price);
      if (!pays.length) continue;
      const save = Math.max(...pays) - perSession;
      if (save > 0.5 && (!best || save > best.save)) {
        best = { coachId: pkg.coach_id, name: pkg.package_name, sessions: pkg.session_count, save, slug: coach.slug };
      }
    }
    return best;
  })();

  const book = useMutation({
    mutationFn: async () => {
      if (!athleteId) throw new Error("Sign in as an athlete or parent to book.");
      const result = { creditsUsed: 0, direct: 0, requested: 0, url: undefined as string | undefined };
      if (plan.direct.length) {
        const r = await bookAPI.checkout(plan.direct.map((s) => s.id), athleteId);
        if (r.requested) result.requested += plan.direct.length;
        else result.direct += plan.direct.length;
      }
      if (plan.instant.length) {
        const r = await bookAPI.checkout(plan.instant.map((s) => s.id), athleteId, useCredits);
        result.creditsUsed = r.creditsUsed;
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
      const parts = [
        result.creditsUsed ? `${plural(result.creditsUsed, "session")} booked with credits` : "",
        result.direct ? `${plural(result.direct, "session")} booked. Pay ${coachNames(plan.direct).join(" and ")} directly.` : "",
        result.requested ? `${plural(result.requested, "request")} sent` : "",
      ].filter(Boolean);
      toast({ title: parts.length ? "Done" : "Booked", description: parts.join(". ") || undefined });
      queryClient.invalidateQueries({ queryKey: ["bookable-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["my-coaches"] });
      onBooked();
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : "Couldn't book these sessions."),
  });

  const row = (s: BookableSession, tone: "blue" | "orange" | "neutral", priceText: string) => {
    const start = bookableStart(s);
    const d = getZonedISODate(start, timeZone);
    const group = s.sessionType === "group";
    const coach = coaches[s.coachId];
    return (
      <div key={s.id} className="flex items-center gap-3 rounded-[8px] border border-[#EAEADF] bg-[#F9F9F5] p-3">
        <span
          className={cn(
            "flex w-[44px] flex-none flex-col items-center rounded-[8px] py-1.5",
            tone === "orange" ? "bg-[#FCEFDA]" : tone === "blue" ? "bg-[#E5EDF7]" : "bg-[#F1F1E6]"
          )}
        >
          <small className="text-[11px] font-medium uppercase text-[#767980]">{formatDayISO(d, { weekday: "short" })}</small>
          <b className="text-[18px] font-semibold leading-[20px]">{formatDayISO(d, { day: "numeric" })}</b>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <b className="text-[14px] font-medium">
              {group ? `${s.sessionName} with ${firstName(s.coachId)}` : `${s.pillar || pillar || "1-on-1"} with ${firstName(s.coachId)}`}
            </b>
            {group ? <BrandPill tone="teal">Group</BrandPill> : <BrandPill tone="neutral">1-on-1</BrandPill>}
          </span>
          <span className={meta}>
            {formatInstantSpan(start, bookableEnd(s), timeZone)} ·{" "}
            {s.location === "online" ? "Video call" : s.place || coach?.locations[0] || "In person"}
          </span>
        </span>
        <b className="text-[14px] font-medium">{priceText}</b>
        <button type="button" className={cn(iconButton, "size-[28px]")} aria-label="Remove" onClick={() => onRemove(s)}>
          <X strokeWidth={1.5} />
        </button>
      </div>
    );
  };

  const section = (title: string, note: string, list: BookableSession[], tone: "blue" | "orange" | "neutral") =>
    list.length ? (
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <b className="text-[14px] font-medium">{title}</b>
          {note ? <span className={meta}>{note}</span> : null}
        </div>
        {list.map((s) => row(s, tone, plan.covered.has(s.id) ? "Credit" : money(s.price)))}
      </div>
    ) : null;

  const onlyRequests = !plan.instant.length && !plan.direct.length;
  const payLabel = plan.dueNow > 0
    ? `Pay ${money(plan.dueNow)}`
    : plan.instant.length
      ? "Book with credits"
      : plan.requests.length
        ? `Send ${plural(plan.requests.length, "request")}`
        : "Confirm booking";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogContent}>
        <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
          <DialogTitle className="text-[22px] font-semibold leading-[28px] tracking-[-0.05em]">
            {onlyRequests ? "Review your request" : "Review your booking"}
          </DialogTitle>
          <DialogDescription className="sr-only">The times you picked and what happens next.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-5 pb-5 sm:px-[25px]">
          {!picked.length ? <p className={meta}>Nothing picked yet.</p> : null}
          {section(
            plan.requests.length || plan.direct.length ? "Paid now" : "",
            "",
            plan.instant,
            "blue"
          )}
          {section(
            "Requests",
            `${coachNames(plan.requests).join(" and ")} approve${coachNames(plan.requests).length > 1 ? "" : "s"} new families first. Times are held for 24 hours and your card is charged ${money(plan.ifAccepted)} only if accepted.`,
            plan.requests,
            "orange"
          )}
          {section(
            `Pay ${coachNames(plan.direct).join(" and ")} directly`,
            "Nothing is charged in AthaNext.",
            plan.direct,
            "neutral"
          )}

          {plan.availableCredits > 0 ? (
            <label className="flex items-center justify-between gap-3 rounded-[8px] border border-[#EAEADF] bg-[#F9F9F5] px-3 py-2.5">
              <span className="flex flex-col">
                <b className="text-[14px] font-medium">Use package credits</b>
                <span className={meta}>{plural(plan.availableCredits, "credit")} available. Credits apply first.</span>
              </span>
              <Switch checked={useCredits} onCheckedChange={setUseCredits} aria-label="Use package credits" />
            </label>
          ) : null}

          {saving ? (
            <p className="flex items-start gap-2 rounded-[8px] bg-[#E7F4F8] px-3 py-2.5 text-[14px] leading-[18px] text-[#0E6178]">
              <Package className="mt-[1px] size-4 flex-none" strokeWidth={1.5} aria-hidden="true" />
              <span>
                {saving.name} saves {money(saving.save)} a session with {firstName(saving.coachId)} ({plural(saving.sessions, "session")}).{" "}
                <Link to={coachPricingPath(saving.slug || saving.coachId)} className="font-medium underline">See packages</Link>
              </span>
            </p>
          ) : null}

          <button type="button" className="flex h-[40px] items-center justify-center gap-2 rounded-[8px] border border-dashed border-[#C1C1B8] text-[14px] font-medium text-[#0054B4] hover:bg-[#F4F4EB]" onClick={() => onOpenChange(false)}>
            <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
            Add another session
          </button>

          <div className="flex flex-col gap-2 rounded-[8px] bg-[#F1F1E6] px-4 py-3">
            {plan.instant.length ? (
              <div className="flex justify-between text-[14px] text-[#484D56]">
                <span>Due now{plan.covered.size ? ` (${plural(plan.covered.size, "credit")} used)` : ""}</span>
                <span>{money(plan.dueNow)}</span>
              </div>
            ) : null}
            {plan.requests.length ? (
              <div className="flex justify-between text-[14px] text-[#484D56]">
                <span>Due if accepted</span>
                <span>{money(plan.ifAccepted)}</span>
              </div>
            ) : null}
            {plan.direct.length ? (
              <div className="flex justify-between text-[14px] text-[#484D56]">
                <span>Paid to the coach directly</span>
                <span>{money(plan.payDirect)}</span>
              </div>
            ) : null}
            <span className={meta}>Any booking fee is shown at checkout before you pay.</span>
          </div>

          {error ? (
            <p role="alert" className="rounded-[8px] bg-[#FEDADA] px-3 py-2 text-[14px] text-[#972B2B]">
              {error}
            </p>
          ) : null}

          <button type="button" className={cn(primaryButton, "h-[44px] w-full")} disabled={!picked.length || !athleteId || book.isPending} onClick={() => book.mutate()}>
            {book.isPending ? "Working…" : payLabel}
          </button>
          {!athleteId ? <p className={meta}>Sign in as an athlete or parent to book.</p> : null}
          <span className={cn(meta, "text-center")}>
            Cancel with 24 hours notice and the session comes back as a credit.{" "}
            {plan.dueNow > 0 || plan.requests.length
              ? "Apple Pay, Google Pay or card on Stripe's secure page. Nothing is saved to your account."
              : ""}
            {plan.dueNow > 0 && plan.requests.length ? " Your requests get their card hold right after." : ""}
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
