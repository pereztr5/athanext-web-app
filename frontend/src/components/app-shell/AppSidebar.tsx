import { Link, useLocation } from "react-router-dom";
import {
  BadgeCheck,
  BarChart3,
  Calendar,
  CalendarClock,
  LayoutGrid,
  MessageCircle,
  Search,
  Shield,
  ShoppingBag,
  User,
  UserCheck,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { UserMenu } from "@/components/common/UserMenu";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { ROUTES } from "@/routes";
import { AthaNextLogo } from "@/assets";
import { cn } from "@/lib/utils";

const ATHLETE_NAV = [
  { title: "Dashboard", url: ROUTES.DASHBOARD, icon: LayoutGrid },
  { title: "Sessions", url: ROUTES.MY_SESSIONS, icon: Calendar },
  { title: "My Coaches", url: ROUTES.MY_COACHES, icon: UserCheck },
  { title: "Browse coaches", url: ROUTES.COACHES, icon: Search },
  { title: "Gear", url: ROUTES.GEAR, icon: ShoppingBag },
  { title: "Messages", url: ROUTES.CHAT, icon: MessageCircle },
  { title: "Development", url: "", icon: BadgeCheck },
];

const COACH_NAV = [
  { title: "Dashboard", url: ROUTES.DASHBOARD, icon: LayoutGrid },
  { title: "Sessions", url: ROUTES.MY_SESSIONS, icon: Calendar },
  { title: "Availability", url: ROUTES.AVAILABILITY, icon: CalendarClock },
  { title: "My Clients", url: ROUTES.MY_CLIENTS, icon: Users },
  { title: "Gear", url: ROUTES.GEAR, icon: ShoppingBag },
  { title: "Messages", url: ROUTES.CHAT, icon: MessageCircle },
  { title: "Analytics", url: ROUTES.ANALYTICS, icon: BarChart3 },
  { title: "Profile", url: ROUTES.PROFILE, icon: User },
];

const navItemClass =
  "!h-8 !gap-[5px] !rounded-[5px] !border !border-transparent !px-[10px] !py-0 text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#767980] shadow-none transition-colors hover:!bg-transparent hover:!text-[#1A202C] focus-visible:!ring-2 focus-visible:!ring-[#6698D2] data-[active=true]:!border-[#EAEADF] data-[active=true]:!bg-[#F9F9F5] data-[active=true]:font-medium data-[active=true]:!text-[#0054B4] data-[active=true]:shadow-none data-[active=true]:hover:!bg-[#F9F9F5] data-[active=true]:hover:!text-[#0054B4] [&>svg]:!size-4 [&>svg]:shrink-0";

export const AppSidebar = () => {
  const location = useLocation();
  const { isCoach } = useRole();
  const { isAdmin } = useIsAdmin();
  const { hasNewMessage, userName, userProfile, profileReady } = useAuth();
  const { setOpenMobile } = useSidebar();
  const items = [
    ...(isCoach ? COACH_NAV : ATHLETE_NAV),
    ...(isAdmin
      ? [
          { title: "Accounts", url: ROUTES.ADMIN_ACCOUNTS, icon: Shield },
          { title: "Referrals", url: ROUTES.ADMIN_REFERRALS, icon: Users },
        ]
      : []),
  ];

  const displayName = userName || userProfile?.name || "Account";
  const firstName = displayName.split(" ")[0] || displayName;
  const sportLabel = userProfile?.sport
    ? `${String(userProfile.sport).charAt(0).toUpperCase()}${String(userProfile.sport).slice(1).toLowerCase()} ${
        isCoach ? "coach" : "athlete"
      }`
    : isCoach
      ? "Coach"
      : "Athlete";

  return (
    <Sidebar className="border-0">
      <div className="flex h-full min-h-0 w-full flex-col rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] p-5">
        <div className="flex w-full flex-col gap-5">
          <div className="flex h-10 items-start">
            <Link to={ROUTES.DASHBOARD} aria-label="AthaNext home" className="inline-flex">
              <img src={AthaNextLogo} alt="AthaNext" className="h-[22.55px] w-[100px] object-contain object-left" />
            </Link>
          </div>
          <SidebarMenu className="w-full gap-[5px]">
            {items.map((item) => {
              const active = Boolean(
                item.url &&
                  (location.pathname === item.url ||
                    (item.url !== ROUTES.DASHBOARD && location.pathname.startsWith(item.url)) ||
                    (item.url === ROUTES.COACHES && location.pathname.startsWith("/coach/")))
              );
              const label = (
                <>
                  <item.icon className="size-4" strokeWidth={1.5} />
                  <span>{item.title}</span>
                  {item.url === ROUTES.CHAT && hasNewMessage && (
                    <span
                      className="size-[6.6px] shrink-0 rounded-full bg-[#0054B4]"
                      aria-label="New messages"
                    />
                  )}
                </>
              );
              return (
                <SidebarMenuItem key={item.title}>
                  {item.url ? (
                    <SidebarMenuButton asChild isActive={active} className={navItemClass}>
                      <Link to={item.url} onClick={() => setOpenMobile(false)}>
                        {label}
                      </Link>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton type="button" className={cn(navItemClass, "cursor-default hover:!text-[#767980]")} tabIndex={-1}>
                      {label}
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </div>
        <div className="mt-auto flex items-center gap-[10px]">
          <UserMenu variant="sidebar" useFallbackDelay avatarReady={profileReady} />
          <div className="min-w-0 text-left">
            <p className="truncate text-[16px] font-medium leading-[18px] tracking-[-0.48px] text-[#484D56]">
              {firstName}
            </p>
            <p className="truncate text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#767980]">
              {sportLabel}
            </p>
          </div>
        </div>
      </div>
    </Sidebar>
  );
};
