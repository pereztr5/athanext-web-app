/**
 * Business (Working Copy `c-account`): the 5th phone tab for coaches. The profile card with
 * View and Edit profile, then Payments (money paid in the app: owed, next payout, overdue), My
 * organization, Camps (sign-ups and camp money, when the coach has any) and Offline payments
 * (paid to the coach directly) for every coach.
 */
import type { ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Building2, CalendarDays, ChevronRight, CreditCard, Eye, Pencil, Star } from "@/components/icons";
import { BrandPill } from "@/components/brand";
import { homeAPI } from "@/api/home";
import { payoutsAPI } from "@/api/payouts";
import { CampMoney } from "@/components/business/CampMoney";
import { OfflinePayments } from "@/components/business/OfflinePayments";
import { PageHeader } from "@/components/ui/page-header";
import { card, secondaryButton } from "@/components/schedule/styles";
import { useAuth } from "@/contexts/AuthContext";
import { useCoachDetails } from "@/hooks/useCoachDetails";
import { useCoachPayMode } from "@/hooks/useCoachPayMode";
import { useMyOrganization } from "@/hooks/useOrganizations";
import { useOverdueInvoices } from "@/hooks/useOverdueInvoices";
import { useRole } from "@/hooks/useRole";
import { cn, getInitials } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { COACH_MONEY_STALE_MS } from "@/utils/coachMoney";
import { money } from "@/utils/payments";
import { plural } from "@/utils/schedule";

type CoachRow = {
  name?: string | null;
  position?: string | null;
  locations?: string[] | null;
  rating?: number | null;
  total_reviews?: number | null;
  image_url?: string | null;
  profile_image_url?: string | null;
};

const Row = ({ to, icon, title, sub, right }: { to: string; icon: ReactNode; title: string; sub?: string; right?: ReactNode }) => (
  <Link to={to} className="flex w-full items-center gap-3 p-3.5 text-left transition-colors first:rounded-t-card last:rounded-b-card hover:bg-light-200 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary [&+&]:border-t [&+&]:border-light-525">
    <span className="inline-flex size-9 flex-none items-center justify-center rounded-control border border-light-525 bg-light text-dark-400 [&>svg]:size-5">{icon}</span>
    <span className="flex min-w-0 grow flex-col gap-1">
      <span className="text-label-sm">{title}</span>
      {sub ? <span className="text-caption text-dark-300">{sub}</span> : null}
    </span>
    {right}
    <ChevronRight className="size-4 flex-none text-dark-300" strokeWidth={1.5} aria-hidden="true" />
  </Link>
);

const BusinessPage = () => {
  const { isCoach, ready } = useRole();
  const { userProfile, userName } = useAuth();
  const { coach } = useCoachDetails(userProfile?.coach_id ?? undefined);
  const me = (coach ?? {}) as CoachRow;
  const payMode = useCoachPayMode();
  const selfPay = payMode.data === "self";
  const { data: org } = useMyOrganization();
  const overdue = useOverdueInvoices();
  const earnings = useQuery({
    queryKey: ["coach-earnings", 1],
    queryFn: () => homeAPI.earnings(1),
    enabled: isCoach && !selfPay,
    staleTime: COACH_MONEY_STALE_MS,
    refetchOnMount: "always",
  });
  const payouts = useQuery({
    queryKey: ["coach-payouts"],
    queryFn: () => payoutsAPI.summary(),
    enabled: isCoach && !selfPay,
    retry: false,
    staleTime: COACH_MONEY_STALE_MS,
    refetchOnMount: "always",
  });

  if (!ready) return null;
  if (!isCoach) return <Navigate to={ROUTES.DASHBOARD} replace />;

  const name = me.name || userName || "Coach";
  const photo = me.profile_image_url || me.image_url;
  const owed = earnings.data?.owed ?? 0;
  const nextPayout = payouts.data?.payouts
    .filter((p) => p.status === "pending" || p.status === "in_transit")
    .sort((a, b) => a.arrival.localeCompare(b.arrival))[0];
  const paySub = selfPay
    ? "Booking only. Families pay you directly"
    : [
        owed ? `Paid in app: ${money(owed)} owed` : "Paid in app: nothing owed",
        nextPayout ? `payout ${new Date(nextPayout.arrival).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "",
      ]
        .filter(Boolean)
        .join(" · ");
  const place = (me.locations ?? []).filter(Boolean)[0];

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-wrapper-focused flex-col gap-4 md:gap-6">
        <PageHeader title="My Business" />
        <section className={cn(card, "gap-4")}>
          <div className="flex items-center gap-3">
            <span className="flex size-14 flex-none items-center justify-center overflow-hidden rounded-full border border-primary-200 bg-primary-50 text-subtitle text-primary">
              {photo ? <img src={photo} alt="" className="size-full object-cover" /> : getInitials(name)}
            </span>
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-subtitle">{name}</span>
              {[me.position, place].filter(Boolean).length ? (
                <span className="text-caption text-dark-300">{[me.position, place].filter(Boolean).join(" · ")}</span>
              ) : null}
              {me.total_reviews && Number(me.rating) > 0 ? (
                <span className="flex items-center gap-1">
                  <Star className="size-4 fill-rating text-rating-600" strokeWidth={1.5} aria-hidden="true" />
                  <b className="text-label-sm">{Number(me.rating ?? 0).toFixed(1)}</b>
                  <span className="text-caption text-dark-300">· {plural(me.total_reviews, "review")}</span>
                </span>
              ) : (
                <span className="text-caption text-dark-300">No reviews yet</span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link to={ROUTES.PROFILE} className={secondaryButton}>
              <Eye strokeWidth={1.5} aria-hidden="true" />
              View profile
            </Link>
            <Link to={`${ROUTES.PROFILE}?mode=edit`} className={secondaryButton}>
              <Pencil strokeWidth={1.5} aria-hidden="true" />
              Edit profile
            </Link>
          </div>
        </section>
        <div className="flex flex-col rounded-card border border-light-525 bg-light-300">
          <Row
            to={ROUTES.PAYMENTS}
            icon={<CreditCard strokeWidth={1.5} />}
            title="Payments"
            sub={paySub}
            right={overdue ? <BrandPill tone="red">{overdue} overdue</BrandPill> : null}
          />
          <Row
            to={org ? ROUTES.MY_ORGANIZATION : ROUTES.CONTACT_US}
            icon={<Building2 strokeWidth={1.5} />}
            title="My organization"
            sub={org ? `${org.name} · ${plural(org.coaches.length, "coach", "coaches")}` : "By invitation from AthaNext"}
          />
          <Row
            to={ROUTES.PROFILE}
            icon={<CalendarDays strokeWidth={1.5} />}
            title="Camps"
            sub="Create, share links, and see who signed up"
          />
        </div>
        {userProfile?.coach_id ? <CampMoney coachId={userProfile.coach_id} /> : null}
        <OfflinePayments />
      </div>
    </div>
  );
};

export default BusinessPage;
