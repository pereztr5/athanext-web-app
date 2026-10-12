import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-shell/AppSidebar";
import { AppTopBar } from "@/components/app-shell/AppTopBar";
import { MainTabBar } from "@/components/app-shell/MainTabBar";
import { ATHLETE_NAV, COACH_TABS } from "@/components/app-shell/nav";
import { CoachBillingGate } from "@/components/billing/CoachBillingGate";
import { useOverdueInvoices } from "@/hooks/useOverdueInvoices";
import { ROUTES } from "@/routes";
import { useRole } from "@/hooks/useRole";

export const AppLayout = () => {
  const { isCoach } = useRole();
  const overdue = useOverdueInvoices();
  return (
    <SidebarProvider className="bg-[#F1F1E6]">
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-x-clip bg-[#F1F1E6]">
        <AppTopBar />
        <main className="min-w-0 flex-1 overflow-x-clip pb-16 md:pb-0">
          <CoachBillingGate>
            <Outlet />
          </CoachBillingGate>
        </main>
        <MainTabBar items={isCoach ? COACH_TABS : ATHLETE_NAV} badges={isCoach && overdue ? { [ROUTES.BUSINESS]: overdue } : undefined} />
      </SidebarInset>
    </SidebarProvider>
  );
};
