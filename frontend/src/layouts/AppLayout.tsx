import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-shell/AppSidebar";
import { AppTopBar } from "@/components/app-shell/AppTopBar";

export const AppLayout = () => {
  return (
    <SidebarProvider className="bg-[#F1F1E6]">
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-x-hidden bg-[#F1F1E6]">
        <AppTopBar />
        <main className="min-w-0 flex-1 overflow-x-hidden">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};
