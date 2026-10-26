/** Home card: offline payments pending until the coach confirms receipt (WC4). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Bell } from "@/components/icons";
import { Link } from "react-router-dom";
import { offlinePayAPI } from "@/api/offlinePay";
import { BrandPill } from "@/components/brand";
import { card, meta, secondaryButton } from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { invalidateCoachMoney } from "@/utils/coachMoney";
import { formatDayISO, plural } from "@/utils/schedule";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: n % 1 ? 2 : 0 });

export const PaymentsToConfirm = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const pending = useQuery({ queryKey: ["pending-offline-payments"], queryFn: () => offlinePayAPI.pending() });
  const confirm = useMutation({
    mutationFn: (bookingId: string) => offlinePayAPI.confirm(bookingId),
    onSuccess: (_data, bookingId) => {
      const row = pending.data?.find((p) => p.bookingId === bookingId);
      void invalidateCoachMoney(queryClient);
      toast({
        title: "Marked paid",
        description: row ? `${row.payerName.split(" ")[0]} sees it as paid` : undefined,
      });
    },
    onError: (err: Error) => toast({ title: "Couldn't confirm", description: err.message, variant: "destructive" }),
  });

  const list = pending.data ?? [];
  if (!list.length) return null;

  const total = list.reduce((n, p) => n + p.amount, 0);
  const late = list.filter((p) => p.sessionDone).length;

  return (
    <section className={cn(card, "gap-4")} aria-label="Payments to confirm">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-card-title text-dark">
          <Banknote className="size-5 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
          Payments to confirm
        </h2>
        <span className={meta}>Paid to you directly</span>
      </div>
      <div className="flex flex-col gap-1">
        <b className="text-highlight tabular-nums">{money(total)}</b>
        <span className="text-body-m text-dark-400">
          {plural(list.length, "payment")} pending
          {late ? `, ${late} from ${late === 1 ? "a session" : "sessions"} that already happened` : ""}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {list.map((p) => {
          const forAthlete = p.payerName !== p.athleteName;
          return (
            <div key={p.bookingId} className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-light-525 bg-light-400 px-3 py-2.5">
              <Link to={`/sessions/${p.occurrenceId}`} className="flex min-w-0 grow flex-col gap-0.5 text-left hover:underline">
                <span className="truncate text-label-sm text-dark">
                  {p.payerName}
                  {forAthlete ? ` for ${p.athleteName.split(" ")[0]}` : ""}
                </span>
                <span className={meta}>
                  {p.sessionName}, {formatDayISO(p.occurrenceDate, { month: "short", day: "numeric" })}
                  {p.sessionDone ? ", session done" : ""}
                </span>
              </Link>
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-label-sm tabular-nums">{money(p.amount)}</span>
                <BrandPill tone="amber">Pending</BrandPill>
                <button
                  type="button"
                  className={cn(secondaryButton, "h-8 px-3 text-body-m")}
                  disabled={confirm.isPending}
                  onClick={() => confirm.mutate(p.bookingId)}
                >
                  Confirm received
                </button>
              </span>
            </div>
          );
        })}
      </div>
      <span className={cn(meta, "flex items-center gap-1.5")}>
        <Bell className="size-3" strokeWidth={1.5} aria-hidden="true" />
        If a payment is still pending the morning after a session, you get a reminder here and by email.
      </span>
    </section>
  );
};
