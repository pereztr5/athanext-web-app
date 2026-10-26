/**
 * Opens Stripe Connect onboarding (same path as Settings → Payouts).
 * Used from the profile completeness step and from PayoutsCard.
 */
import { useCallback, useState } from "react";
import { payoutsAPI } from "@/api/payouts";
import { useToast } from "@/hooks/use-toast";

export const useOpenStripePayout = () => {
  const { toast } = useToast();
  const [opening, setOpening] = useState(false);

  const openOnboard = useCallback(async () => {
    setOpening(true);
    try {
      const url = await payoutsAPI.onboardUrl();
      if (!url) throw new Error("Stripe did not return a setup link");
      window.location.assign(url);
    } catch (e) {
      toast({ title: "Couldn't open Stripe", description: (e as Error).message, variant: "destructive" });
      setOpening(false);
    }
  }, [toast]);

  const openDashboard = useCallback(async () => {
    setOpening(true);
    try {
      const url = await payoutsAPI.dashboardUrl();
      if (!url) throw new Error("Stripe did not return a dashboard link");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast({ title: "Couldn't open Stripe", description: (e as Error).message, variant: "destructive" });
    } finally {
      setOpening(false);
    }
  }, [toast]);

  return { opening, openOnboard, openDashboard };
};
