import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-shell/AppSidebar";
import { AppTopBar } from "@/components/app-shell/AppTopBar";
import { MainTabBar } from "@/components/app-shell/MainTabBar";
import { ATHLETE_NAV, COACH_NAV } from "@/components/app-shell/nav";
import { useRole } from "@/hooks/useRole";

export const AppLayout = () => {
  const { isCoach } = useRole();
  return (
    <SidebarProvider className="bg-[#F1F1E6]">
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-x-hidden bg-[#F1F1E6]">
        <AppTopBar />
        <main className="min-w-0 flex-1 overflow-x-hidden pb-16 md:pb-0">
          <Outlet />
        </main>
        <MainTabBar items={isCoach ? COACH_NAV : ATHLETE_NAV} />
      </SidebarInset>
    </SidebarProvider>
  );
};
