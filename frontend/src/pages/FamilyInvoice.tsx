/**
 * An invoice from a coach (ATH-89), opened from the email. The account holder pays by card on
 * Stripe's page; coming back checks the payment and pays the coach.
 */
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileText } from "lucide-react";
import { invoicesAPI } from "@/api/invoices";
import { card, meta, primaryButton } from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { money } from "@/utils/payments";

const FamilyInvoicePage = () => {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [opening, setOpening] = useState(false);
  const invoice = useQuery({ queryKey: ["family-invoice", id], queryFn: () => invoicesAPI.familyInvoice(id) });
  const returned = params.get("paid") === "1";

  useEffect(() => {
    if (!returned || invoice.data?.status !== "open") return;
    invoicesAPI
      .verify(id)
      .then(() => qc.invalidateQueries({ queryKey: ["family-invoice", id] }))
      .catch(() => undefined);
  }, [returned, invoice.data?.status, id, qc]);

  const pay = async () => {
    setOpening(true);
    try {
      window.location.assign(await invoicesAPI.checkoutUrl(id));
    } catch (e) {
      toast({ title: "Couldn't open the payment page", description: (e as Error).message, variant: "destructive" });
      setOpening(false);
    }
  };

  const inv = invoice.data;
  const due = inv ? new Date(`${inv.due}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";

  return (
    <div className="overflow-x-hidden px-4 pb-16 md:px-10">
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5 pt-6">
        <section className={cn(card, "gap-4")}>
          {invoice.isLoading ? <p className={meta}>Loading the invoice…</p> : null}
          {!invoice.isLoading && !inv ? (
            <>
              <b className="text-[18px] font-medium">Invoice not found</b>
              <p className="text-[14px] text-[#767980]">Sign in with the account the invoice was sent to.</p>
            </>
          ) : null}
          {inv ? (
            <>
              <div className="flex items-center gap-3">
                {inv.status === "paid" ? (
                  <CheckCircle2 className="size-8 text-[#1E7431]" strokeWidth={1.5} aria-hidden="true" />
                ) : (
                  <FileText className="size-8 text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
                )}
                <div className="flex flex-col gap-1">
                  <h1 className="text-[22px] font-semibold leading-[28px] tracking-[-0.05em]">
                    {inv.status === "paid" ? "Paid, thank you" : `Invoice from ${inv.coach}`}
                  </h1>
                  <span className={meta}>{inv.status === "paid" ? `${inv.coach} has been paid.` : `Due ${due}`}</span>
                </div>
              </div>
              <dl className="flex flex-col gap-2 border-y border-[#EAEADF] py-3 text-[14px]">
                <div className="flex justify-between gap-3"><dt className="text-[#767980]">For</dt><dd>{inv.service}</dd></div>
                {inv.athlete ? <div className="flex justify-between gap-3"><dt className="text-[#767980]">Athlete</dt><dd>{inv.athlete}</dd></div> : null}
                <div className="flex justify-between gap-3"><dt className="text-[#767980]">Amount</dt><dd className="font-semibold tabular-nums">{money(inv.amount)}</dd></div>
              </dl>
              {inv.note ? <p className="text-[14px] leading-[20px] text-[#484D56]">{inv.note}</p> : null}
              {inv.status === "open" ? (
                <>
                  {returned ? <p className={meta}>Checking your payment…</p> : null}
                  <button type="button" className={cn(primaryButton, "self-start")} disabled={opening} onClick={pay}>
                    {opening ? "Opening…" : `Pay ${money(inv.amount)} by card`}
                  </button>
                  <p className={meta}>
                    Card payments open Stripe's secure page; a small card processing fee is added. Paid {inv.coach} another way? Let them know
                    and they'll mark it as paid.
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
