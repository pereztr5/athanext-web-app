// The one definition of AthaNext fees. Every charge (edge functions) and every price a family
// sees (frontend) comes from these functions, so what is shown is what is charged, to the cent.
//
// This file is the source of truth. frontend/src/utils/fees.ts is a byte-identical copy: edit
// this one, then copy it over (a frontend test fails while the two differ). No imports, so the
// same code runs in Deno and in Vite.
//
// Per kind, in integer cents:
//   session, package  platform = list × platform %, waived for a coach's own clients
//                     processing = grossed up on the total so AthaNext nets what Stripe takes:
//                     total = round((list + platform + fixed) / (1 − processing %))
//   invoice           no platform fee; processing grossed up as above
//   org_package       platform = list × platform %, processing absorbed (shown as one line)
// The fixed processing amount is charged once per Checkout, however many lines it has.

export type FeeKind = "session" | "package" | "org_package" | "invoice";

export interface FeeConfig {
  /** Marketplace fee, percent of the list price (configurations.platform_fees). */
  platformPercent: number;
  /** Card processing, percent of the charged total (configurations.stripe_fees). */
  processingPercent: number;
  /** Card processing charged once per Checkout, in cents (configurations.stripe_fee_fixed, in dollars). */
  processingFixedCents: number;
}

/** Rows of public.configurations that make up FeeConfig. */
export const FEE_CONFIG_KEYS = ["platform_fees", "stripe_fees", "stripe_fee_fixed"];

export const FEE_LABELS = {
  platform: "Platform fee",
  processing: "Card processing",
} as const;

export interface FeeItem {
  listCents: number;
  kind: FeeKind;
  /** Existing client of the coach (confirmed referral): no platform fee. Ignored for org packages. */
  platformWaived?: boolean;
}

export interface FeeLine {
  listCents: number;
  platformCents: number;
  processingCents: number;
  totalCents: number;
}

export interface FeeBreakdown extends FeeLine {
  /** One per item, in the same order; they add up to the totals. */
  lines: FeeLine[];
}

export const toCents = (dollars: number): number => Math.round((Number(dollars) || 0) * 100);

/** Percent as an integer number of 1/1000ths, so the math below stays in integers. */
const milliPercent = (percent: number) => Math.round(percent * 1000);
const PER_100_PERCENT = 100000;

const assertConfig = (config: FeeConfig) => {
  const { platformPercent, processingPercent, processingFixedCents } = config;
  const ok = [platformPercent, processingPercent, processingFixedCents].every((v) => Number.isFinite(v) && v >= 0);
  if (!ok || processingPercent >= 100) throw new Error("Fee configuration is invalid");
};

/** The fees for one Checkout. Items at or below $0 are never charged and carry no fees. */
export const checkoutFees = (items: FeeItem[], config: FeeConfig): FeeBreakdown => {
  assertConfig(config);
  const platformRate = milliPercent(config.platformPercent);
  const lines: FeeLine[] = items.map((item) => {
    const listCents = Math.max(0, Math.round(item.listCents));
    const noPlatform = listCents === 0 || item.kind === "invoice" || (item.platformWaived && item.kind !== "org_package");
    const platformCents = noPlatform ? 0 : Math.round((listCents * platformRate) / PER_100_PERCENT);
    return { listCents, platformCents, processingCents: 0, totalCents: listCents + platformCents };
  });

  // Processing is grossed up once on everything in the Checkout that carries it, then spread over
  // the lines in proportion (running rounding, so the lines add up exactly).
  const carries = items.map((item, i) => item.kind !== "org_package" && lines[i].listCents > 0);
  const base = lines.reduce((sum, line, i) => (carries[i] ? sum + line.totalCents : sum), 0);
  if (base > 0) {
    const gross = Math.round(
      ((base + Math.round(config.processingFixedCents)) * PER_100_PERCENT) /
        (PER_100_PERCENT - milliPercent(config.processingPercent)),
    );
    const processing = gross - base;
    let running = 0;
    let given = 0;
    lines.forEach((line, i) => {
      if (!carries[i]) return;
      running += line.totalCents;
      const upTo = Math.round((processing * running) / base);
      line.processingCents = upTo - given;
      line.totalCents += line.processingCents;
      given = upTo;
    });
  }

  const sum = (pick: (line: FeeLine) => number) => lines.reduce((n, line) => n + pick(line), 0);
  return {
    lines,
    listCents: sum((l) => l.listCents),
    platformCents: sum((l) => l.platformCents),
    processingCents: sum((l) => l.processingCents),
    totalCents: sum((l) => l.totalCents),
  };
};

/** Fees when one item is the whole Checkout (a single session, package or invoice). */
export const feeLine = (listCents: number, kind: FeeKind, config: FeeConfig, platformWaived = false): FeeLine => {
  const fees = checkoutFees([{ listCents, kind, platformWaived }], config);
  return {
    listCents: fees.listCents,
    platformCents: fees.platformCents,
    processingCents: fees.processingCents,
    totalCents: fees.totalCents,
  };
};

/** The fee lines to show, with their labels. Zero lines are left out. */
export const feeRows = (fees: Pick<FeeLine, "platformCents" | "processingCents">) =>
  [
    { label: FEE_LABELS.platform, cents: fees.platformCents },
    { label: FEE_LABELS.processing, cents: fees.processingCents },
  ].filter((row) => row.cents > 0);

const parseNumber = (value: unknown): number | null => {
  const num = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(num) && num >= 0 ? num : null;
};

/** FeeConfig from configurations rows. Throws when a value is missing, so nothing is charged or shown at 0 by mistake. */
export const parseFeeConfig = (rows: { key: string; value: unknown }[] | null | undefined): FeeConfig => {
  const byKey = new Map((rows ?? []).map((row) => [row.key, parseNumber(row.value)]));
  const missing = FEE_CONFIG_KEYS.filter((key) => byKey.get(key) == null);
  if (missing.length) throw new Error(`Fee configuration is missing ${missing.join(", ")}`);
  const config = {
    platformPercent: byKey.get("platform_fees")!,
    processingPercent: byKey.get("stripe_fees")!,
    processingFixedCents: toCents(byKey.get("stripe_fee_fixed")!),
  };
  assertConfig(config);
  return config;
};

/** The rates a Checkout was created with, kept in its metadata so later steps charge the same. */
export const feeConfigMetadata = (config: FeeConfig): Record<string, string> => ({
  platform_fee_perc: String(config.platformPercent),
  stripe_fee_perc: String(config.processingPercent),
  stripe_fee_fixed: String(config.processingFixedCents / 100),
});

/** FeeConfig from feeConfigMetadata, or null when the metadata doesn't carry all of it. */
export const feeConfigFromMetadata = (metadata: Record<string, unknown> | null | undefined): FeeConfig | null => {
  const platform = parseNumber(metadata?.platform_fee_perc);
  const processing = parseNumber(metadata?.stripe_fee_perc);
  const fixed = parseNumber(metadata?.stripe_fee_fixed);
  if (platform == null || processing == null || fixed == null || processing >= 100) return null;
  return { platformPercent: platform, processingPercent: processing, processingFixedCents: toCents(fixed) };
};
