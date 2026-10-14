/**
 * Payouts (Stripe Connect Express): set up, finish setup, weekly payout day and the Stripe
 * dashboard. Session shares are held until the session sticks, then sent to the coach.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Landmark } from "lucide-react";
import { payoutsAPI, type PayoutDay } from "@/api/payouts";
import { LegalAnchor } from "@/components/legal/LegalLinks";
import { meta, primaryButton, secondaryButton } from "@/components/schedule/styles";
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
  const [opening, setOpening] = useState(false);
  const status = useQuery({ queryKey: ["payout-account"], queryFn: () => payoutsAPI.status(), retry: false });
  const day = useMutation({
    mutationFn: (d: PayoutDay) => payoutsAPI.setDay(d),
    onSuccess: (account) => {
      qc.setQueryData(["payout-account"], account);
      toast({ title: "Payout day updated" });
    },
    onError: (e: Error) => toast({ title: "Couldn't change the payout day", description: e.message, variant: "destructive" }),
  });

  const go = async (get: () => Promise<string>, newTab = false) => {
    setOpening(true);
    try {
      const url = await get();
      if (newTab) window.open(url, "_blank", "noopener,noreferrer");
      else window.location.assign(url);
    } catch (e) {
      toast({ title: "Couldn't open Stripe", description: (e as Error).message, variant: "destructive" });
    } finally {
      setOpening(false);
    }
  };

  const a = status.data;
  const ready = a?.connected && a.transfersActive && a.payoutsEnabled;

  return (
    <Card icon={<Landmark className="size-5 text-[#767980]" strokeWidth={1.5} />} title="Payouts">
      {status.isLoading ? <p className={meta}>Loading…</p> : null}
      {status.isError ? <p className="text-[14px] text-[#972B2B]">{(status.error as Error).message}</p> : null}
      {a && !a.connected ? (
        <>
          <p className={sub}>
            Set up payouts with Stripe to get paid for sessions families pay for in AthaNext. It takes a few minutes and Stripe asks for your
            bank details on its own page.
          </p>
          <button type="button" className={`${primaryButton} self-start`} disabled={opening} onClick={() => go(payoutsAPI.onboardUrl)}>
            {opening ? "Opening Stripe…" : "Set up payouts"}
          </button>
        </>
      ) : null}
      {a?.connected && !ready ? (
        <>
          <p className={sub}>
            {a.detailsSubmitted
              ? "Stripe is checking your details. Payments for paid sessions wait here and go out once it's done."
              : "Finish setting up with Stripe. Payments for paid sessions wait here until you do."}
          </p>
          <button type="button" className={`${primaryButton} self-start`} disabled={opening} onClick={() => go(payoutsAPI.onboardUrl)}>
            {opening ? "Opening Stripe…" : a.detailsSubmitted ? "Update details" : "Finish setting up"}
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
            <span className="text-[14px] font-medium">Payout day</span>
            <select
              className="h-[34px] rounded-[8px] border border-[#EAEADF] bg-[#F9F9F5] px-3 text-[14px]"
              value={a.payoutDay}
              disabled={day.isPending}
              onChange={(e) => day.mutate(e.target.value as PayoutDay)}
            >
              {DAYS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <button type="button" className={`${secondaryButton} self-start`} disabled={opening} onClick={() => go(payoutsAPI.dashboardUrl, true)}>
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
