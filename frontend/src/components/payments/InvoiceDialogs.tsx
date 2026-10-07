/**
 * Payments dialogs (ATH-89): create an invoice for a family the coach brought to AthaNext, and
 * mark an invoice paid outside AthaNext (cash or transfer).
 */
import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invoicesAPI } from "@/api/invoices";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dialogContent, input, label, meta, primaryButton, secondaryButton } from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { addDaysISO } from "@/utils/schedule";
import { money, type Client, type Invoice } from "@/utils/payments";

const SERVICES = ["Individual session", "Group session", "Session package", "Other"];

const Shell = ({ open, onClose, title, sub, children, foot }: { open: boolean; onClose: () => void; title: string; sub?: string; children: ReactNode; foot: ReactNode }) => (
  <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className={dialogContent}>
      <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
        <DialogTitle className="text-[22px] font-semibold leading-[28px] tracking-[-0.05em]">{title}</DialogTitle>
        <DialogDescription className={sub ? meta : "sr-only"}>{sub ?? title}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4 px-5 pb-5 sm:px-[25px] sm:pb-[25px]">
        {children}
        <div className="flex flex-wrap justify-end gap-2">{foot}</div>
      </div>
    </DialogContent>
  </Dialog>
);

const Field = ({ text, error, children }: { text: string; error?: string; children: ReactNode }) => (
  <label className="flex flex-col gap-1.5">
    <span className={label}>{text}</span>
    {children}
    {error ? <span className="text-[12px] text-[#972B2B]">{error}</span> : null}
  </label>
);

export const CreateInvoiceDialog = ({ open, clients, today, onClose }: { open: boolean; clients: Client[]; today: string; onClose: () => void }) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const blank = () => ({ athleteId: "", service: SERVICES[0], amount: "90", due: addDaysISO(today, 7), note: "" });
  const [form, setForm] = useState(blank);
  const [tried, setTried] = useState(false);
  const set = (patch: Partial<ReturnType<typeof blank>>) => setForm((f) => ({ ...f, ...patch }));
  const errors = {
    athleteId: form.athleteId ? "" : "Choose an athlete",
    service: form.service.trim() ? "" : "Say what it's for",
    amount: Number(form.amount) > 0 ? "" : "Enter an amount",
    due: form.due ? "" : "Pick a due date",
  };
  const close = () => {
    setForm(blank());
    setTried(false);
    onClose();
  };
  const client = clients.find((c) => c.athleteId === form.athleteId);
  const send = useMutation({
    mutationFn: () => invoicesAPI.create({ ...form, amount: Number(form.amount) }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["coach-payments"] });
      const who = client?.family || client?.athlete || "the family";
      toast(res.emailed ? { title: `Invoice sent to ${who}` } : { title: `Invoice saved for ${who}`, description: "The email didn't go out. Use Remind to try again." });
      close();
    },
    onError: (e: Error) => toast({ title: "Couldn't send the invoice", description: e.message, variant: "destructive" }),
  });
  const submit = () => {
    setTried(true);
    if (!Object.values(errors).some(Boolean)) send.mutate();
  };

  return (
    <Shell
      open={open}
      onClose={close}
      title="Create invoice"
      foot={
        <>
          <button type="button" className={secondaryButton} onClick={close}>Cancel</button>
          <button type="button" className={primaryButton} disabled={send.isPending || !clients.length} onClick={submit}>
            {send.isPending ? "Sending…" : "Send invoice"}
          </button>
        </>
      }
    >
      <Field text="Athlete" error={tried ? errors.athleteId : ""}>
        <select className={input} value={form.athleteId} onChange={(e) => set({ athleteId: e.target.value })}>
          <option value="">{clients.length ? "Choose an athlete" : "No families you brought to AthaNext yet"}</option>
          {clients.map((c) => (
            <option key={c.athleteId} value={c.athleteId}>
              {c.athlete}
              {c.family && c.family !== c.athlete ? `, ${c.family}` : ""}
            </option>
          ))}
        </select>
        <span className={meta}>Only families you brought to AthaNext. Marketplace families pay in the app.</span>
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field text="For" error={tried ? errors.service : ""}>
          <input className={input} list="invoice-services" maxLength={120} value={form.service} onChange={(e) => set({ service: e.target.value })} />
          <datalist id="invoice-services">
            {SERVICES.map((s) => <option key={s} value={s} />)}
          </datalist>
        </Field>
        <Field text="Amount" error={tried ? errors.amount : ""}>
          <span className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[#767980]">$</span>
            <input className={cn(input, "pl-6")} type="number" min={1} max={10000} value={form.amount} onChange={(e) => set({ amount: e.target.value })} />
          </span>
        </Field>
      </div>
      <Field text="Due date" error={tried ? errors.due : ""}>
        <input className={input} type="date" min={today} value={form.due} onChange={(e) => set({ due: e.target.value })} />
      </Field>
      <Field text="Note to the family (optional)">
        <textarea className={cn(input, "h-auto py-2")} rows={2} maxLength={500} value={form.note} onChange={(e) => set({ note: e.target.value })} />
      </Field>
      <p className={meta}>The account holder gets the invoice by email and can pay by card, or pay you another way and you mark it as paid.</p>
    </Shell>
  );
};

export const MarkPaidDialog = ({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const mark = useMutation({
    mutationFn: () => invoicesAPI.markPaid(invoice!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coach-payments"] });
      toast({ title: `${invoice!.family}'s invoice marked as paid` });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Couldn't mark it as paid", description: e.message, variant: "destructive" }),
  });
  return (
    <Shell
      open={Boolean(invoice)}
      onClose={onClose}
      title="Mark as paid?"
      foot={
        <>
          <button type="button" className={secondaryButton} onClick={onClose}>Cancel</button>
          <button type="button" className={primaryButton} disabled={mark.isPending} onClick={() => mark.mutate()}>
            {mark.isPending ? "Saving…" : "Mark as paid"}
          </button>
        </>
      }
    >
      <p className="text-[14px] leading-[20px] text-[#484D56]">
        Use this when {invoice?.family} paid you {invoice ? money(invoice.amount) : ""} outside AthaNext, for example in cash or by bank
        transfer.
      </p>
    </Shell>
  );
};
