/**
 * Invites (WC4 `c-invites`): hero with the joined count, the work list (Needs approval,
 * Waiting, Joined, All; one action per row) and the "How no-fee clients work" side card.
 * Marketplace families stay on the roster only; they do not appear here.
 * Mounted as the invites view of My athletes (`?tab=invites`); `/invites` redirects there.
 */
import { useMemo, useState } from "react";
import { FileUp, Info, ShieldCheck } from "@/components/icons";
import { Progress } from "@/components/ui/progress";
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
import { card, label, meta, secondaryButton, segButton, segGroup, smallButton } from "@/components/schedule/styles";
import type { CoachInviteRow } from "@/api/referrals";
import { useToast } from "@/hooks/use-toast";
import { useAcknowledgeReferral, useRemoveReferral } from "@/hooks/useReferrals";
import { cn } from "@/lib/utils";
import { plural } from "@/utils/schedule";

/** Work-list rows (marketplace families excluded) with their display status. */
const useInviteRows = (coachId: string | undefined) => {
  const invites = useCoachInvites(coachId);
  const rows = useMemo(
    () =>
      (invites.data ?? [])
        .map((invite) => ({ invite, status: inviteStatus(invite) }))
        .filter((r) => isInviteWorkStatus(r.status)),
    [invites.data],
  );
  return { invites, rows, counts: inviteCounts(rows.map((r) => r.status)) };
};

/** Invites the family hasn't finished (sent, opened, bounced, needs approval): the "N pending invites" link. */
export const usePendingInviteCount = (coachId: string | undefined) => {
  const { rows } = useInviteRows(coachId);
  return rows.filter((r) => r.status === "sent" || r.status === "opened" || r.status === "bounced" || r.status === "approval").length;
};

/** The full invites view: hero, then the work list beside the no-fee explainer. */
export const InvitesView = ({ coachId, onImport }: { coachId: string | undefined; onImport?: () => void }) => {
  const { invites, counts } = useInviteRows(coachId);
  const pct = counts.total ? Math.round((counts.joined / counts.total) * 100) : 0;
  return (
    <>
      <section className={cn(card, "gap-6 md:flex-row md:flex-wrap md:items-stretch md:gap-10")}>
        <div className="flex min-w-[240px] flex-1 flex-col gap-3">
          <span className={label}>Existing clients</span>
          <span className="text-highlight text-dark">Bring your clients to AthaNext</span>
          <p className="max-w-[460px] text-paragraph text-dark-300">
            Families you invite book you here with no marketplace fee. Your rates, schedule and relationships stay yours.
          </p>
          {onImport ? (
            <button type="button" className={cn(secondaryButton, smallButton, "self-start")} onClick={onImport}>
              <FileUp strokeWidth={1.5} aria-hidden="true" />
              Import from a spreadsheet
            </button>
          ) : null}
        </div>
        <div className="flex flex-col justify-center gap-2.5 border-t border-light-525 pt-4 md:w-[280px] md:border-l md:border-t-0 md:pl-10 md:pt-0">
          {invites.isLoading ? (
            <span className={meta}>Loading…</span>
          ) : invites.isError ? (
            <span className={meta}>Couldn't load your invites. Refresh to try again.</span>
          ) : (
            <>
              <span className="text-stat tabular-nums text-dark">{counts.joined} of {counts.total}</span>
              <span className={meta}>invited {counts.total === 1 ? "family has" : "families have"} joined</span>
              <Progress value={pct} aria-label={`${counts.joined} of ${counts.total} invited families have joined`} />
              <span className={meta}>
                {plural(counts.waiting, "invite")} waiting, {counts.approval} need{counts.approval === 1 ? "s" : ""} your approval
              </span>
            </>
          )}
        </div>
      </section>
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,659fr)_minmax(0,317fr)]">
        <div className="flex min-w-0 flex-col">
          <InvitesWorkList coachId={coachId} />
        </div>
        <div className="flex min-w-0 flex-col">
          <NoFeeCard />
        </div>
      </div>
    </>
  );
};

const NO_FEE_STEPS = [
  "Invite the parent by email, import or your link.",
  "They accept and add their athlete.",
  "Sessions they book with you carry no marketplace fee.",
];

const NoFeeCard = () => (
  <section className={cn(card, "gap-4")}>
    <h2 className="flex items-center gap-2 text-card-title text-dark">
      <ShieldCheck className="size-5 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
      How no-fee clients work
    </h2>
    <ol className="flex flex-col gap-3">
      {NO_FEE_STEPS.map((step, i) => (
        <li key={step} className="flex items-start gap-3 text-body-m text-dark">
          <span className="flex size-[22px] flex-none items-center justify-center rounded-full bg-light text-label-xsm text-dark-400" aria-hidden="true">
            {i + 1}
          </span>
          <span className="pt-0.5">{step}</span>
        </li>
      ))}
    </ol>
    <div className="flex items-start gap-2.5 rounded-control border border-light-525 bg-light-400 px-3.5 py-3 text-paragraph-sm text-dark-300">
      <Info className="size-4 flex-none text-dark-300" strokeWidth={1.5} aria-hidden="true" />
      <span>Families who first booked you through the marketplace keep the standard fee. Link sign-ups wait for your approval.</span>
    </div>
  </section>
);

export const InvitesWorkList = ({ coachId }: { coachId: string | undefined }) => {
  const [filter, setFilter] = useState<InviteFilter>("approval");
  const [fixing, setFixing] = useState<CoachInviteRow | null>(null);
  const [declining, setDeclining] = useState<CoachInviteRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { invites, rows, counts } = useInviteRows(coachId);
  const acknowledge = useAcknowledgeReferral();
  const remove = useRemoveReferral();
  const resend = useResendInvite();
  const fixEmail = useFixInviteEmail();
  const copyInviteLink = useCopyInviteLink();
  const { toast } = useToast();

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
        <div className={cn(segGroup, "w-fit max-w-full overflow-x-auto [scrollbar-width:none]")} role="group" aria-label="Filter invites">
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
        {invites.isLoading ? (
          <p className={meta}>Loading…</p>
        ) : invites.isError ? (
          <p className={meta}>Couldn't load your invites. Refresh to try again.</p>
        ) : shown.length ? (
          <InvitesTable rows={shown} busyId={busyId} onAction={onAction} />
        ) : (
          <div className="rounded-card border border-dashed border-light-600 p-[18px] text-center text-body-m text-dark-300">
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

export default InvitesView;
