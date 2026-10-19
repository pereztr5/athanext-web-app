import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getAllReferrals } from "@/api/referrals";
import { useCoaches } from "@/hooks/useCoaches";
import { REFERRAL_KEYS, useAdminConfirmReferral, useRemoveReferral } from "@/hooks/useReferrals";
import { isOpenInvite, referralStatusLabel } from "@/utils/referralHelpers";
import { AddClientsModal } from "@/components/referrals/AddClientsModal";
import { ReferralRowActions } from "@/components/referrals/ReferralRowActions";

const AdminReferrals = () => {
  const { toast } = useToast();
  const { data: referrals = [], isLoading } = useQuery({
    queryKey: [...REFERRAL_KEYS.all, "admin"],
    queryFn: async () => {
      const { data, error } = await getAllReferrals();
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const { coaches } = useCoaches();
  const coachNames = Object.fromEntries(coaches.map((c) => [c.id, c.name]));
  const confirm = useAdminConfirmReferral();
  const remove = useRemoveReferral();
  const [coachId, setCoachId] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
    <div className="mx-auto flex w-full max-w-wrapper flex-col gap-4 md:gap-6">
      <PageHeader
        title="Referral links"
        subtitle="Confirmed coach and athlete pairs pay no platform fee on sessions with each other. Use the override to import a coach's book of business or fix a typo (remove the row and add it again with the right email)."
      />

      <div className="flex flex-wrap items-end gap-2 rounded-card border border-light-525 bg-light-300 p-4">
        <div className="min-w-48">
          <Select value={coachId} onValueChange={setCoachId}>
            <SelectTrigger><SelectValue placeholder="Coach" /></SelectTrigger>
            <SelectContent>
              {coaches.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button disabled={!coachId} onClick={() => setModalOpen(true)}>
          Add clients as confirmed
        </Button>
      </div>

      {isLoading ? (
        <p className="text-body-m text-dark-300">Loading…</p>
      ) : (
        <ul className="divide-y divide-light-525 rounded-card border border-light-525 bg-light-300">
          {referrals.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="truncate text-label-sm text-dark">
                  {coachNames[r.coach_id] ?? r.coach_id} &rarr; {r.client_name ? `${r.client_name} · ` : ""}
                  {r.client_email}
                </p>
                <p className="text-caption text-dark-300">
                  <Badge variant={r.status === "confirmed" ? "default" : "secondary"}>
                    {referralStatusLabel(r)}
                  </Badge>
                  {" "}&middot; {r.initiated_by} &middot; {r.relationship_source ?? "no attestation"} &middot;{" "}
                  {r.created_at.slice(0, 10)}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {r.status !== "confirmed" && r.status !== "declined" ? (
                  <Button
                    size="sm"
                    disabled={confirm.isPending}
                    onClick={async () => {
                      try {
                        await confirm.mutateAsync(r);
                        toast({ title: "Relationship confirmed" });
                      } catch (e) {
                        toast({
                          title: "Could not confirm",
                          description:
                            e instanceof Error && e.message.includes("ccr_one_confirmed_pair")
                              ? "This athlete is already confirmed with this coach."
                              : e instanceof Error
                                ? e.message
                                : undefined,
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    Confirm
                  </Button>
                ) : null}
                {isOpenInvite(r) ? <ReferralRowActions referral={r} /> : null}
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(r.id)}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddClientsModal
        open={modalOpen}
        coachId={coachId || undefined}
        onClose={() => setModalOpen(false)}
      />
    </div>
    </div>
  );
};

export default AdminReferrals;
