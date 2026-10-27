/**
 * An invoice from a coach (ATH-89), opened from the email. The account holder pays by card on
 * Stripe's page; coming back checks the payment and pays the coach. Paying offline tells the coach.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileText } from "@/components/icons";
import { invoicesAPI } from "@/api/invoices";
import { card, meta, primaryButton, secondaryButton } from "@/components/schedule/styles";
import { useFeeConfig } from "@/hooks/useFeeConfig";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { feeLine, toCents } from "@/utils/fees";
import { money } from "@/utils/payments";

const FamilyInvoicePage = () => {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { config } = useFeeConfig();
  const [opening, setOpening] = useState(false);
  const [offlineBusy, setOfflineBusy] = useState(false);
  const [offlineSent, setOfflineSent] = useState(false);
  const invoice = useQuery({ queryKey: ["family-invoice", id], queryFn: () => invoicesAPI.familyInvoice(id) });
  const returned = params.get("paid") === "1";

  useEffect(() => {
    if (!returned || invoice.data?.status !== "open") return;
    invoicesAPI
      .verify(id)
      .then(() => qc.invalidateQueries({ queryKey: ["family-invoice", id] }))
      .catch(() => undefined);
  }, [returned, invoice.data?.status, id, qc]);

  const fees = useMemo(() => {
    if (!invoice.data || !config) return null;
    return feeLine(toCents(invoice.data.amount), "invoice", config);
  }, [invoice.data, config]);

  const pay = async () => {
    setOpening(true);
    try {
      window.location.assign(await invoicesAPI.checkoutUrl(id));
    } catch (e) {
      toast({ title: "Couldn't open the payment page", description: (e as Error).message, variant: "destructive" });
      setOpening(false);
    }
  };

  const payOffline = async () => {
    setOfflineBusy(true);
    try {
      await invoicesAPI.requestOffline(id);
      setOfflineSent(true);
      toast({ title: "Told the coach", description: "They'll mark this paid once they have the money." });
    } catch (e) {
      toast({ title: "Couldn't send that", description: (e as Error).message, variant: "destructive" });
    } finally {
      setOfflineBusy(false);
    }
  };

  const inv = invoice.data;
  const due = inv ? new Date(`${inv.due}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";
  const processing = fees && fees.processingCents > 0 ? fees.processingCents / 100 : 0;
  const cardTotal = fees ? fees.totalCents / 100 : inv?.amount ?? 0;

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-wrapper-focused flex-col gap-4 pt-6 md:gap-6">
        <section className={cn(card, "gap-4")}>
          {invoice.isLoading ? <p className={meta}>Loading the invoice…</p> : null}
          {!invoice.isLoading && !inv ? (
            <>
              <b className="text-subtitle">Invoice not found</b>
              <p className="text-body-m text-dark-300">Sign in with the account the invoice was sent to.</p>
            </>
          ) : null}
          {inv ? (
            <>
              <div className="flex items-center gap-3">
                {inv.status === "paid" ? (
                  <CheckCircle2 className="size-8 text-success-700" strokeWidth={1.5} aria-hidden="true" />
                ) : (
                  <FileText className="size-8 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
                )}
                <div className="flex flex-col gap-1">
                  <h1 className="text-section">
                    {inv.status === "paid" ? "Paid, thank you" : `Invoice from ${inv.coach}`}
                  </h1>
                  <span className={meta}>{inv.status === "paid" ? `${inv.coach} has been paid.` : `Due ${due}`}</span>
                </div>
              </div>
              <dl className="flex flex-col gap-2 border-y border-light-525 py-3 text-body-m">
                <div className="flex justify-between gap-3"><dt className="text-dark-300">For</dt><dd>{inv.service}</dd></div>
                {inv.athlete ? <div className="flex justify-between gap-3"><dt className="text-dark-300">Athlete</dt><dd>{inv.athlete}</dd></div> : null}
                <div className="flex justify-between gap-3"><dt className="text-dark-300">Amount</dt><dd className="font-medium tabular-nums">{money(inv.amount)}</dd></div>
                {inv.status === "open" && processing > 0 ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-dark-300">Card processing</dt>
                    <dd className="tabular-nums">+{money(processing)}</dd>
                  </div>
                ) : null}
                {inv.status === "open" && processing > 0 ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-dark-300">Card total</dt>
                    <dd className="font-medium tabular-nums">{money(cardTotal)}</dd>
                  </div>
                ) : null}
              </dl>
              {inv.note ? <p className="text-body-m text-dark-400">{inv.note}</p> : null}
              {inv.status === "open" ? (
                <>
                  {returned ? <p className={meta}>Checking your payment…</p> : null}
                  <button type="button" className={cn(primaryButton, "self-start")} disabled={opening} onClick={pay}>
                    {opening ? "Opening…" : `Pay ${money(cardTotal)} by card`}
                  </button>
                  <button
                    type="button"
                    className={cn(secondaryButton, "self-start")}
                    disabled={offlineBusy || offlineSent}
                    onClick={payOffline}
                  >
                    {offlineSent ? "Told the coach" : offlineBusy ? "Sending…" : "Pay offline"}
                  </button>
                  <p className={meta}>
                    Card includes processing when you pay by card. Paying offline: {inv.coach} marks it paid once they have the money.
                  </p>
                </>
              ) : null}
            </>
          ) : null}
        </section>
        <Link to={ROUTES.DASHBOARD} className={cn(meta, "self-center hover:underline")}>Go to home</Link>
      </div>
    </div>
  );
};

export default FamilyInvoicePage;
