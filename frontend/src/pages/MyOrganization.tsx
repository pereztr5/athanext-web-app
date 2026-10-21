/**
 * Organization page (ATH-90, Working Copy): the org owner edits what families see on the
 * academy's public page. Org coaches, rates and org sessions are tabs on Business.
 */
import { Link, Navigate } from "react-router-dom";
import { Building2, Eye } from "@/components/icons";
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
        <div className="mx-auto flex w-full max-w-wrapper flex-col gap-4 md:gap-6">
          <section className={cn(card, "items-center py-10 text-center")}>
            <Building2 className="size-6 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
            <b className="text-subtitle">No organization yet</b>
            <p className="max-w-[420px] text-body-m text-dark-300">
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
      <div className="mx-auto flex w-full max-w-wrapper flex-col gap-4 md:gap-6">
        <header className="flex items-center gap-4">
          <OrgLogo name={org.name} url={org.logoUrl} size={48} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <h1 className={pageTitle}>Organization page</h1>
            <p className="truncate text-body-m text-dark-300">{org.name} · what families see</p>
          </div>
          <Link to={`/organizations/${org.slug}`} className={secondaryButton} aria-label="View page">
            <Eye strokeWidth={1.5} aria-hidden="true" />
            <span className="hidden sm:inline">View page</span>
          </Link>
        </header>
        <OrgPageEditor org={org} />
        <p className="text-caption text-dark-300">
          Org coaches, rates and org sessions are under{" "}
          <Link to={`${ROUTES.PAYMENTS}?tab=coaches`} className="font-medium text-primary hover:underline">
            My Business
          </Link>
          .
        </p>
      </div>
    </div>
  );
};

export default MyOrganizationPage;
