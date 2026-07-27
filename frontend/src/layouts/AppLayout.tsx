import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-shell/AppSidebar";
import { AppTopBar } from "@/components/app-shell/AppTopBar";

export const AppLayout = () => {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-app-background">
        <AppTopBar />
        <main className="flex-1">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};
