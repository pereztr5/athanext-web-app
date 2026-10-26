/**
 * Coach Camps: create, edit, share links, and open Registrations. Same list and URL dialogs
 * that used to live on My profile (`?camp=` / `?view=`).
 */
import { Navigate } from "react-router-dom";
import { CampEditorList } from "@/components/camps/CampEditorList";
import { CampUrlDialogs } from "@/components/camps/CampUrlDialogs";
import { useCampDialogs } from "@/components/camps/useCampDialogs";
import { PageHeader } from "@/components/ui/page-header";
import { card } from "@/components/schedule/styles";
import { useAuth } from "@/contexts/AuthContext";
import { useCoachDetails } from "@/hooks/useCoachDetails";
import { useRole } from "@/hooks/useRole";
import { ROUTES } from "@/routes";

const CampsPage = () => {
  const { ready, isCoach } = useRole();
  const { userProfile } = useAuth();
  const { coach } = useCoachDetails(userProfile?.coach_id ?? undefined);
  const campDialogs = useCampDialogs();

  if (!ready) return null;
  if (!isCoach) return <Navigate to={ROUTES.DASHBOARD} replace />;

  const cover =
    (coach as { profile_image_url?: string | null; image_url?: string | null } | null)?.profile_image_url ||
    (coach as { image_url?: string | null } | null)?.image_url ||
    null;

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-wrapper-focused flex-col gap-4 md:gap-6">
        <PageHeader title="Camps" subtitle="Create, share links, and see who signed up. Families need no account." />
        <section className={card} aria-label="Your camps">
          <CampEditorList
            coverFallback={cover}
            onEdit={campDialogs.openEditor}
            onRegistrations={campDialogs.openRegistrations}
          />
        </section>
      </div>
      <CampUrlDialogs />
    </div>
  );
};

export default CampsPage;
