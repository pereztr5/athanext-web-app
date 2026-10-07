/**
 * Coach Payments (ATH-89). Reads come from get_coach_payments; invoices are created, reminded
 * and paid by card through the coach-invoices function, which emails the family.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Client, InAppPayment, Invoice } from "@/utils/payments";

type Row = Record<string, any>;

const call = async (body: Record<string, unknown>): Promise<Row> => {
  const { data, error } = await supabase.functions.invoke("coach-invoices", { body: { origin: window.location.origin, ...body } });
  if (error) {
    const message = await (error as { context?: Response }).context?.json?.().then((b: Row) => b?.error).catch(() => null);
    throw new Error(message || error.message);
  }
  return (data ?? {}) as Row;
};

export interface FamilyInvoice {
  id: string;
  coach: string;
  athlete: string;
  service: string;
  amount: number;
  due: string;
  note: string | null;
  status: "open" | "paid" | "void";
  paidAt: string | null;
}

export const invoicesAPI = {
  async payments(): Promise<{ invoices: Invoice[]; inApp: InAppPayment[]; clients: Client[] }> {
    const { data, error } = await supabase.rpc("get_coach_payments");
    if (error) throw error;
    const raw = (data ?? {}) as Row;
    return {
      invoices: ((raw.invoices as Row[]) ?? []).map((i) => ({
        id: i.id,
        athleteId: i.athlete_id ?? null,
        family: i.family || "Family",
        athlete: i.athlete || "",
        service: i.service,
        amount: Number(i.amount),
        due: i.due,
        note: i.note ?? null,
        status: i.status,
        paidAt: i.paid_at ?? null,
        paidMethod: i.paid_method ?? null,
        reminders: Number(i.reminders) || 0,
        createdAt: i.created_at,
      })),
      inApp: ((raw.in_app as Row[]) ?? []).map((p) => ({
        bookingId: p.booking_id,
        athlete: p.athlete,
        family: p.family,
        service: p.service,
        date: p.date,
        amount: Number(p.amount) || 0,
        own: Boolean(p.own),
      })),
      clients: ((raw.clients as Row[]) ?? [])
        .map((c) => ({ athleteId: c.athlete_id, athlete: c.athlete || "Athlete", family: c.family || "" }))
        .sort((a, b) => a.athlete.localeCompare(b.athlete)),
    };
  },

  create: (input: { athleteId: string; service: string; amount: number; due: string; note: string }) =>
    call({ action: "create", athlete_id: input.athleteId, service: input.service, amount: input.amount, due: input.due, note: input.note || null }) as Promise<{
      id: string;
      emailed: boolean;
    }>,

  remind: (invoiceId: string) => call({ action: "remind", invoice_id: invoiceId }) as Promise<{ reminders: number; emailed: boolean }>,

  async markPaid(invoiceId: string) {
    const { error } = await supabase.rpc("mark_coach_invoice_paid", { p_invoice_id: invoiceId });
    if (error) throw error;
  },

  async familyInvoice(invoiceId: string): Promise<FamilyInvoice | null> {
    const { data, error } = await supabase.rpc("get_family_invoice", { p_invoice_id: invoiceId });
    if (error) throw error;
    const i = data as Row | null;
    if (!i) return null;
    return {
      id: i.id,
      coach: i.coach,
      athlete: i.athlete,
      service: i.service,
      amount: Number(i.amount),
      due: i.due,
      note: i.note ?? null,
      status: i.status,
      paidAt: i.paid_at ?? null,
    };
  },

  checkoutUrl: async (invoiceId: string) => (await call({ action: "checkout", invoice_id: invoiceId })).url as string,
  verify: async (invoiceId: string) => (await call({ action: "verify", invoice_id: invoiceId })).status as string,
};
