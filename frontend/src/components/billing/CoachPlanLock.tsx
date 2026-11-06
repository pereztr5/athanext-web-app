/**
 * ATH-103: hard lock after unpaid trial. Subscribe CTA; settings/billing stay reachable.
 */
import { errorMessage } from "@/utils/errorMessage";
import { Link } from "react-router-dom";
import { Lock } from "@/components/icons";
import { useState } from "react";
import { coachBillingAPI } from "@/api/coachBilling";
import { primaryButton, secondaryButton } from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { ROUTES } from "@/routes";
import { useCoachBillingAccess } from "@/hooks/useCoachBillingAccess";

export const CoachPlanLock = () => {
  const { priceMonthly } = useCoachBillingAccess();
  const { toast } = useToast();
  const [opening, setOpening] = useState(false);

  const subscribe = async () => {
    setOpening(true);
    try {
      const url = await coachBillingAPI.checkoutUrl();
      window.location.assign(url);
    } catch (e) {
      toast({
        title: "Couldn't open checkout",
        description: errorMessage(e),
        variant: "destructive",
      });
      setOpening(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-wrapper-focused flex-col items-center gap-4 px-4 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full border border-error-300 bg-error-50 text-error-600">
        <Lock className="size-6" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-section text-dark">
          Your free plan has ended
        </h1>
        <p className="text-paragraph text-dark-400">
          Subscribe for ${priceMonthly}/month to keep using schedule, athletes, business tools and your profile editor.
          Families can still see your public profile and book you.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" className={primaryButton} disabled={opening} onClick={() => void subscribe()}>
          {opening ? "Opening Stripe…" : `Subscribe · $${priceMonthly}/mo`}
        </button>
        <Link to={`${ROUTES.SETTINGS}?tab=plan`} className={secondaryButton}>
          Plan settings
        </Link>
      </div>
    </div>
  );
};
