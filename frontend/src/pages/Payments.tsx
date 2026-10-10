/**
 * Coach Payments (ATH-89): outstanding, paid this month, next payout, money in, invoices and
 * in-app payments, reminders, mark as paid, create invoice, CSV export and payouts.
 * Marketplace families always pay in the app; invoices are only for families the coach
 * brought to AthaNext.
 */
import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Download, FileText, Landmark, Plus, Search, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { invoicesAPI } from "@/api/invoices";
import { payoutsAPI } from "@/api/payouts";
import { CreateInvoiceDialog, MarkPaidDialog } from "@/components/payments/InvoiceDialogs";
import { card, iconButton, meta, primaryButton, secondaryButton, segButton, segGroup, textButton } from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { useCoachPayMode } from "@/hooks/useCoachPayMode";
import { useRole } from "@/hooks/useRole";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { getZonedISODate } from "@/utils/dateHelpers";
import { downloadText } from "@/utils/download";
import {
  MAX_REMINDERS,
  STATUS_LABEL,
  isOverdue,
  money,
  moneyEntries,
  moneySeries,
  outstanding,
  paymentRows,
  paymentsCsv,
  type Invoice,
  type PaymentRow,
} from "@/utils/payments";
import { plural } from "@/utils/schedule";

const TONE: Record<PaymentRow["status"], string> = {
  paid_in_app: "bg-[#CBE7D1] text-[#1E7431]",
  paid: "bg-[#CBE7D1] text-[#1E7431]",
  overdue: "bg-[#FEDADA] text-[#972B2B]",
  pending: "bg-[#FCEFDA] text-[#8A5A00]",
  void: "bg-[#F1F1E6] text-[#484D56]",
};

const StatusPill = ({ status }: { status: PaymentRow["status"] }) => (
  <span className={cn("inline-flex whitespace-nowrap rounded-[4px] px-2 py-[3px] text-[12px] font-medium leading-[13px]", TONE[status])}>
    {STATUS_LABEL[status]}
  </span>
);

const Stat = ({ title, value, note }: { title: string; value: string; note: string }) => (
  <section className={cn(card, "gap-[6px]")}>
    <span className="text-[14px] font-medium tracking-[-0.03em] text-[#767980]">{title}</span>
    <span className="text-[28px] font-bold leading-[30px] tracking-[-0.03em] text-[#1A202C] tabular-nums">{value}</span>
    <span className={meta}>{note}</span>
  </section>
);

const shortDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const RANGES = [7, 30, 60] as const;

const MoneyIn = ({ entries, today }: { entries: ReturnType<typeof moneyEntries>; today: string }) => {
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const s = moneySeries(entries, range, today);
  const max = Math.max(...s.days.map((d) => d.amount), 1);
  const pct = s.previous ? Math.round(((s.total - s.previous) / s.previous) * 100) : null;
  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[20px] font-medium leading-[18px] tracking-[-0.05em]">Money in</h2>
        <div className={segGroup} role="group" aria-label="Period">
          {RANGES.map((r) => (
            <button key={r} type="button" aria-pressed={range === r} className={segButton(range === r)} onClick={() => setRange(r)}>
              {r}D
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-[40px] font-bold leading-[40px] tracking-[-0.03em] tabular-nums">{money(s.total)}</span>
        {pct !== null ? (
          <span className={cn("inline-flex items-center gap-1 text-[14px] font-medium", pct >= 0 ? "text-[#1E7431]" : "text-[#972B2B]")}>
            {pct >= 0 ? <TrendingUp className="size-4" strokeWidth={1.5} /> : <TrendingDown className="size-4" strokeWidth={1.5} />}
            {pct >= 0 ? "+" : ""}
            {pct}% vs previous {range} days
          </span>
        ) : null}
      </div>
      <span className={cn(meta, "-mt-3")}>
        {shortDate(s.days[0].day)} to {shortDate(today)}
      </span>
      {s.total ? (
        <div className="flex h-[120px] items-end gap-[2px]" role="img" aria-label={`Money in per day, ${money(s.total)} in total`}>
          {s.days.map((d) => (
            <span
              key={d.day}
              title={`${shortDate(d.day)}: ${money(d.amount)}`}
              className={cn("min-w-0 flex-1 rounded-t-[2px]", d.amount ? "bg-[#0054B4]" : "bg-[#EAEADF]")}
              style={{ height: `${Math.max(2, (d.amount / max) * 100)}%` }}
            />
          ))}
        </div>
      ) : (
        <p className="text-[14px] text-[#767980]">No money in for this period yet.</p>
      )}
      <div className="grid grid-cols-2 gap-4 border-t border-[#EAEADF] pt-4">
        <div className="flex flex-col gap-1">
          <span className={meta}>Your clients, no fee</span>
          <span className="text-[18px] font-medium tabular-nums">{money(s.own)}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className={meta}>Marketplace</span>
          <span className="text-[18px] font-medium tabular-nums">{money(s.marketplace)}</span>
        </div>
      </div>
    </section>
  );
};

const PaymentsPage = () => {
  const { isCoach, ready } = useRole();
  const { toast } = useToast();
  const qc = useQueryClient();
  const timeZone = useViewerTimeZone();
  const payMode = useCoachPayMode();
  const today = getZonedISODate(new Date(), timeZone);
  const toDay = (iso: string) => (iso.length > 10 ? getZonedISODate(new Date(iso), timeZone) : iso);
  const data = useQuery({ queryKey: ["coach-payments"], queryFn: () => invoicesAPI.payments(), enabled: isCoach });
  const payouts = useQuery({ queryKey: ["coach-payouts"], queryFn: () => payoutsAPI.summary(), enabled: isCoach, retry: false });
  const [filter, setFilter] = useState<"all" | "out" | "paid">("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [marking, setMarking] = useState<Invoice | null>(null);

  const remind = useMutation({
    mutationFn: (inv: Invoice) => invoicesAPI.remind(inv.id),
    onSuccess: (res, inv) => {
      qc.invalidateQueries({ queryKey: ["coach-payments"] });
      toast({
        title: res.emailed ? `Reminder sent to ${inv.family}` : `Reminder saved for ${inv.family}`,
        description: res.emailed ? `${res.reminders} of ${MAX_REMINDERS} sent` : "The email didn't go out. Try again later.",
      });
    },
    onError: (e: Error) => toast({ title: "Couldn't send the reminder", description: e.message, variant: "destructive" }),
  });

  const invoices = data.data?.invoices ?? [];
  const inApp = data.data?.inApp ?? [];
  const rows = useMemo(
    () => paymentRows(invoices, inApp, today, toDay),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invoices, inApp, today, timeZone]
  );
  const entries = useMemo(
    () => moneyEntries(invoices, inApp, toDay),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invoices, inApp, timeZone]
  );

  if (!ready) return null;
  if (!isCoach) return <Navigate to={ROUTES.DASHBOARD} replace />;

  const open = outstanding(invoices);
  const overdue = open.filter((i) => isOverdue(i, today)).length;
  const month = today.slice(0, 7);
  const paidMonth = entries.filter((e) => e.day.startsWith(month)).reduce((s, e) => s + e.amount, 0);
  const monthName = new Date(`${today}T12:00:00`).toLocaleDateString("en-US", { month: "long" });
  const q = query.trim().toLowerCase();
  const list = rows.filter(
    (r) =>
      (filter === "all" || (filter === "out" && r.invoice?.status === "open") || (filter === "paid" && (r.status === "paid" || r.status === "paid_in_app"))) &&
      (!q || `${r.family} ${r.athlete} ${r.service}`.toLowerCase().includes(q))
  );

  const summary = payouts.data;
  const nextPayout = summary?.payouts.filter((p) => p.status === "pending" || p.status === "in_transit").sort((a, b) => a.arrival.localeCompare(b.arrival))[0];
  const balance = summary?.balance ? summary.balance.available + summary.balance.pending : 0;
  const payoutDay = summary?.account.payoutDay ? summary.account.payoutDay[0].toUpperCase() + summary.account.payoutDay.slice(1) : "";
  const nextValue = nextPayout ? money(nextPayout.amount) : money(balance);
  const nextNote = !summary?.account.connected
    ? "Set up payouts to get paid"
    : nextPayout
      ? `Arrives ${shortDate(nextPayout.arrival)}`
      : balance
        ? `Goes out on ${payoutDay}`
        : "Nothing scheduled";

  const exportCsv = () => {
    downloadText(paymentsCsv(list), `athanext-payments-${today}.csv`);
    toast({ title: "CSV downloaded" });
  };

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-5">
        {payMode.data === "self" ? (
          <div className="flex flex-wrap items-center gap-2 rounded-[8px] bg-[#E5EDF7] px-4 py-3 text-[14px] text-[#00326C]">
            <Wallet className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            <span className="flex-1">Booking only is on. New bookings are paid to you directly, outside AthaNext. Past payments stay here.</span>
            <Link to={`${ROUTES.SETTINGS}?tab=booking`} className={textButton}>Change</Link>
          </div>
        ) : null}

        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-[10px]">
            <h1 className="text-[26px] md:text-[32px] font-bold leading-[26px] md:leading-[28px] tracking-[-1.6px] text-[#1A202C]">Payments</h1>
            <p className="text-[16px] leading-[18px] text-[#767980]">Invoices, balances and payouts</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryButton} onClick={exportCsv} disabled={!list.length}>
              <Download strokeWidth={1.5} aria-hidden="true" />
              Export CSV
            </button>
            <button type="button" className={primaryButton} onClick={() => setCreating(true)}>
              <Plus strokeWidth={1.5} aria-hidden="true" />
              Create invoice
            </button>
          </div>
        </header>

        {data.isError ? <p className="text-[14px] text-[#972B2B]">Couldn't load payments. {(data.error as Error).message}</p> : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat title="Outstanding" value={money(open.reduce((s, i) => s + i.amount, 0))} note={`${plural(open.length, "invoice")}, ${overdue} overdue`} />
          <Stat title="Paid this month" value={money(paidMonth)} note={`${monthName}, all sources`} />
          <Stat title="Next payout" value={payouts.isLoading ? "…" : nextValue} note={payouts.isLoading ? "Loading" : nextNote} />
        </div>

        <MoneyIn entries={entries} today={today} />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className={cn(card, "min-w-0")}>
            <h2 className="flex items-center gap-2 text-[20px] font-medium leading-[18px] tracking-[-0.05em]">
              <FileText className="size-5 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
              Invoices and payments
            </h2>
            <p className={cn(meta, "-mt-2")}>
              Marketplace families always pay in the app when they book. Invoices and cash payments are only for families you brought to
              AthaNext.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className={segGroup} role="group" aria-label="Show">
                {([
                  ["all", "All"],
                  ["out", `Outstanding ${open.length}`],
                  ["paid", "Paid"],
                ] as const).map(([k, l]) => (
                  <button key={k} type="button" aria-pressed={filter === k} className={segButton(filter === k)} onClick={() => setFilter(k)}>
                    {l}
                  </button>
                ))}
              </div>
              <label className="relative w-full sm:w-[220px]">
                <span className="sr-only">Search families</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
                <input
                  className="h-[34px] w-full rounded-[8px] border border-[#EAEADF] bg-[#F9F9F5] pl-9 pr-3 text-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]"
                  placeholder="Search families"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>
            {data.isLoading ? <p className={meta}>Loading…</p> : null}
            {!data.isLoading && !list.length ? <p className="text-[14px] text-[#767980]">No invoices or payments here.</p> : null}
            {list.length ? (
              <div className="-mx-1 overflow-x-auto px-1">
                <table className="w-full min-w-[600px] text-left text-[14px]">
                  <thead>
                    <tr className="border-b border-[#EAEADF] text-[12px] text-[#767980]">
                      <th className="py-2 font-medium">Family</th>
                      <th className="py-2 font-medium">For</th>
                      <th className="py-2 font-medium">Date</th>
                      <th className="py-2 text-right font-medium">Amount</th>
                      <th className="py-2 text-right font-medium">Status</th>
                      <th className="w-[120px] py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => (
                      <tr key={r.key} className="border-b border-[#EAEADF] last:border-0">
                        <td className="py-2.5">
                          <span className="flex flex-col">
                            <span className="font-medium">{r.family}</span>
                            {r.athlete && r.athlete !== r.family ? <span className={meta}>{r.athlete}</span> : null}
                          </span>
                        </td>
                        <td className="py-2.5 text-[#484D56]">{r.service}</td>
                        <td className="py-2.5 text-[#484D56]">
                          {r.invoice ? `Due ${shortDate(r.date)}` : shortDate(r.date)}
                        </td>
                        <td className="py-2.5 text-right tabular-nums">{money(r.amount)}</td>
                        <td className="py-2.5 text-right"><StatusPill status={r.status} /></td>
                        <td className="py-2.5">
                          {r.invoice?.status === "open" ? (
                            <span className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                className={textButton}
                                disabled={r.invoice.reminders >= MAX_REMINDERS || remind.isPending}
                                title={r.invoice.reminders >= MAX_REMINDERS ? "3 reminders sent" : undefined}
                                onClick={() => remind.mutate(r.invoice!)}
                              >
                                Remind
                              </button>
                              <button type="button" className={iconButton} aria-label="Mark as paid" title="Mark as paid" onClick={() => setMarking(r.invoice)}>
                                <Check strokeWidth={1.5} />
                              </button>
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          <div className="flex flex-col gap-5">
            <section className={card}>
              <h2 className="text-[20px] font-medium leading-[18px] tracking-[-0.05em]">Outstanding balances</h2>
              {open.length ? (
                <>
                  <div className="flex flex-col">
                    {[...open].sort((a, b) => a.due.localeCompare(b.due)).map((i) => {
                      const late = isOverdue(i, today);
                      const days = Math.round((Date.parse(today) - Date.parse(i.due)) / 86_400_000);
                      return (
                        <div key={i.id} className="flex items-start justify-between gap-3 border-b border-[#EAEADF] py-2.5 last:border-0">
                          <span className="flex min-w-0 flex-col gap-1">
                            <span className="truncate font-medium">{i.family}</span>
                            <span className={cn(meta, late && "text-[#972B2B]")}>{late ? `Overdue by ${plural(days, "day")}` : `Due ${shortDate(i.due)}`}</span>
                          </span>
                          <span className="flex flex-col items-end gap-1">
                            <span className="font-medium tabular-nums">{money(i.amount)}</span>
                            {i.reminders >= MAX_REMINDERS ? (
                              <span className={meta}>3 reminders sent</span>
                            ) : (
                              <button type="button" className={textButton} disabled={remind.isPending} onClick={() => remind.mutate(i)}>
                                Send reminder
                              </button>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className={meta}>Reminders go to the account holder. Up to 3 per invoice.</p>
                </>
              ) : (
                <p className="text-[14px] text-[#767980]">Nothing outstanding.</p>
              )}
            </section>

            <section className={card}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-[20px] font-medium leading-[18px] tracking-[-0.05em]">
                  <Landmark className="size-5 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
                  Payouts
                </h2>
                <Link to={`${ROUTES.SETTINGS}?tab=booking`} className={textButton}>Settings</Link>
              </div>
              {payouts.isLoading ? <p className={meta}>Loading…</p> : null}
              {payouts.isError ? <p className={meta}>{(payouts.error as Error).message}</p> : null}
              {summary && !summary.account.connected ? (
                <p className="text-[14px] text-[#484D56]">Set up payouts in Settings to get paid for sessions families pay for in AthaNext.</p>
              ) : null}
              {summary?.account.connected ? (
                <>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-[14px]">
                      <span className="text-[#484D56]">Waiting for the next payout</span>
                      <span className="tabular-nums">{money(balance)}</span>
                    </div>
                    {payoutDay ? <span className={meta}>Paid out every {payoutDay}{summary.account.bankLast4 ? ` to the account ending ${summary.account.bankLast4}` : ""}.</span> : null}
                  </div>
                  {summary.payouts.length ? (
                    <div className="flex flex-col">
                      {summary.payouts.map((p) => (
                        <div key={p.id} className="flex items-center justify-between border-b border-[#EAEADF] py-2.5 text-[14px] last:border-0">
                          <span className="text-[#484D56]">{shortDate(p.arrival)}</span>
                          <span className="flex items-center gap-2">
                            <span className="tabular-nums">{money(p.amount)}</span>
                            <StatusPill status={p.status === "paid" ? "paid" : p.status === "failed" || p.status === "canceled" ? "overdue" : "pending"} />
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={meta}>No payouts yet.</p>
                  )}
                </>
              ) : null}
            </section>
          </div>
        </div>
      </div>

      <CreateInvoiceDialog open={creating} clients={data.data?.clients ?? []} today={today} onClose={() => setCreating(false)} />
      <MarkPaidDialog invoice={marking} onClose={() => setMarking(null)} />
    </div>
  );
};

export default PaymentsPage;
