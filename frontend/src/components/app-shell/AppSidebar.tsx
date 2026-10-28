import { Link, useLocation } from "react-router-dom";
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
import { ROUTES } from "@/routes";
import { AthaNextLogo } from "@/assets";
import { useMyOrganization } from "@/hooks/useOrganizations";
import { useQuery } from "@tanstack/react-query";
import { bookingRequestsAPI } from "@/api/bookingRequests";
import { useCoachReferrals } from "@/hooks/useReferrals";
import { isAwaitingCoachApproval } from "@/utils/referralHelpers";
import { ADMIN_CAMPS_NAV, ATHLETE_NAV, COACH_NAV, ORG_NAV, PROFILE_NAV, isNavActive, type NavItem } from "./nav";
import { useOverdueInvoices } from "@/hooks/useOverdueInvoices";
import { cn } from "@/lib/utils";

// Design system NavItem: 34px in every state with 10px padding, so clicking never shifts the list.
// Active: light fill, 1px primary-400 stroke (4.1:1), primary label and icon. Hover: light-400 fill.
const navItemClass =
  "!h-control !gap-2 !rounded-control !border !border-transparent !px-2.5 !py-0 text-label-sm text-dark-300 shadow-none transition-colors hover:!bg-light-400 hover:!text-dark focus-visible:!ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary data-[active=true]:!border-primary-400 data-[active=true]:!bg-light data-[active=true]:font-medium data-[active=true]:!text-primary data-[active=true]:shadow-none data-[active=true]:hover:!bg-light data-[active=true]:hover:!text-primary [&>svg]:!size-4 [&>svg]:shrink-0";
// One count style: pill-notify (blue). Red pill-failed only for overdue money.
const navBadge = "ml-auto rounded-pill border border-primary bg-primary px-[7px] py-[2px] text-label-xsm text-light";
const navBadgeFailed = "border-error-300 bg-error-100 text-error-700";

export const AppSidebar = () => {
  const location = useLocation();
  const { isCoach } = useRole();
  const { userName, userProfile, profileReady } = useAuth();
  const { setOpenMobile } = useSidebar();
  const { data: myOrg } = useMyOrganization();
  const overdue = useOverdueInvoices();
  // Badges as in the Working Copy: requests waiting on My schedule, new families on My athletes.
  const requests = useQuery({ queryKey: ["booking-requests"], queryFn: () => bookingRequestsAPI.listForCoach(), enabled: isCoach, staleTime: 60_000 });
  const referrals = useCoachReferrals(isCoach ? userProfile?.coach_id ?? undefined : undefined);
  const approvals = (referrals.data ?? []).filter(isAwaitingCoachApproval).length;
  const badgeFor = (url: string) =>
    url === ROUTES.SCHEDULE && requests.data?.length
      ? String(requests.data.length)
      : url === ROUTES.ATHLETES && approvals
        ? `${approvals} new`
        : url === ROUTES.PAYMENTS && isCoach && overdue
          ? `${overdue} overdue`
          : null;
  const publicPages = isCoach ? [PROFILE_NAV, ...(myOrg ? [ORG_NAV] : [])] : [];
  const items = (isCoach ? COACH_NAV : userProfile?.is_admin ? [...ATHLETE_NAV, ADMIN_CAMPS_NAV] : ATHLETE_NAV) as NavItem[];

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
      <div className="flex h-full min-h-0 w-full flex-col gap-5 overflow-y-auto border-r border-light-525 bg-light-300 px-[10px] py-5">
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
                  <Link
                    to={item.url}
                    onClick={() => setOpenMobile(false)}
                    aria-current={isNavActive(item, location.pathname) ? "page" : undefined}
                  >
                    <item.icon className="size-4" strokeWidth={1.5} />
                    <span>{item.title}</span>
                    {badgeFor(item.url) ? (
                      <span className={cn(navBadge, item.url === ROUTES.PAYMENTS && navBadgeFailed)}>{badgeFor(item.url)}</span>
                    ) : null}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          {publicPages.length ? (
            <div className="flex flex-col gap-2">
              <p className="px-2.5 text-label-xsm text-dark-300">Public pages</p>
              <SidebarMenu className="w-full gap-1">
                {publicPages.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isNavActive(item, location.pathname)} className={navItemClass}>
                      <Link
                        to={item.url}
                        onClick={() => setOpenMobile(false)}
                        aria-current={isNavActive(item, location.pathname) ? "page" : undefined}
                      >
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
        <div className="mt-auto border-t border-light-525 pt-4">
          <UserMenu variant="sidebar" useFallbackDelay avatarReady={profileReady} label={{ name: firstName, sub: sportLabel }} />
        </div>
      </div>
    </Sidebar>
  );
};
