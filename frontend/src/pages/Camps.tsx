/**
 * Coach Camps: create, edit, share links, and open Registrations. Same list and URL dialogs
 * that used to live on My profile (`?camp=` / `?view=`). Admins can edit another coach's existing
 * camps (create stays on the coach's own account): the coach picker shows only when the admin
 * portal links here with `?coach=<id>`, or for an admin account with no coach profile, so a coach
 * who is also an admin sees their own Camps page like any coach.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useSearchParams } from "react-router-dom";
import { campsAPI } from "@/api/camps";
import { CampEditorList } from "@/components/camps/CampEditorList";
import { CampUrlDialogs } from "@/components/camps/CampUrlDialogs";
import { useCampDialogs } from "@/components/camps/useCampDialogs";
import { useSeeNewCampSignups } from "@/components/camps/useNewCampSignups";
import { PageHeader } from "@/components/ui/page-header";
import { card, label, meta } from "@/components/schedule/styles";
import { useAuth } from "@/contexts/AuthContext";
import { useCoachDetails } from "@/hooks/useCoachDetails";
import { useRole } from "@/hooks/useRole";
import { ROUTES } from "@/routes";

const CampsPage = () => {
  const { ready, isCoach } = useRole();
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.is_admin === true;
  const ownCoachId = userProfile?.coach_id ?? null;
  const [searchParams] = useSearchParams();
  const coachParam = searchParams.get("coach") ?? "";
  const [adminCoachId, setAdminCoachId] = useState<string>(coachParam);
  const showCoachPicker = isAdmin && (Boolean(coachParam) || !ownCoachId);
  const viewingCoachId = isAdmin && adminCoachId ? adminCoachId : ownCoachId;
  const viewingOther = Boolean(isAdmin && adminCoachId && adminCoachId !== ownCoachId);
  const { coach } = useCoachDetails(viewingCoachId ?? undefined);
  const campDialogs = useCampDialogs();
  // Own camps only: keeps "2 new" on each camp for this visit, then clears the nav count and bell.
  const newSignups = useSeeNewCampSignups(ready && isCoach && Boolean(ownCoachId) && !viewingOther);
  const coaches = useQuery({
    queryKey: ["camps-admin-coach-picker"],
    enabled: ready && showCoachPicker,
    staleTime: 60_000,
    queryFn: () => campsAPI.adminCoaches(),
  });

  const coachOptions = useMemo(() => {
    const list = coaches.data ?? [];
    return [...list].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [coaches.data]);

  if (!ready) return null;
  if (!isCoach && !isAdmin) return <Navigate to={ROUTES.DASHBOARD} replace />;

  const cover =
    (coach as { profile_image_url?: string | null; image_url?: string | null } | null)?.profile_image_url ||
    (coach as { image_url?: string | null } | null)?.image_url ||
    null;

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-wrapper-focused flex-col gap-4 md:gap-6">
        <PageHeader
          title="Camps"
          subtitle={
            viewingOther
              ? `Editing camps for ${coach?.name || "this coach"}. Families need no account.`
              : "Create, share links, and see who signed up. Families need no account."
          }
        />
        {showCoachPicker ? (
          <section className={card} aria-label="Coach to edit">
            <div className="flex flex-col gap-2">
              <span className={label}>Coach</span>
              <span className={meta}>Pick a coach to edit their camps. Leave blank for your own.</span>
              <select
                className="h-11 w-full max-w-md rounded-control border border-light-525 bg-light-300 px-3 text-body-m text-dark"
                value={adminCoachId}
                onChange={(e) => setAdminCoachId(e.target.value)}
              >
                <option value="">{ownCoachId ? "Your camps" : "Select a coach"}</option>
                {coachOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.slug || c.id} ({c.camps})
                  </option>
                ))}
              </select>
            </div>
          </section>
        ) : null}
        <section className={card} aria-label="Your camps">
          {isAdmin && !ownCoachId && !adminCoachId ? (
            <p className={meta}>Select a coach to see their camps.</p>
          ) : (
            <CampEditorList
              coverFallback={cover}
              onEdit={campDialogs.openEditor}
              onRegistrations={campDialogs.openRegistrations}
              coachId={viewingOther ? adminCoachId : undefined}
              enabled={Boolean(viewingCoachId)}
              newSignups={viewingOther ? undefined : newSignups.camps}
            />
          )}
        </section>
      </div>
      <CampUrlDialogs />
    </div>
  );
};

export default CampsPage;
