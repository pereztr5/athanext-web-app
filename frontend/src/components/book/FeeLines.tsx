/** Checkout fee lines from the shared fee math: "Platform fee" and "Card processing", never merged. */
import { money } from "@/utils/booking";
import { feeAmountText } from "@/utils/feeDisplay";
import { feeRows, toCents } from "@/utils/fees";

export const FeeLines = ({
  platformFees,
  processingFees,
  ready = true,
  error,
}: {
  /** Dollars. */
  platformFees: number;
  processingFees: number;
  ready?: boolean;
  error?: boolean;
}) =>
  ready ? (
    <>
      {feeRows({ platformCents: toCents(platformFees), processingCents: toCents(processingFees) }).map((row) => (
        <div key={row.label} className="flex justify-between gap-3">
          <span className="text-dark-300">{row.label}</span>
          <span className="tabular-nums">{money(row.cents / 100)}</span>
        </div>
      ))}
    </>
  ) : (
    <div className="flex justify-between gap-3">
      <span className="text-dark-300">Fees</span>
      <span className="tabular-nums">{feeAmountText(false, error, "")}</span>
    </div>
  );
