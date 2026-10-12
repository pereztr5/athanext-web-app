/**
 * Account Settings → Plan (ATH-102 / ATH-103, Working Copy 4).
 * $29/month coach plan: trial countdown from coaches.created_at clock, Subscribe, Manage billing.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { coachBillingAPI } from "@/api/coachBilling";
import { meta, primaryButton, secondaryButton } from "@/components/schedule/styles";
import { Card, sub } from "@/components/settings/CoachSettings";
import { useCoachBillingAccess } from "@/hooks/useCoachBillingAccess";
import { useToast } from "@/hooks/use-toast";

const formatEnd = (iso: string | null) => {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

export const CoachPlanCard = () => {
  const billing = useCoachBillingAccess();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [opening, setOpening] = useState(false);

  // Return from Stripe Checkout.
  useEffect(() => {
    const flag = searchParams.get("billing");
    if (!flag) return;
    if (flag === "success") {
      toast({ title: "You're on the coach plan", description: "Stripe may take a moment to confirm. Refresh if tools still look locked." });
      void billing.refresh();
      void qc.invalidateQueries({ queryKey: ["coach-details"] });
    }
    if (flag === "cancel") toast({ title: "Checkout cancelled" });
    const next = new URLSearchParams(searchParams);
    next.delete("billing");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, toast, billing, qc]);

  const go = async (get: () => Promise<string>) => {
    setOpening(true);
    try {
      window.location.assign(await get());
    } catch (e) {
      toast({ title: "Couldn't open Stripe", description: (e as Error).message, variant: "destructive" });
      setOpening(false);
    }
  };

  const endLabel = formatEnd(billing.trialEndsAt);
  const price = billing.priceMonthly;

  return (
    <Card icon={<CreditCard className="size-5 text-[#767980]" strokeWidth={1.5} />} title="Coach plan">
      {!billing.ready ? <p className={meta}>Loading…</p> : null}

      {billing.ready && billing.subscribed ? (
        <>
          <p className={sub}>
            You&apos;re on the AthaNext coach plan at <b className="font-medium text-[#1A202C]">${price}/month</b>.
            {billing.subscriptionStatus ? (
              <span className="text-[#767980]"> Status: {billing.subscriptionStatus}.</span>
            ) : null}
          </p>
          <button
            type="button"
            className={`${secondaryButton} self-start`}
            disabled={opening}
            onClick={() => void go(coachBillingAPI.portalUrl)}
          >
            {opening ? "Opening…" : "Manage billing"}
          </button>
        </>
      ) : null}

      {billing.ready && billing.trialActive ? (
        <>
          <p className={sub}>
            Full coach tools are free for 30 days from when your coach account was created.
            {billing.daysLeft === 1
              ? " 1 day left"
              : ` ${billing.daysLeft} days left`}
            {endLabel ? ` (ends ${endLabel})` : ""}. Then it&apos;s ${price}/month.
          </p>
          <p className={meta}>
            Families can keep seeing your public profile and booking you after the free period. Coach tools lock until you subscribe.
          </p>
          <button
            type="button"
            className={`${primaryButton} self-start`}
            disabled={opening}
            onClick={() => void go(coachBillingAPI.checkoutUrl)}
          >
            {opening ? "Opening Stripe…" : `Subscribe · $${price}/mo`}
          </button>
        </>
      ) : null}

      {billing.ready && billing.locked ? (
        <>
          <p className={sub}>
            Your free plan ended{endLabel ? ` on ${endLabel}` : ""}. Subscribe for ${price}/month to use schedule, athletes,
            business tools and your profile editor again.
          </p>
          <p className={meta}>Your public profile and family booking stay up.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={primaryButton}
              disabled={opening}
              onClick={() => void go(coachBillingAPI.checkoutUrl)}
            >
              {opening ? "Opening Stripe…" : `Subscribe · $${price}/mo`}
            </button>
            <button
              type="button"
              className={secondaryButton}
              disabled={opening}
              onClick={() => void go(coachBillingAPI.portalUrl)}
            >
              Manage billing
            </button>
          </div>
        </>
      ) : null}
    </Card>
  );
};
