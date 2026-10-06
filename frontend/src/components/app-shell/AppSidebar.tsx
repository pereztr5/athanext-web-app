import { Link, useLocation } from "react-router-dom";
import { CircleHelp, Settings, Shield, Users } from "lucide-react";
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
import { ATHLETE_NAV, COACH_NAV, isNavActive, type NavItem } from "./nav";

const FOOTER_NAV = [
  { title: "Account Settings", url: ROUTES.SETTINGS, icon: Settings },
  { title: "Help", url: ROUTES.CONTACT_US, icon: CircleHelp },
];

const FOOTER_LINKS = [
  { title: "Support", url: ROUTES.CONTACT_US },
  { title: "Privacy", url: ROUTES.PRIVACY_POLICY },
  { title: "Terms", url: ROUTES.TERMS_AND_CONDITIONS },
];

const navItemClass =
  "!h-8 !gap-[5px] !rounded-[5px] !border !border-transparent !px-[10px] !py-0 text-[14px] font-medium leading-[18px] tracking-[-0.42px] text-[#767980] shadow-none transition-colors hover:!bg-transparent hover:!text-[#1A202C] focus-visible:!ring-2 focus-visible:!ring-[#6698D2] data-[active=true]:!border-[#EAEADF] data-[active=true]:!bg-[#F9F9F5] data-[active=true]:font-medium data-[active=true]:!text-[#0054B4] data-[active=true]:shadow-none data-[active=true]:hover:!bg-[#F9F9F5] data-[active=true]:hover:!text-[#0054B4] [&>svg]:!size-4 [&>svg]:shrink-0";

export const AppSidebar = () => {
  const location = useLocation();
  const { isCoach } = useRole();
  const { isAdmin } = useIsAdmin();
  const { userName, userProfile, profileReady } = useAuth();
  const { setOpenMobile } = useSidebar();
  const items = [
    ...(isCoach ? COACH_NAV : ATHLETE_NAV),
    ...(isAdmin
      ? [
          { title: "Accounts", short: "Accounts", url: ROUTES.ADMIN_ACCOUNTS, icon: Shield },
          { title: "Referrals", short: "Referrals", url: ROUTES.ADMIN_REFERRALS, icon: Users },
        ]
      : []),
  ] as NavItem[];

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
            {items.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={isNavActive(item, location.pathname)} className={navItemClass}>
                  <Link to={item.url} onClick={() => setOpenMobile(false)}>
                    <item.icon className="size-4" strokeWidth={1.5} />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>
        <SidebarMenu className="mt-auto w-full gap-[5px] pb-3">
            {FOOTER_NAV.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={location.pathname.startsWith(item.url)} className={navItemClass}>
                  <Link to={item.url} onClick={() => setOpenMobile(false)}>
                    <item.icon className="size-4" strokeWidth={1.5} />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        <nav aria-label="Support and legal" className="flex flex-wrap gap-x-3 gap-y-1 pb-4">
          {FOOTER_LINKS.filter((link) => link.url !== ROUTES.CONTACT_US).map((link) => (
            <Link
              key={link.url}
              to={link.url}
              onClick={() => setOpenMobile(false)}
              className="text-[12px] font-normal leading-[14px] tracking-[-0.36px] text-[#767980] transition-colors hover:text-[#1A202C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]"
            >
              {link.title}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-[10px]">
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
