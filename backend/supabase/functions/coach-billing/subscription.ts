// Invoice -> subscription id. API 2025-08-27.basil removed invoice.subscription; the id now
// lives on invoice.parent.subscription_details.subscription. Older payloads still use the
// top-level field, so both are read.
type Ref = string | { id?: string | null } | null | undefined;

export type InvoiceLike = {
  subscription?: Ref;
  parent?: { subscription_details?: { subscription?: Ref } | null } | null;
};

const idOf = (ref: Ref): string | null => {
  if (!ref) return null;
  if (typeof ref === "string") return ref || null;
  return ref.id ?? null;
};

export const subscriptionIdFromInvoice = (invoice: InvoiceLike | null | undefined): string | null =>
  idOf(invoice?.parent?.subscription_details?.subscription) ?? idOf(invoice?.subscription);
