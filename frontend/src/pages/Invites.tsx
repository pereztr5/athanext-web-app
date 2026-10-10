/**
 * Invites (Working Copy `c-invites`, replaces My Clients): families the coach invited to book
 * them with no marketplace fee. Link sign-ups wait here for approval; bounced invites get a
 * corrected address; marketplace clients explain why the standard fee stays.
 */
import { useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, FileUp, Info, Link2, ShieldCheck, UserPlus } from "lucide-react";
import { AddAthleteModal } from "@/components/athletes/AddAthleteModal";
import { DeclineDialog, FixEmailDialog, WhyFeeDialog } from "@/components/invites/InviteDialogs";
import { InvitesTable, type InviteAction } from "@/components/invites/InvitesTable";
import {
  INVITE_FILTERS, inviteCounts, inviteStatus, matchesFilter, parentName, athleteFirst, type InviteFilter,
} from "@/components/invites/inviteStatus";
import { useCoachInvites, useFixInviteEmail, useResendInvite } from "@/components/invites/useInvites";
import { useCopyInviteLink } from "@/components/referrals/useCopyInviteLink";
import { card, label, meta, pageTitle, primaryButton, secondaryButton, segButton, segGroup, smallButton, textButton } from "@/components/schedule/styles";
import type { CoachInviteRow } from "@/api/referrals";
import { useProfile } from "@/contexts/ProfileContext";
import { useToast } from "@/hooks/use-toast";
import { useAcknowledgeReferral, useRemoveReferral } from "@/hooks/useReferrals";
import { useRole } from "@/hooks/useRole";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { joinLinkFor } from "@/utils/referralHelpers";
import { plural } from "@/utils/schedule";

const STEPS = [
  "Invite the parent by email, import or your link.",
  "They accept and add their athlete.",
  "Sessions they book with you carry no marketplace fee.",
];

const sinceLabel = (iso: string | null | undefined) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;

const Invites = () => {
  const { isCoach, ready } = useRole();
  const [searchParams] = useSearchParams();
  const [adding, setAdding] = useState(searchParams.get("onboarding") === "1");
  const [addTab, setAddTab] = useState<"email" | "import">("email");
  const [filter, setFilter] = useState<InviteFilter>("all");
  const [fixing, setFixing] = useState<CoachInviteRow | null>(null);
  const [declining, setDeclining] = useState<CoachInviteRow | null>(null);
  const [why, setWhy] = useState<CoachInviteRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { profile } = useProfile();
  const coachId = profile?.userProfile?.coach_id ?? undefined;
  const invites = useCoachInvites(coachId);
  const acknowledge = useAcknowledgeReferral();
  const remove = useRemoveReferral();
  const resend = useResendInvite();
  const fixEmail = useFixInviteEmail();
  const copyInviteLink = useCopyInviteLink();
  const { toast } = useToast();

  const rows = useMemo(() => (invites.data ?? []).map((invite) => ({ invite, status: inviteStatus(invite) })), [invites.data]);
  const counts = inviteCounts(rows.map((r) => r.status));
  const shown = rows.filter((r) => matchesFilter(r.status, filter));

  if (!ready) return null;
  if (!isCoach) return <Navigate to={ROUTES.BOOK} replace />;

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
    if (action === "why") return setWhy(invite);
    if (action === "decline") return setDeclining(invite);
    if (action === "approve") {
      const athlete = athleteFirst(invite) ?? "Their athlete";
      return track(invite.id, () =>
        acknowledge
          .mutateAsync({ referralId: invite.id, accept: true })
          .then(() => toast({ title: `${parent} approved`, description: `${athlete} is on your roster with no marketplace fee.` }))
          .catch(fail("Couldn't approve")),
      );
    }
    if (action === "resend") {
      return track(invite.id, () =>
        resend
          .mutateAsync(invite.id)
          .then((data) => {
            // No email went out (mail not set up): hand the coach the new link instead.
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

  const copyLink = async () => {
    if (!coachId) return;
    try {
      await navigator.clipboard.writeText(joinLinkFor(coachId));
      toast({ title: "Invite link copied", description: "Families who sign up through it appear here for you to approve." });
    } catch {
      toast({ title: "Copy failed", description: joinLinkFor(coachId), variant: "destructive" });
    }
  };

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-[980px] flex-col gap-5">
        <Link to={ROUTES.ATHLETES} className={cn(textButton, "self-start text-[#767980]")}>
          <ChevronLeft strokeWidth={1.5} aria-hidden="true" />
          My Athletes
        </Link>
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-[10px]">
            <h1 className={pageTitle}>Invites</h1>
            <p className="text-[14px] leading-[18px] text-[#767980]">Families you invited to book you on AthaNext</p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <button type="button" className={secondaryButton} onClick={copyLink} disabled={!coachId}>
              <Link2 strokeWidth={1.5} aria-hidden="true" />
              Copy invite link
            </button>
            <button type="button" className={primaryButton} onClick={() => { setAddTab("email"); setAdding(true); }}>
              <UserPlus strokeWidth={1.5} aria-hidden="true" />
              Invite families
            </button>
          </div>
        </header>

        <section className={cn(card, "flex-row flex-wrap items-stretch gap-x-10 gap-y-4")}>
          <div className="flex min-w-[240px] flex-1 flex-col gap-3">
            <span className={label}>Existing clients</span>
            <span className="text-[28px] font-bold leading-[30px] tracking-[-0.05em]">Bring your clients to AthaNext</span>
            <p className="max-w-[460px] text-[14px] leading-[18px] text-[#767980]">
              Families you invite book you here with no marketplace fee. Your rates, schedule and relationships stay yours.
            </p>
            {/* Add athlete has no initial-tab prop yet; Import a list is one tab away. */}
            <button type="button" className={cn(secondaryButton, smallButton, "self-start")} onClick={() => { setAddTab("import"); setAdding(true); }}>
              <FileUp strokeWidth={1.5} aria-hidden="true" />
              Import from a spreadsheet
            </button>
          </div>
          <div className="flex w-full flex-col justify-center gap-2.5 border-t border-[#EAEADF] pt-4 md:w-[280px] md:border-l md:border-t-0 md:pl-10 md:pt-0">
            <span className="text-[32px] font-bold leading-[30px] tracking-[-0.03em] tabular-nums">
              {counts.joined} of {counts.total}
            </span>
            <span className={meta}>invited families have joined</span>
            <div className="h-[5px] overflow-hidden rounded-[10px] bg-[#D9D9CF]" role="progressbar" aria-valuemin={0} aria-valuemax={counts.total} aria-valuenow={counts.joined} aria-label="Invited families who joined">
              <i className="block h-full rounded-[10px] bg-[#0054B4]" style={{ width: `${(counts.joined / Math.max(1, counts.total)) * 100}%` }} />
            </div>
            <span className={meta}>
              {plural(counts.waiting, "invite")} waiting, {counts.approval} need{counts.approval === 1 ? "s" : ""} your approval
            </span>
          </div>
        </section>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <section className={cn(card, "min-w-0 gap-4 lg:flex-[659_1_0]")}>
            <div className={cn(segGroup, "max-w-full self-start overflow-x-auto [scrollbar-width:none]")} role="group" aria-label="Filter invites">
              {INVITE_FILTERS.map(([key, name]) => (
                <button key={key} type="button" aria-pressed={filter === key} className={cn(segButton(filter === key), "flex-none")} onClick={() => setFilter(key)}>
                  {key === "all" ? `${name} ${counts.total}` : name}
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
              <div className="rounded-[8px] border border-dashed border-[#C1C1B8] p-[18px] text-center text-[13px] text-[#767980]">No invites here.</div>
            )}
          </section>

          <div className="flex min-w-0 flex-col gap-6 lg:flex-[317_1_0]">
            <section className={card}>
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 flex-none" strokeWidth={1.5} aria-hidden="true" />
                <h2 className="text-[20px] font-medium leading-[18px] tracking-[-0.05em]">How no-fee clients work</h2>
              </div>
              {STEPS.map((step, i) => (
                <div key={step} className="flex items-start gap-3 text-[14px] leading-[18px]">
                  <span className="flex size-[22px] flex-none items-center justify-center rounded-full bg-[#F1F1E6] text-[12px] font-medium text-[#484D56]">{i + 1}</span>
                  <span>{step}</span>
                </div>
              ))}
              <div className="flex items-start gap-2.5 rounded-[8px] bg-[#F4F4EB] px-3.5 py-3 text-[12px] leading-[14px] text-[#767980]">
                <Info className="size-4 flex-none" strokeWidth={1.5} aria-hidden="true" />
                <span>Families who first booked you through the marketplace keep the standard fee. Link sign-ups wait for your approval.</span>
              </div>
            </section>
          </div>
        </div>
      </div>

      <AddAthleteModal open={adding} onClose={() => setAdding(false)} coachId={coachId} initialTab={addTab} />
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
      <WhyFeeDialog parent={why ? parentName(why) : null} since={sinceLabel(why?.marketplace_since)} onClose={() => setWhy(null)} />
    </div>
  );
};

export default Invites;
