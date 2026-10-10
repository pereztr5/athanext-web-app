/**
 * Athlete Account (Working Copy `a-account`): opened from the avatar. Profile card with View
 * and Edit, then Settings, Help and Sign out.
 */
import type { ReactNode } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, CircleHelp, Eye, LogOut, Pencil, Settings } from "lucide-react";
import { athleteHomeAPI } from "@/api/athleteHome";
import { card, pageTitle, secondaryButton } from "@/components/schedule/styles";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useRole } from "@/hooks/useRole";
import { cn, getInitials } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { ageGroup, playerLine } from "@/utils/athleteHome";
import { getZonedISODate } from "@/utils/dateHelpers";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";

const Row = ({
  to,
  icon,
  title,
  sub,
  onClick,
}: {
  to?: string;
  icon: ReactNode;
  title: string;
  sub?: string;
  onClick?: () => void;
}) => {
  const className =
    "flex w-full items-center gap-3 p-[14px] text-left transition-colors first:rounded-t-[10px] last:rounded-b-[10px] hover:bg-[#F4F4EB] [&+&]:border-t [&+&]:border-[#EAEADF]";
  const inner = (
    <>
      <span className="inline-flex size-9 flex-none items-center justify-center rounded-[8px] bg-[#F1F1E6] text-[#484D56] [&>svg]:size-5">{icon}</span>
      <span className="flex min-w-0 grow flex-col gap-1">
        <span className="text-[14px] font-medium">{title}</span>
        {sub ? <span className="text-[12px] leading-[14px] text-[#767980]">{sub}</span> : null}
      </span>
      {to ? <ChevronRight className="size-4 flex-none text-[#A3A6AB]" strokeWidth={1.5} aria-hidden="true" /> : null}
    </>
  );
  if (to) return <Link to={to} className={className}>{inner}</Link>;
  return (
    <button type="button" className={className} onClick={onClick}>
      {inner}
    </button>
  );
};

const AccountPage = () => {
  const { isCoach, ready } = useRole();
  const { signOut, userName } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const timeZone = useViewerTimeZone();
  const today = getZonedISODate(new Date(), timeZone);
  const home = useQuery({ queryKey: ["athlete-home"], queryFn: () => athleteHomeAPI.get(), enabled: !isCoach });

  if (!ready) return null;
  if (isCoach) return <Navigate to={ROUTES.BUSINESS} replace />;

  const a = home.data?.athlete;
  const name = a?.fullName || userName || "Athlete";
  const isParent = profile?.userProfile?.persona_type === "parent";
  const parentName = profile?.userProfile?.name || userName;
  const group = a ? ageGroup(a.dateOfBirth, today) : "";
  const sub = a
    ? [a.position, group, a.team].filter(Boolean).join(" · ") || playerLine(a, today)
    : "";

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-[14px]">
        <h1 className={pageTitle}>Account</h1>
        <section className={cn(card, "gap-4")}>
          <div className="flex items-center gap-3">
            <span className="flex size-14 flex-none items-center justify-center overflow-hidden rounded-full bg-[#E5EDF7] text-[18px] font-medium text-[#0054B4]">
              {a?.photo ? <img src={a.photo} alt="" className="size-full object-cover" /> : getInitials(name)}
            </span>
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[16px] font-medium leading-[18px] tracking-[-0.05em]">{name}</span>
              {sub ? <span className="text-[12px] leading-[14px] text-[#767980]">{sub}</span> : null}
              {isParent && parentName ? (
                <span className="text-[12px] leading-[14px] text-[#767980]">Managed by {parentName}, parent</span>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link to={ROUTES.DASHBOARD} className={secondaryButton}>
              <Eye strokeWidth={1.5} aria-hidden="true" />
              View profile
            </Link>
            <Link to={`${ROUTES.DASHBOARD}?edit=1`} className={secondaryButton}>
              <Pencil strokeWidth={1.5} aria-hidden="true" />
              Edit profile
            </Link>
          </div>
        </section>
        <span className="px-[5px] text-[12px] font-medium leading-[13px] text-[#A3A6AB]">Account</span>
        <div className="flex flex-col rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0]">
          <Row to={ROUTES.SETTINGS} icon={<Settings strokeWidth={1.5} />} title="Account Settings" sub={isParent ? "Parent details, notifications and privacy" : "Notifications and privacy"} />
          <Row to={ROUTES.HELP} icon={<CircleHelp strokeWidth={1.5} />} title="Help" sub="Guides and contact" />
          <Row
            icon={<LogOut strokeWidth={1.5} />}
            title="Sign out"
            onClick={async () => {
              await signOut();
              navigate(ROUTES.HOME);
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default AccountPage;
