/**
 * My Business "Offline payments", for every coach: sessions waiting for a cash, Zelle or Venmo
 * payment (Mark as paid), what was paid to you directly this month and all time, and the
 * latest 10. Kept apart from money paid in the app.
 */
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote } from "@/components/icons";
import { BrandPill } from "@/components/brand";
import { offlinePayAPI } from "@/api/offlinePay";
import { card, meta, secondaryButton } from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { markPaidError, payerLine } from "@/utils/offlinePayments";
import { money } from "@/utils/payments";
import { formatDayISO } from "@/utils/schedule";

const day = (iso: string) => (iso ? formatDayISO(iso, { month: "short", day: "numeric" }) : "");

export const OfflinePayments = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const offline = useQuery({ queryKey: ["coach-offline-payments"], queryFn: () => offlinePayAPI.summary() });
  const markPaid = useMutation({
    mutationFn: (bookingId: string) => offlinePayAPI.confirm(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-offline-payments"] });
      queryClient.invalidateQueries({ queryKey: ["pending-offline-payments"] });
      toast({ title: "Marked as paid" });
    },
    onError: (err) => {
      const copy = markPaidError(err);
      toast({ title: copy.title, description: copy.description, variant: "destructive" });
    },
  });

  const data = offline.data;
  const empty = data && !data.waiting.length && !data.recent.length && !data.paidTotal;

  return (
    <section className={cn(card, "gap-4")} aria-label="Offline payments">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-card-title text-dark">
          <Banknote className="size-5 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
          Offline payments
        </h2>
        <span className={meta}>Cash, Zelle, Venmo</span>
      </div>

      {offline.isError ? (
        <p className="text-body-m text-error-700">Couldn't load offline payments. Try again in a moment.</p>
      ) : !data ? (
        <div className="h-24 animate-pulse rounded-control bg-light-400" />
      ) : empty ? (
        <p className={meta}>No offline payments yet. When a family pays you directly, it shows up here.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1 rounded-control border border-light-525 bg-light-400 px-3 py-2.5">
              <span className={meta}>Paid to you directly this month</span>
              <b className="text-highlight tabular-nums">{money(data.paidMonth)}</b>
            </div>
            <div className="flex flex-col gap-1 rounded-control border border-light-525 bg-light-400 px-3 py-2.5">
              <span className={meta}>Paid to you directly, all time</span>
              <b className="text-highlight tabular-nums">{money(data.paidTotal)}</b>
            </div>
          </div>

          {data.waiting.length ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-label-sm text-dark">Waiting for payment</h3>
              {data.waiting.map((p) => (
                <div
                  key={p.bookingId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-light-525 bg-light-400 px-3 py-2.5"
                >
                  <Link to={`/sessions/${p.occurrenceId}`} className="flex min-w-0 grow flex-col gap-0.5 text-left hover:underline">
                    <span className="truncate text-label-sm text-dark">{payerLine(p)}</span>
                    <span className={meta}>
                      {p.sessionName}, {day(p.occurrenceDate)}
                      {p.sessionDone ? ", session done" : ""}
                    </span>
                  </Link>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-label-sm tabular-nums">{money(p.amount)}</span>
                    <BrandPill tone="amber">Waiting</BrandPill>
                    <button
                      type="button"
                      className={cn(secondaryButton, "h-8 px-3 text-body-m")}
                      disabled={markPaid.isPending}
                      onClick={() => markPaid.mutate(p.bookingId)}
                    >
                      Mark as paid
                    </button>
                  </span>
                </div>
              ))}
              {markPaid.isError && markPaidError(markPaid.error).planEnded ? (
                <Link to={`${ROUTES.SETTINGS}?tab=plan`} className={cn(meta, "self-start underline")}>
                  Open Plan settings
                </Link>
              ) : null}
            </div>
          ) : null}

          {data.recent.length ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-label-sm text-dark">Latest offline payments</h3>
              <ul className="flex flex-col divide-y divide-light-525">
                {data.recent.map((p) => (
                  <li key={`${p.kind}-${p.id}`} className="flex items-center justify-between gap-3 py-2">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex items-center gap-1.5 truncate text-label-sm text-dark">
                        {p.athleteName}
                        {p.kind === "camp" ? <BrandPill tone="teal">Camp</BrandPill> : null}
                      </span>
                      <span className={meta}>
                        {p.name}
                        {p.paidOn ? `, ${day(p.paidOn)}` : ""}
                      </span>
                    </span>
                    <span className="text-label-sm tabular-nums">{money(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
};
