/** Offline pay for invited clients (WC4): Cash, Zelle, Venmo with optional handles and a note. */

export type OfflineMethodKey = "cash" | "zelle" | "venmo";

export type OfflineMethod = { on: boolean; handle: string };

export type OfflinePay = {
  on: boolean;
  note: string;
  methods: Record<OfflineMethodKey, OfflineMethod>;
};

export const OFFLINE_METHODS: {
  key: OfflineMethodKey;
  label: string;
  needsHandle: boolean;
  placeholder: string;
}[] = [
  { key: "cash", label: "Cash", needsHandle: false, placeholder: "" },
  { key: "zelle", label: "Zelle", needsHandle: true, placeholder: "Email or phone number" },
  { key: "venmo", label: "Venmo", needsHandle: true, placeholder: "@username" },
];

export const defaultOfflinePay = (): OfflinePay => ({
  on: false,
  note: "",
  methods: {
    cash: { on: true, handle: "" },
    zelle: { on: false, handle: "" },
    venmo: { on: false, handle: "" },
  },
});

/** Parse a coaches.offline_pay jsonb value (or null) into a safe OfflinePay. */
export const parseOfflinePay = (raw: unknown): OfflinePay => {
  const base = defaultOfflinePay();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const methods = { ...base.methods };
  const src = (o.methods ?? o.m) as Record<string, unknown> | undefined;
  for (const { key } of OFFLINE_METHODS) {
    const m = src?.[key];
    if (m && typeof m === "object") {
      const row = m as Record<string, unknown>;
      methods[key] = {
        on: Boolean(row.on),
        handle: typeof row.handle === "string" ? row.handle : "",
      };
    }
  }
  return {
    on: Boolean(o.on),
    note: typeof o.note === "string" ? o.note.slice(0, 200) : "",
    methods,
  };
};

/** Methods the coach turned on that have a handle when one is required. */
export const activeOfflineMethods = (pay: OfflinePay) =>
  OFFLINE_METHODS.filter(({ key, needsHandle }) => {
    const m = pay.methods[key];
    return m.on && (!needsHandle || m.handle.trim().length > 0);
  }).map(({ key, label, needsHandle }) => ({
    key,
    label,
    handle: needsHandle ? pay.methods[key].handle.trim() : "At the session",
  }));

export const offlinePayReady = (pay: OfflinePay) => pay.on && activeOfflineMethods(pay).length > 0;

export const offlineMethodsLabel = (pay: OfflinePay) => {
  const names = activeOfflineMethods(pay).map((m) => m.label);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} or ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
};

export const STRIPE_CONNECT_AGREEMENT = "https://stripe.com/legal/connect-account";
export const COACH_TERMS_URL = "https://athanext.com/coach-terms";
