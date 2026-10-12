/**
 * ATH-103: when a coach is past trial and unpaid, block coach tools with a lock screen.
 * Allowed: Home, Account Settings (plan/billing), Help, password, sign out via the shell.
 * Public coach profiles and family booking stay on dual-chrome routes (not gated here).
 */
import { useLocation } from "react-router-dom";
import { CoachPlanLock } from "@/components/billing/CoachPlanLock";
import { useCoachBillingAccess } from "@/hooks/useCoachBillingAccess";
import { ROUTES } from "@/routes";
import type { ReactNode } from "react";

const allowedWhenLocked = (pathname: string) => {
  if (pathname === ROUTES.DASHBOARD || pathname.startsWith(`${ROUTES.DASHBOARD}/`)) return true;
  if (pathname === ROUTES.SETTINGS || pathname.startsWith(`${ROUTES.SETTINGS}/`)) return true;
  if (pathname === ROUTES.HELP || pathname.startsWith(`${ROUTES.HELP}/`)) return true;
  if (pathname === ROUTES.CHANGE_PASSWORD) return true;
  return false;
};

export const CoachBillingGate = ({ children }: { children: ReactNode }) => {
  const { isCoach, ready, locked } = useCoachBillingAccess();
  const { pathname } = useLocation();

  if (!isCoach || !ready || !locked) return <>{children}</>;
  if (allowedWhenLocked(pathname)) return <>{children}</>;
  return <CoachPlanLock />;
};
