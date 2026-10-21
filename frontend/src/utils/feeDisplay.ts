/** Words around the shared fee math (utils/fees.ts). Amounts always come from that module. */
import { FEE_LABELS, type FeeConfig, type FeeLine } from "@/utils/fees";

/** Shown instead of an amount that needs the fee rates while they load, or when they can't be read. */
export const feeAmountText = (ready: boolean, error: boolean | undefined, text: string) =>
  ready ? text : error ? "Price unavailable" : "…";

/** "2.9% + $0.30" */
export const cardRateText = (config: FeeConfig | null) =>
  config ? `${config.processingPercent}% + $${(config.processingFixedCents / 100).toFixed(2)}` : "a small fee";

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * "$60.00 session + $6.00 platform fee + $2.28 card processing", adding up to line.totalCents.
 * An existing client reads "no platform fee (existing client)"; an academy package has no processing part.
 */
export const formatFeeBreakdown = (line: FeeLine, item = "session", platformWaived = false) => {
  const platform = platformWaived ? "no platform fee (existing client)" : `${usd(line.platformCents)} ${FEE_LABELS.platform.toLowerCase()}`;
  const processing = line.processingCents > 0 ? ` + ${usd(line.processingCents)} ${FEE_LABELS.processing.toLowerCase()}` : "";
  return `${usd(line.listCents)} ${item} + ${platform}${processing}`;
};
