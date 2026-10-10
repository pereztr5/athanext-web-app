/**
 * Business (ATH-89, Working Copy): money in and invoices. Money in has a line or bar chart
 * for 1, 7, 30, 60 days or a custom range, split into your clients, marketplace and gear.
 * Invoices fold away under a summary; on phone each one opens like an accordion. Org owners
 * also get Org coaches and Org sessions tabs. Marketplace families always pay in the app;
 * invoices are only for families the coach brought to AthaNext.
 */
import { useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChartColumn, ChartSpline, Check, ChevronDown, DollarSign, Download, FileText, Plus, Search, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { BrandPill, type BrandPillTone } from "@/components/brand";
import { invoicesAPI } from "@/api/invoices";
import { CreateInvoiceDialog, MarkPaidDialog } from "@/components/payments/InvoiceDialogs";
import { MoneyChart } from "@/components/payments/MoneyChart";
import { OrgMoneyTabs, type OrgMoneyTab } from "@/components/organization/OrgMoneyTabs";
import { card, iconButton, input, pageTitle, primaryButton, secondaryButton, segButton, segGroup, smallButton, textButton } from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { useCoachPayMode } from "@/hooks/useCoachPayMode";
import { useMyOrganization } from "@/hooks/useOrganizations";
import { useRole } from "@/hooks/useRole";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { getZonedISODate } from "@/utils/dateHelpers";
import { downloadText } from "@/utils/download";
import {
  MAX_REMINDERS,
  STATUS_LABEL,
  money,
  moneyEntries,
  moneySeries,
  outstanding,
  paymentRows,
  paymentsCsv,
  type Invoice,
  type MoneyEntry,
  type PaymentRow,
} from "@/utils/payments";
import { addDaysISO, plural } from "@/utils/schedule";

const TONE: Record<PaymentRow["status"], BrandPillTone> = {
  paid_in_app: "green",
  paid: "green",
  overdue: "red",
  pending: "amber",
  void: "neutral",
};

const StatusPill = ({ status }: { status: PaymentRow["status"] }) => <BrandPill tone={TONE[status]}>{STATUS_LABEL[status]}</BrandPill>;

const shortDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const longDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const RANGES = ["1D", "7D", "30D", "60D", "Custom"] as const;
type Range = (typeof RANGES)[number];
const h2 = "text-[20px] font-medium leading-[18px] tracking-[-0.05em]";
const cap = "text-[12px] leading-[14px] text-[#767980]";
const inlineSeg = cn(segGroup, "inline-flex max-w-full overflow-x-auto [scrollbar-width:none]");

const MoneyIn = ({ entries, today }: { entries: MoneyEntry[]; today: string }) => {
  const [range, setRange] = useState<Range>("30D");
  const [type, setType] = useState<"line" | "bar">("line");
  const [from, setFrom] = useState(addDaysISO(today, -20));
  const [to, setTo] = useState(today);
  const custom = range === "Custom";
  const end = custom ? (to > today ? today : to) : today;
  const n = custom
    ? Math.max(1, Math.round((Date.parse(end) - Date.parse(from > end ? end : from)) / 86_400_000) + 1)
    : { "1D": 1, "7D": 7, "30D": 30, "60D": 60 }[range as Exclude<Range, "Custom">];
  const s = moneySeries(entries, n, end);
  const pct = s.previous ? Math.round(((s.total - s.previous) / s.previous) * 100) : null;
  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={cn(h2, "flex items-center gap-2")}>
          <DollarSign className="size-5" strokeWidth={1.5} aria-hidden="true" />
          Money in
        </h2>
        <div className="flex flex-wrap gap-2">
          <div className={inlineSeg} role="group" aria-label="Chart">
            {(
              [
                ["line", "Line", ChartSpline],
                ["bar", "Bar", ChartColumn],
              ] as const
            ).map(([k, l, Icon]) => (
              <button key={k} type="button" aria-pressed={type === k} className={cn(segButton(type === k), "flex-none")} onClick={() => setType(k)}>
                <Icon strokeWidth={1.5} aria-hidden="true" />
                {l}
              </button>
            ))}
          </div>
          <div className={inlineSeg} role="group" aria-label="Period">
            {RANGES.map((r) => (
              <button key={r} type="button" aria-pressed={range === r} className={cn(segButton(range === r), "flex-none")} onClick={() => setRange(r)}>
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>
      {custom ? (
        <div className="grid max-w-[380px] grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium leading-[13px] text-[#767980]">From</span>
            <input type="date" className={input} value={from} max={today} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium leading-[13px] text-[#767980]">To</span>
            <input type="date" className={input} value={to} max={today} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
      ) : null}
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-[40px] font-bold leading-[40px] tracking-[-0.03em] tabular-nums">{money(s.total)}</span>
        {pct !== null ? (
          <span className={cn("inline-flex items-center gap-[3px] text-[12px] font-medium", pct >= 0 ? "text-[#1E7431]" : "text-[#972B2B]")}>
            {pct >= 0 ? <TrendingUp className="size-[13px]" strokeWidth={1.5} /> : <TrendingDown className="size-[13px]" strokeWidth={1.5} />}
            {pct >= 0 ? "+" : ""}
            {pct}% vs previous {n === 1 ? "day" : `${n} days`}
          </span>
        ) : null}
      </div>
      <span className={cn(cap, "-mt-3")}>{n === 1 ? longDate(end) : `${shortDate(s.days[0].day)} to ${shortDate(end)}`}</span>
      {s.total ? (
        <MoneyChart days={s.days} type={type} />
      ) : (
        <div className="rounded-[8px] border border-dashed border-[#C1C1B8] p-[18px] text-center text-[13px] text-[#767980]">No money in for this period yet.</div>
      )}
      <div className="grid grid-cols-1 gap-3 border-t border-[#EAEADF] pt-4 md:grid-cols-3">
        {(
          [
            ["Your clients, no fee", s.own],
            ["Marketplace", s.marketplace],
            ["Gear and deals", s.gear],
          ] as const
        ).map(([l, v]) => (
          <div key={l} className="flex flex-col gap-1">
            <span className={cap}>{l}</span>
            <span className="text-[16px] font-medium leading-[18px] tracking-[-0.05em] tabular-nums">{money(v)}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

const ORG_TABS = [
  ["money", "Money"],
  ["coaches", "Org coaches"],
  ["sessions", "Org sessions"],
] as const;
type BizTab = (typeof ORG_TABS)[number][0];

const PaymentsPage = () => {
  const { isCoach, ready } = useRole();
  const { toast } = useToast();
  const qc = useQueryClient();
  const timeZone = useViewerTimeZone();
  const payMode = useCoachPayMode();
  const { data: org } = useMyOrganization();
  const [params, setParams] = useSearchParams();
  const tab: BizTab = org ? ((ORG_TABS.find(([k]) => k === params.get("tab"))?.[0] ?? "money") as BizTab) : "money";
  const setTab = (t: BizTab) => setParams(t === "money" ? {} : { tab: t }, { replace: true });
  const today = getZonedISODate(new Date(), timeZone);
  const toDay = (iso: string) => (iso.length > 10 ? getZonedISODate(new Date(iso), timeZone) : iso);
  const data = useQuery({ queryKey: ["coach-payments"], queryFn: () => invoicesAPI.payments(), enabled: isCoach });
  const gear = useQuery({ queryKey: ["coach-gear-earnings"], queryFn: () => invoicesAPI.gearEarnings(400), enabled: isCoach, staleTime: 300_000 });
  const [invoicesOpen, setInvoicesOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "out" | "paid">("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(5);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [marking, setMarking] = useState<Invoice | null>(null);

  const remind = useMutation({
    mutationFn: (inv: Invoice) => invoicesAPI.remind(inv.id),
    onSuccess: (res, inv) => {
      qc.invalidateQueries({ queryKey: ["coach-payments"] });
      toast({
        title: res.emailed ? `Reminder ${res.reminders} of ${MAX_REMINDERS} sent to ${inv.family}` : `Reminder saved for ${inv.family}`,
        description: res.emailed ? undefined : "The email didn't go out. Try again later.",
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
    () => [...moneyEntries(invoices, inApp, toDay), ...(gear.data ?? []).map((g) => ({ day: g.date, amount: g.amount, own: false, gear: true }))],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invoices, inApp, gear.data, timeZone]
  );

  if (!ready) return null;
  if (!isCoach) return <Navigate to={ROUTES.DASHBOARD} replace />;

  const open = outstanding(invoices);
  const q = query.trim().toLowerCase();
  const list = rows.filter(
    (r) =>
      (filter === "all" || (filter === "out" && r.invoice?.status === "open") || (filter === "paid" && (r.status === "paid" || r.status === "paid_in_app"))) &&
      (!q || `${r.family} ${r.athlete} ${r.service}`.toLowerCase().includes(q))
  );
  const pickFilter = (f: typeof filter) => {
    setFilter(f);
    setLimit(5);
    setOpenRow(null);
  };

  const exportCsv = () => {
    downloadText(paymentsCsv(list), `athanext-payments-${today}.csv`);
    toast({ title: "CSV downloaded" });
  };

  const rowActions = (r: PaymentRow, phone = false) =>
    r.invoice?.status === "open" ? (
      phone ? (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            className={cn(secondaryButton, smallButton)}
            disabled={r.invoice.reminders >= MAX_REMINDERS || remind.isPending}
            onClick={() => remind.mutate(r.invoice!)}
          >
            {r.invoice.reminders >= MAX_REMINDERS ? "3 reminders sent" : "Send reminder"}
          </button>
          <button type="button" className={cn(secondaryButton, smallButton)} onClick={() => setMarking(r.invoice)}>
            <Check strokeWidth={1.5} aria-hidden="true" />
            Mark as paid
          </button>
        </div>
      ) : (
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
      )
    ) : null;

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-4 md:gap-6">
        {payMode.data === "self" ? (
          <div className="flex flex-wrap items-start gap-[10px] rounded-[8px] bg-[#F4F4EB] px-[14px] py-3 text-[12px] leading-[14px] text-[#767980]">
            <Wallet className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            <span className="flex-1">Booking only is on. New bookings are paid to you directly, outside AthaNext. Past payments stay here.</span>
            <Link to={`${ROUTES.SETTINGS}?tab=booking`} className={cn(textButton, "text-[12px]")}>
              Change
            </Link>
          </div>
        ) : null}

        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-[10px]">
            <h1 className={pageTitle}>Business</h1>
            <p className="text-[14px] text-[#767980]">
              {tab === "money" || !org ? "Money in and invoices" : `${org.name} · ${plural(org.coaches.length, "coach", "coaches")}`}
            </p>
          </div>
          {tab === "money" ? (
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
          ) : null}
        </header>

        {org ? (
          <div className="flex gap-1 overflow-x-auto border-b border-[#EAEADF]" role="tablist" aria-label="Business">
            {ORG_TABS.map(([k, l]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cn(
                  "-mb-px whitespace-nowrap border-b-2 px-[14px] py-[10px] text-[14px] font-medium",
                  tab === k ? "border-[#0054B4] text-[#0054B4]" : "border-transparent text-[#767980] hover:text-[#1A202C]"
                )}
              >
                {l}
              </button>
            ))}
          </div>
        ) : null}

        {org && tab !== "money" ? (
          <OrgMoneyTabs org={org} tab={tab as OrgMoneyTab} onTab={(t) => setTab(t)} />
        ) : (
          <>
            {data.isError ? <p className="text-[14px] text-[#972B2B]">Couldn't load payments. {(data.error as Error).message}</p> : null}

            <MoneyIn entries={entries} today={today} />

            <section className={cn(card, "gap-4")}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 text-left"
                aria-expanded={invoicesOpen}
                onClick={() => setInvoicesOpen((v) => !v)}
              >
                <span className={cn(h2, "flex items-center gap-[10px]")}>
                  <FileText className="size-5" strokeWidth={1.5} aria-hidden="true" />
                  Invoices
                </span>
                <span className="flex items-center gap-[10px]">
                  <span className={cap}>{open.length ? `${open.length} outstanding · ${money(open.reduce((n, i) => n + i.amount, 0))} due` : "Nothing outstanding"}</span>
                  <ChevronDown className={cn("size-5 transition-transform", invoicesOpen && "rotate-180")} strokeWidth={1.5} aria-hidden="true" />
                </span>
              </button>

              {invoicesOpen ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className={inlineSeg} role="group" aria-label="Show">
                      {(
                        [
                          ["all", "All"],
                          ["out", `Outstanding ${open.length}`],
                          ["paid", "Paid"],
                        ] as const
                      ).map(([k, l]) => (
                        <button key={k} type="button" aria-pressed={filter === k} className={cn(segButton(filter === k), "flex-none")} onClick={() => pickFilter(k)}>
                          {l}
                        </button>
                      ))}
                    </div>
                    <label className="relative w-full sm:w-[220px]">
                      <span className="sr-only">Search invoices</span>
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
                      <input className={cn(input, "pl-9")} placeholder="Search families" value={query} onChange={(e) => setQuery(e.target.value)} />
                    </label>
                  </div>
                  {data.isLoading ? <p className="text-[14px] text-[#767980]">Loading…</p> : null}
                  {!data.isLoading && !list.length ? (
                    <div className="rounded-[8px] border border-dashed border-[#C1C1B8] p-[18px] text-center text-[13px] text-[#767980]">No invoices here.</div>
                  ) : null}
                  {list.length ? (
                    <>
                      {/* Phone: one row per invoice that opens like an accordion. */}
                      <div className="flex flex-col md:hidden">
                        {list.slice(0, limit).map((r) => {
                          const isOpen = openRow === r.key;
                          return (
                            <div key={r.key} className="border-t border-[#EAEADF] first:border-t-0">
                              <button
                                type="button"
                                className="flex w-full items-center gap-[10px] py-3 text-left"
                                aria-expanded={isOpen}
                                onClick={() => setOpenRow(isOpen ? null : r.key)}
                              >
                                <span className="flex min-w-0 grow flex-col gap-1">
                                  <span className="truncate text-[14px] font-medium">{r.family}</span>
                                  <span className={cap}>
                                    {r.athlete || r.family} · {r.invoice ? "due" : "paid"} {shortDate(r.date)}
                                  </span>
                                </span>
                                <span className="flex flex-col items-end gap-1">
                                  <span className="text-[14px] font-medium tabular-nums">{money(r.amount)}</span>
                                  <StatusPill status={r.status} />
                                </span>
                                <ChevronDown className={cn("size-4 flex-none text-[#A3A6AB] transition-transform", isOpen && "rotate-180")} strokeWidth={1.5} aria-hidden="true" />
                              </button>
                              {isOpen ? (
                                <div className="flex flex-col gap-2 pb-[14px] text-[14px]">
                                  <div className="flex justify-between gap-3">
                                    <span className={cap}>For</span>
                                    <span>{r.service}</span>
                                  </div>
                                  <div className="flex justify-between gap-3">
                                    <span className={cap}>{r.invoice ? "Due" : "Paid"}</span>
                                    <span>{new Date(`${r.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                                  </div>
                                  {rowActions(r, true)}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                        {list.length > limit ? (
                          <button type="button" className={cn(textButton, "mt-1.5 self-start")} onClick={() => setLimit((l) => l + 5)}>
                            Show {Math.min(5, list.length - limit)} more of {list.length}
                          </button>
                        ) : list.length > 5 ? (
                          <button type="button" className={cn(textButton, "mt-1.5 self-start")} onClick={() => setLimit(5)}>
                            Show fewer
                          </button>
                        ) : null}
                      </div>
                      <div className="hidden overflow-x-auto md:block">
                        <table className="w-full min-w-[600px] border-collapse text-left text-[14px]">
                          <thead>
                            <tr className="text-[12px] leading-[13px] text-[#767980]">
                              <th className="whitespace-nowrap py-3 pr-[10px] font-medium">Family</th>
                              <th className="whitespace-nowrap py-3 pr-[10px] font-medium">Service</th>
                              <th className="whitespace-nowrap py-3 pr-[10px] font-medium">Due</th>
                              <th className="whitespace-nowrap py-3 pr-[10px] text-right font-medium">Amount</th>
                              <th className="whitespace-nowrap py-3 pr-[10px] text-right font-medium">Status</th>
                              <th className="py-3" />
                            </tr>
                          </thead>
                          <tbody>
                            {list.map((r) => (
                              <tr key={r.key} className="border-t border-[#EAEADF]">
                                <td className="whitespace-nowrap py-[14px] pr-[10px]">
                                  <span className="flex flex-col gap-1">
                                    <span className="font-medium">{r.family}</span>
                                    {r.athlete && r.athlete !== r.family ? <span className={cap}>{r.athlete}</span> : null}
                                  </span>
                                </td>
                                <td className="whitespace-nowrap py-[14px] pr-[10px] text-[#767980]">{r.service}</td>
                                <td className="whitespace-nowrap py-[14px] pr-[10px] text-[#767980]">{shortDate(r.date)}</td>
                                <td className="whitespace-nowrap py-[14px] pr-[10px] text-right tabular-nums">{money(r.amount)}</td>
                                <td className="whitespace-nowrap py-[14px] pr-[10px] text-right">
                                  <StatusPill status={r.status} />
                                </td>
                                <td className="whitespace-nowrap py-[14px] text-right">{rowActions(r)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : null}
                </>
              ) : null}
            </section>
          </>
        )}
      </div>

      <CreateInvoiceDialog open={creating} clients={data.data?.clients ?? []} today={today} onClose={() => setCreating(false)} />
      <MarkPaidDialog invoice={marking} onClose={() => setMarking(null)} />
    </div>
  );
};

export default PaymentsPage;
