/**
 * Payouts (Stripe Connect Express): set up, finish setup, weekly payout day and the Stripe
 * dashboard. Session shares are held until the session sticks, then sent to the coach.
 */
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Landmark } from "@/components/icons";
import { payoutsAPI, type PayoutDay } from "@/api/payouts";
import { LegalAnchor } from "@/components/legal/LegalLinks";
import { meta, primaryButton, secondaryButton } from "@/components/schedule/styles";
import { useOpenStripePayout } from "@/hooks/useOpenStripePayout";
import { useToast } from "@/hooks/use-toast";
import { Card, sub } from "@/components/settings/CoachSettings";

const DAYS: [PayoutDay, string][] = [
  ["monday", "Monday"],
  ["tuesday", "Tuesday"],
  ["wednesday", "Wednesday"],
  ["thursday", "Thursday"],
  ["friday", "Friday"],
];

export const PayoutsCard = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { opening, openOnboard, openDashboard } = useOpenStripePayout();
  const status = useQuery({ queryKey: ["payout-account"], queryFn: () => payoutsAPI.status(), retry: false });
  const day = useMutation({
    mutationFn: (d: PayoutDay) => payoutsAPI.setDay(d),
    onSuccess: (account) => {
      qc.setQueryData(["payout-account"], account);
      toast({ title: "Payout day updated" });
    },
    onError: (e: Error) => toast({ title: "Couldn't change the payout day", description: e.message, variant: "destructive" }),
  });

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
            session (or a late cancel), and Stripe pays out every week.
          </p>
          <label className="flex flex-wrap items-center gap-3">
            <span className="text-label-sm">Payout day</span>
            <select
              className="h-control rounded-control border border-dark-250 bg-light px-3 text-body-m text-dark focus:border-primary focus:outline focus:outline-2 focus:-outline-offset-1 focus:outline-primary disabled:border-light-525 disabled:bg-light-400 disabled:text-dark-200"
              value={a.payoutDay}
              disabled={day.isPending}
              onChange={(e) => day.mutate(e.target.value as PayoutDay)}
            >
              {DAYS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
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
