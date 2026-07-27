import { Link, useLocation } from "react-router-dom";
import { Calendar, LayoutGrid, MessageCircle, Search, User } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { ROUTES } from "@/routes";
import { AthaNextLogo } from "@/assets";

// Development nav item deferred (owner decision 2026-07-22).
const ATHLETE_NAV = [
  { title: "Dashboard", url: ROUTES.DASHBOARD, icon: LayoutGrid },
  { title: "Sessions", url: ROUTES.MY_SESSIONS, icon: Calendar },
  { title: "Browse coaches", url: ROUTES.COACHES, icon: Search },
  { title: "Messages", url: ROUTES.CHAT, icon: MessageCircle },
];

const COACH_NAV = [
  { title: "Dashboard", url: ROUTES.DASHBOARD, icon: LayoutGrid },
  { title: "Sessions", url: ROUTES.MY_SESSIONS, icon: Calendar },
  { title: "Messages", url: ROUTES.CHAT, icon: MessageCircle },
  { title: "My Profile", url: ROUTES.PROFILE, icon: User },
];

export const AppSidebar = () => {
  const location = useLocation();
  const { isCoach } = useRole();
  const { hasNewMessage } = useAuth();
  const { setOpenMobile } = useSidebar();
  const items = isCoach ? COACH_NAV : ATHLETE_NAV;

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-5">
        <Link to={ROUTES.DASHBOARD} aria-label="AthaNext home">
          <img src={AthaNextLogo} alt="AthaNext" className="h-8 w-auto" />
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-3">
        <SidebarMenu className="gap-1.5">
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton
                asChild
                isActive={location.pathname === item.url}
                className="h-11 rounded-lg px-3 text-sm data-[active=true]:bg-white data-[active=true]:border data-[active=true]:border-sidebar-border data-[active=true]:shadow-sm data-[active=true]:font-medium data-[active=true]:text-sidebar-primary"
              >
                <Link to={item.url} onClick={() => setOpenMobile(false)}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                  {item.url === ROUTES.CHAT && hasNewMessage && (
                    <span className="ml-1 h-2 w-2 rounded-full bg-sidebar-primary" aria-label="New messages" />
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
};
