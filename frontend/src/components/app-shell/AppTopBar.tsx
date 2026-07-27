import { useNavigate } from "react-router-dom";
import { Bell, ClipboardList, Trophy, Users, type LucideIcon } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { UserMenu } from "@/components/common/UserMenu";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { ROUTES } from "@/routes";
import type { Role } from "@/utils/role";

const ROLE_META: Record<Role, { label: string; icon: LucideIcon }> = {
  athlete: { label: "Athlete", icon: Trophy },
  parent: { label: "Parent", icon: Users },
  coach: { label: "Coach", icon: ClipboardList },
};

export const AppTopBar = () => {
  const navigate = useNavigate();
  const { role } = useRole();
  const { hasNewMessage, profileReady } = useAuth();
  const meta = role ? ROLE_META[role] : null;

  return (
    <header
      className="sticky z-40 flex h-16 items-center gap-3 border-b border-sidebar-border bg-app-background px-4 md:px-6"
      style={{ top: "var(--network-banner-height, 0px)" }}
    >
      <SidebarTrigger className="md:hidden" />
      <div className="ml-auto flex items-center gap-3">
        {meta && (
          <span className="flex items-center gap-1.5 rounded-full bg-app-pill px-3 py-1 text-sm font-medium text-app-pill-foreground">
            <meta.icon className="h-3.5 w-3.5" />
            {meta.label}
          </span>
        )}
        <button
          type="button"
          aria-label="Messages"
          onClick={() => navigate(ROUTES.CHAT)}
          className="relative rounded-full p-2 hover:bg-sidebar-accent"
        >
          <Bell className="h-5 w-5 text-sidebar-foreground" />
          {hasNewMessage && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-sidebar-primary" />
          )}
        </button>
        <UserMenu useFallbackDelay avatarReady={profileReady} />
      </div>
    </header>
  );
};
