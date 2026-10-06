import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-shell/AppSidebar";
import { AppTopBar } from "@/components/app-shell/AppTopBar";
import { CoachTabBar } from "@/components/app-shell/CoachTabBar";
import { useRole } from "@/hooks/useRole";
import { cn } from "@/lib/utils";

export const AppLayout = () => {
  const { isCoach } = useRole();
  return (
    <SidebarProvider className="bg-[#F1F1E6]">
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-x-hidden bg-[#F1F1E6]">
        <AppTopBar />
        <main className={cn("min-w-0 flex-1 overflow-x-hidden", isCoach && "pb-16 md:pb-0")}>
          <Outlet />
        </main>
        {isCoach ? <CoachTabBar /> : null}
      </SidebarInset>
    </SidebarProvider>
  );
};
