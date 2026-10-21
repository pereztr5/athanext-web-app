import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-shell/AppSidebar";
import { AppTopBar } from "@/components/app-shell/AppTopBar";
import { MainTabBar } from "@/components/app-shell/MainTabBar";
import { ATHLETE_NAV, COACH_TABS } from "@/components/app-shell/nav";
import { CoachBillingGate } from "@/components/billing/CoachBillingGate";
import { AccountDeletionBanner } from "@/components/settings/AccountDeletionBanner";
import { useOverdueInvoices } from "@/hooks/useOverdueInvoices";
import { ROUTES } from "@/routes";
import { useRole } from "@/hooks/useRole";

export const AppLayout = () => {
  const { isCoach } = useRole();
  const overdue = useOverdueInvoices();
  return (
    <SidebarProvider className="bg-light">
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-x-clip bg-light">
        <AppTopBar />
        <main className="min-w-0 flex-1 overflow-x-clip pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
          <AccountDeletionBanner className="mx-auto w-full max-w-wrapper px-4 pt-3 md:px-5" />
          <CoachBillingGate>
            <Outlet />
          </CoachBillingGate>
        </main>
        <MainTabBar items={isCoach ? COACH_TABS : ATHLETE_NAV} badges={isCoach && overdue ? { [ROUTES.BUSINESS]: overdue } : undefined} />
      </SidebarInset>
    </SidebarProvider>
  );
};
