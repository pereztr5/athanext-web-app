import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProfile } from "@/contexts/ProfileContext";
import { referralStatusLabel } from "@/utils/referralHelpers";
import {
  useAcknowledgeReferral, useCoachReferrals, useRemoveReferral,
} from "@/hooks/useReferrals";
import { AddAthleteModal } from "@/components/athletes/AddAthleteModal";
import { ReferralRowActions } from "@/components/referrals/ReferralRowActions";

const MyClients = () => {
  const [searchParams] = useSearchParams();
  const [modalOpen, setModalOpen] = useState(searchParams.get("onboarding") === "1");
  const { profile, loading: profileLoading } = useProfile();
  const coachId = profile?.userProfile?.coach_id ?? undefined;
  const { data: referrals = [], isLoading: referralsLoading } = useCoachReferrals(coachId);
  const acknowledge = useAcknowledgeReferral();
  const remove = useRemoveReferral();
  const isLoading = profileLoading || referralsLoading;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pt-8 pb-16">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">My Clients</h1>
          <p className="text-sm text-muted-foreground">
            Clients who accept your invite book you with no platform service fee.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>Add clients</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : referrals.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No clients yet. Add your current players to get started.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-white">
          {referrals.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{r.client_name || r.client_email}</p>
                {r.client_name ? (
                  <p className="truncate text-sm text-muted-foreground">{r.client_email}</p>
                ) : null}
                {r.athlete_first_name ? (
                  <p className="truncate text-sm text-muted-foreground">Athlete: {r.athlete_first_name}</p>
                ) : null}
                <Badge
                  className="mt-1"
                  variant={r.status === "confirmed" ? "default" : "secondary"}
                >
                  {referralStatusLabel(r)}
                </Badge>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {r.initiated_by === "athlete" && r.status === "pending_confirmation" && (
                  <>
                    <Button size="sm"
                      onClick={() => acknowledge.mutate({ referralId: r.id, accept: true })}>
                      Accept
                    </Button>
                    <Button size="sm" variant="outline"
                      onClick={() => acknowledge.mutate({ referralId: r.id, accept: false })}>
                      Not my client
                    </Button>
                  </>
                )}
                <ReferralRowActions referral={r} />
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(r.id)}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <AddAthleteModal open={modalOpen} onClose={() => setModalOpen(false)} coachId={coachId} />
    </div>
  );
};

export default MyClients;
