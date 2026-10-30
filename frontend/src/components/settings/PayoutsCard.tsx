/**
 * Payouts (Stripe Connect Express): set up, finish setup and the Stripe dashboard. Session
 * shares are held until the session sticks, then sent to the coach; Stripe pays out daily.
 */
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Landmark } from "@/components/icons";
import { payoutsAPI } from "@/api/payouts";
import { LegalAnchor } from "@/components/legal/LegalLinks";
import { meta, primaryButton, secondaryButton } from "@/components/schedule/styles";
import { useOpenStripePayout } from "@/hooks/useOpenStripePayout";
import { useToast } from "@/hooks/use-toast";
import { Card, sub } from "@/components/settings/CoachSettings";

export const PayoutsCard = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { opening, openOnboard, openDashboard } = useOpenStripePayout();
  const status = useQuery({ queryKey: ["payout-account"], queryFn: () => payoutsAPI.status(), retry: false });

  // Return / refresh from Stripe Connect onboarding.
  useEffect(() => {
    const flag = searchParams.get("payouts");
    if (!flag) return;
    const next = new URLSearchParams(searchParams);
    next.delete("payouts");
    setSearchParams(next, { replace: true });
    if (flag === "done") {
      toast({ title: "Payout setup updated", description: "Stripe may take a moment to confirm." });
      void qc.invalidateQueries({ queryKey: ["payout-account"] });
      return;
    }
    if (flag === "refresh" || flag === "start") {
      void openOnboard();
    }
  }, [searchParams, setSearchParams, toast, qc, openOnboard]);

  const a = status.data;
  const ready = a?.connected && a.transfersActive && a.payoutsEnabled;
  // Status failed or still loading with no account: still offer setup (plan: do not hide the button).
  const showSetup = status.isError || (!status.isLoading && (!a || !a.connected));
  const showFinish = Boolean(a?.connected && !ready);

  return (
    <Card icon={<Landmark className="size-5 text-dark-300" strokeWidth={1.5} />} title="Payouts">
      {status.isLoading ? <p className={meta}>Loading…</p> : null}
      {status.isError ? <p className="text-body-m text-error-700">{(status.error as Error).message}</p> : null}
      {showSetup ? (
        <>
          <p className={sub}>
            Set up payouts with Stripe to get paid for sessions families pay for in AthaNext. It takes a few minutes and Stripe asks for your
            bank details on its own page.
          </p>
          <button type="button" className={`${primaryButton} self-start`} disabled={opening} onClick={() => void openOnboard()}>
            {opening ? "Opening Stripe…" : "Set up payouts"}
          </button>
        </>
      ) : null}
      {showFinish ? (
        <>
          <p className={sub}>
            {a!.detailsSubmitted
              ? "Stripe is checking your details. Payments for paid sessions wait here and go out once it's done."
              : "Finish setting up with Stripe. Payments for paid sessions wait here until you do."}
          </p>
          <button type="button" className={`${primaryButton} self-start`} disabled={opening} onClick={() => void openOnboard()}>
            {opening ? "Opening Stripe…" : a!.detailsSubmitted ? "Update details" : "Finish setting up"}
          </button>
        </>
      ) : null}
      {a && ready ? (
        <>
          <p className={sub}>
            Payouts are on{a.bankLast4 ? ` to the account ending ${a.bankLast4}` : ""}. Your share for each paid session is sent after the
            session (or a late cancel), and Stripe deposits it to your bank about 2 business days later.
          </p>
          <button type="button" className={`${secondaryButton} self-start`} disabled={opening} onClick={() => void openDashboard()}>
            <ExternalLink strokeWidth={1.5} aria-hidden="true" />
            Open Stripe dashboard
          </button>
        </>
      ) : null}
      <p className={meta}>AthaNext never sees or stores your bank details.</p>
      <p className={meta}>
        Payouts are handled by Stripe. By setting up payouts you agree to the{" "}
        <LegalAnchor kind="stripe" /> and the <LegalAnchor kind="coach" />.
      </p>
    </Card>
  );
};
