/**
 * Invites work list (WC4): Needs approval, Waiting, Joined, All — one action per row.
 * Marketplace families stay on the roster only; they do not appear here.
 * Mounted as the Invites tab on My Athletes; `/invites` redirects there.
 */
import { useMemo, useState } from "react";
import { DeclineDialog, FixEmailDialog } from "@/components/invites/InviteDialogs";
import { InvitesTable, type InviteAction } from "@/components/invites/InvitesTable";
import {
  INVITE_FILTERS,
  inviteCounts,
  inviteStatus,
  isInviteWorkStatus,
  matchesFilter,
  parentName,
  athleteFirst,
  type InviteFilter,
} from "@/components/invites/inviteStatus";
import { useCoachInvites, useFixInviteEmail, useResendInvite } from "@/components/invites/useInvites";
import { useCopyInviteLink } from "@/components/referrals/useCopyInviteLink";
import { card, meta, segButton, segGroup } from "@/components/schedule/styles";
import type { CoachInviteRow } from "@/api/referrals";
import { useToast } from "@/hooks/use-toast";
import { useAcknowledgeReferral, useRemoveReferral } from "@/hooks/useReferrals";
import { cn } from "@/lib/utils";
import { plural } from "@/utils/schedule";

export const InvitesWorkList = ({ coachId }: { coachId: string | undefined }) => {
  const [filter, setFilter] = useState<InviteFilter>("approval");
  const [fixing, setFixing] = useState<CoachInviteRow | null>(null);
  const [declining, setDeclining] = useState<CoachInviteRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const invites = useCoachInvites(coachId);
  const acknowledge = useAcknowledgeReferral();
  const remove = useRemoveReferral();
  const resend = useResendInvite();
  const fixEmail = useFixInviteEmail();
  const copyInviteLink = useCopyInviteLink();
  const { toast } = useToast();

  const rows = useMemo(
    () =>
      (invites.data ?? [])
        .map((invite) => ({ invite, status: inviteStatus(invite) }))
        .filter((r) => isInviteWorkStatus(r.status)),
    [invites.data],
  );
  const counts = inviteCounts(rows.map((r) => r.status));
  const shown = rows.filter((r) => matchesFilter(r.status, filter));

  const fail = (title: string) => (e: unknown) =>
    toast({ title, description: e instanceof Error ? e.message : undefined, variant: "destructive" });
  const track = async (id: string, run: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await run();
    } finally {
      setBusyId(null);
    }
  };

  const onAction = (action: InviteAction, invite: CoachInviteRow) => {
    const parent = parentName(invite);
    if (action === "fix") return setFixing(invite);
    if (action === "decline") return setDeclining(invite);
    if (action === "approve") {
      const athlete = athleteFirst(invite) ?? "Their athlete";
      return track(invite.id, () =>
        acknowledge
          .mutateAsync({ referralId: invite.id, accept: true })
          .then(() => toast({ title: `${parent} approved`, description: `${athlete} joined your roster and can book you directly.` }))
          .catch(fail("Couldn't approve")),
      );
    }
    if (action === "resend") {
      return track(invite.id, () =>
        resend
          .mutateAsync(invite.id)
          .then((data) => {
            if (data?.invite_link && !data.emailed) return copyInviteLink(data.invite_link);
            toast({ title: `Invite resent to ${parent}` });
          })
          .catch((e: Error) => toast({ title: e.message, variant: "destructive" })),
      );
    }
    if (action === "remove") {
      return track(invite.id, () =>
        remove.mutateAsync(invite.id).then(() => toast({ title: "Removed from your invites" })).catch(fail("Couldn't remove")),
      );
    }
  };

  const filterLabel = (key: InviteFilter, name: string) => {
    if (key === "all") return `${name} ${counts.total}`;
    if (key === "approval" && counts.approval) return `${name} ${counts.approval}`;
    if (key === "waiting" && counts.waiting) return `${name} ${counts.waiting}`;
    if (key === "joined" && counts.joined) return `${name} ${counts.joined}`;
    return name;
  };

  return (
    <>
      <section className={cn(card, "gap-4")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className={cn(segGroup, "max-w-full overflow-x-auto [scrollbar-width:none]")} role="group" aria-label="Filter invites">
            {INVITE_FILTERS.map(([key, name]) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                className={cn(segButton(filter === key), "flex-none")}
                onClick={() => setFilter(key)}
              >
                {filterLabel(key, name)}
              </button>
            ))}
          </div>
          {!invites.isLoading && counts.total ? (
            <p className={meta}>
              {plural(counts.waiting, "invite")} waiting
              {counts.approval ? `, ${counts.approval} need${counts.approval === 1 ? "s" : ""} your approval` : ""}
            </p>
          ) : null}
        </div>
        {invites.isLoading ? (
          <p className={meta}>Loading…</p>
        ) : invites.isError ? (
          <p className={meta}>Couldn't load your invites. Refresh to try again.</p>
        ) : shown.length ? (
          <InvitesTable rows={shown} busyId={busyId} onAction={onAction} />
        ) : (
          <div className="rounded-[8px] border border-dashed border-[#C1C1B8] p-[18px] text-center text-[13px] text-[#767980]">
            No invites here.
          </div>
        )}
      </section>

      <FixEmailDialog
        invite={fixing ? { parent: parentName(fixing), email: fixing.client_email } : null}
        pending={fixEmail.isPending}
        onClose={() => setFixing(null)}
        onSave={(email) =>
          fixing &&
          fixEmail
            .mutateAsync({ referralId: fixing.id, email })
            .then(() => {
              setFixing(null);
              toast({ title: "New invite sent" });
            })
            .catch(fail("Couldn't send the new invite"))
        }
      />
      <DeclineDialog
        open={Boolean(declining)}
        pending={acknowledge.isPending}
        onClose={() => setDeclining(null)}
        onDecline={() =>
          declining &&
          acknowledge
            .mutateAsync({ referralId: declining.id, accept: false })
            .then(() => {
              setDeclining(null);
              toast({ title: "Sign-up declined" });
            })
            .catch(fail("Couldn't decline"))
        }
      />
    </>
  );
};

export default InvitesWorkList;
