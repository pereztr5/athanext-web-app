/**
 * Family Home: invoices coaches sent, open ones first, so an invoice is easy to find again
 * after the chat message and email. Hidden when there are none.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FileText } from "@/components/icons";
import { invoicesAPI } from "@/api/invoices";
import { BrandPill } from "@/components/brand";
import { card, label, meta } from "@/components/schedule/styles";
import { money } from "@/utils/payments";

const dueLabel = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export const MyInvoicesCard = () => {
  const invoices = useQuery({ queryKey: ["my-invoices"], staleTime: 60_000, queryFn: () => invoicesAPI.myInvoices() });
  const list = (invoices.data ?? []).filter((i) => i.status !== "void").slice(0, 5);
  if (!list.length) return null;
  const open = list.filter((i) => i.status === "open").length;
  return (
    <section className={card} aria-label="Invoices">
      <div className="flex items-center justify-between gap-3">
        <span className={label}>Invoices</span>
        {open ? <span className={meta}>{open} to pay</span> : null}
      </div>
      <ul className="flex flex-col">
        {list.map((inv) => (
          <li key={inv.id} className="border-t border-light-525 first:border-t-0">
            <Link to={`/invoices/${inv.id}`} className="flex items-center gap-3 py-3 hover:text-primary">
              <FileText className="size-5 flex-none text-dark-300" strokeWidth={1.5} aria-hidden="true" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <b className="break-words text-label-sm">
                  {inv.service} · {money(inv.amount)}
                </b>
                <span className={meta}>
                  From {inv.coach}
                  {inv.status === "open" ? ` · due ${dueLabel(inv.due)}` : ""}
                </span>
              </span>
              <BrandPill tone={inv.status === "open" ? "amber" : "green"} className="flex-none">
                {inv.status === "open" ? "To pay" : "Paid"}
              </BrandPill>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};
