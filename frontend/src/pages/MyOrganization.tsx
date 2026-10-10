/**
 * Organization page (ATH-90, Working Copy): the org owner edits what families see on the
 * academy's public page. Org coaches, rates and org sessions are tabs on Business.
 */
import { Link, Navigate } from "react-router-dom";
import { Building2, Eye } from "lucide-react";
import { OrgLogo, OrgPageEditor } from "@/components/organization/OrgPageEditor";
import { card, pageTitle, secondaryButton } from "@/components/schedule/styles";
import { useMyOrganization } from "@/hooks/useOrganizations";
import { useRole } from "@/hooks/useRole";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";

const MyOrganizationPage = () => {
  const { isCoach, ready } = useRole();
  const { data: org, isLoading } = useMyOrganization();

  if (!ready || (isCoach && isLoading)) return null;
  if (!isCoach) return <Navigate to={ROUTES.DASHBOARD} replace />;

  if (!org) {
    return (
      <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
        <div className="mx-auto flex w-full max-w-[980px] flex-col gap-5">
          <section className={cn(card, "items-center py-10 text-center")}>
            <Building2 className="size-8 text-[#A3A6AB]" strokeWidth={1.5} aria-hidden="true" />
            <b className="text-[18px] font-medium">No organization yet</b>
            <p className="max-w-[420px] text-[14px] text-[#767980]">
              AthaNext can give your account org status. Then you can add coaches, a shared page and splits.
            </p>
            <Link to={ROUTES.CONTACT_US} className={secondaryButton}>Contact AthaNext</Link>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-5">
        <header className="flex items-center gap-4">
          <OrgLogo name={org.name} url={org.logoUrl} size={48} />
          <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
            <h1 className={pageTitle}>Organization page</h1>
            <p className="truncate text-[14px] text-[#767980]">{org.name} · what families see</p>
          </div>
          <Link to={`/organizations/${org.slug}`} className={secondaryButton} aria-label="View page">
            <Eye strokeWidth={1.5} aria-hidden="true" />
            <span className="hidden sm:inline">View page</span>
          </Link>
        </header>
        <OrgPageEditor org={org} />
        <p className="text-[12px] leading-[14px] text-[#767980]">
          Org coaches, rates and org sessions are under{" "}
          <Link to={`${ROUTES.PAYMENTS}?tab=coaches`} className="font-medium text-[#0054B4] hover:underline">
            Business
          </Link>
          .
        </p>
      </div>
    </div>
  );
};

export default MyOrganizationPage;
