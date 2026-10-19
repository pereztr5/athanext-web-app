/** Checkout fee lines: keep the 10% marketplace line and add Payment processing fee (2.9% + $0.30). */
import { money } from "@/utils/booking";

export const FeeLines = ({
  platformFees,
  processingFees,
}: {
  platformFees: number;
  processingFees: number;
}) => (
  <>
    {platformFees > 0 ? (
      <div className="flex justify-between gap-3">
        <span className="text-dark-300">Platform fee</span>
        <span className="tabular-nums">{money(platformFees)}</span>
      </div>
    ) : null}
    {processingFees > 0 ? (
      <div className="flex justify-between gap-3">
        <span className="text-dark-300">Payment processing fee</span>
        <span className="tabular-nums">{money(processingFees)}</span>
      </div>
    ) : null}
  </>
);
