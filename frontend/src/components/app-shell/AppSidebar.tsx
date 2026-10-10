import { Link, useLocation } from "react-router-dom";
import { Shield, Users } from "lucide-react";
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
import { useMyOrganization } from "@/hooks/useOrganizations";
import { useCoachPayMode } from "@/hooks/useCoachPayMode";
import { useQuery } from "@tanstack/react-query";
import { bookingRequestsAPI } from "@/api/bookingRequests";
import { useCoachReferrals } from "@/hooks/useReferrals";
import { isAwaitingCoachApproval } from "@/utils/referralHelpers";
import { ATHLETE_NAV, COACH_NAV, ORG_NAV, PAYMENTS_NAV, isNavActive, type NavItem } from "./nav";

// Working Copy `.nav button`: 28px rows, the current page grows to 38px on the active tint.
const navItemClass =
  "!h-7 !gap-[5px] !rounded-[8px] !px-[5px] !py-0 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#767980] shadow-none transition-colors hover:!bg-transparent hover:!text-[#1A202C] focus-visible:!ring-2 focus-visible:!ring-[#6698D2] data-[active=true]:!h-[38px] data-[active=true]:!bg-[#F9F9F5] data-[active=true]:!px-[10px] data-[active=true]:font-medium data-[active=true]:!text-[#0054B4] data-[active=true]:shadow-none data-[active=true]:hover:!bg-[#F9F9F5] data-[active=true]:hover:!text-[#0054B4] [&>svg]:!size-4 [&>svg]:shrink-0";
const navBadge = "ml-auto rounded-[4px] bg-[#0054B4] px-2 py-[3px] text-[12px] font-medium leading-[13px] text-[#F1F1E6]";

export const AppSidebar = () => {
  const location = useLocation();
  const { isCoach } = useRole();
  const { isAdmin } = useIsAdmin();
  const { userName, userProfile, profileReady } = useAuth();
  const { setOpenMobile } = useSidebar();
  const { data: myOrg } = useMyOrganization();
  const { data: payMode } = useCoachPayMode();
  // Badges as in the Working Copy: requests waiting on My Schedule, new families on My Athletes.
  const requests = useQuery({ queryKey: ["booking-requests"], queryFn: () => bookingRequestsAPI.listForCoach(), enabled: isCoach, staleTime: 60_000 });
  const referrals = useCoachReferrals(isCoach ? userProfile?.coach_id ?? undefined : undefined);
  const approvals = (referrals.data ?? []).filter(isAwaitingCoachApproval).length;
  const badgeFor = (url: string) =>
    url === ROUTES.SCHEDULE && requests.data?.length ? String(requests.data.length) : url === ROUTES.ATHLETES && approvals ? `${approvals} new` : null;
  const business = isCoach ? [...(myOrg ? [ORG_NAV] : []), ...(payMode === "app" ? [PAYMENTS_NAV] : [])] : [];
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
      <div className="flex h-full min-h-0 w-full flex-col gap-5 overflow-y-auto border-r border-[#EAEADF] bg-[#F7F7F0] px-[10px] py-5">
        <div className="flex w-full flex-col gap-5">
          <div className="flex items-center px-[10px] pb-1 pt-1.5">
            <Link to={ROUTES.DASHBOARD} aria-label="AthaNext home" className="inline-flex">
              <img src={AthaNextLogo} alt="AthaNext" className="h-[22px] w-[98px] object-contain object-left" />
            </Link>
          </div>
          <SidebarMenu className="w-full gap-1">
            {items.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={isNavActive(item, location.pathname)} className={navItemClass}>
                  <Link to={item.url} onClick={() => setOpenMobile(false)}>
                    <item.icon className="size-4" strokeWidth={1.5} />
                    <span>{item.title}</span>
                    {badgeFor(item.url) ? <span className={navBadge}>{badgeFor(item.url)}</span> : null}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          {business.length ? (
            <div className="flex flex-col gap-2">
              <p className="px-[5px] text-[12px] font-medium leading-[13px] tracking-[-0.03em] text-[#A3A6AB]">Business</p>
              <SidebarMenu className="w-full gap-1">
                {business.map((item) => (
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
          ) : null}
        </div>
        <div className="mt-auto border-t border-[#EAEADF] pt-4">
          <UserMenu variant="sidebar" useFallbackDelay avatarReady={profileReady} label={{ name: firstName, sub: sportLabel }} />
        </div>
      </div>
    </Sidebar>
  );
};
