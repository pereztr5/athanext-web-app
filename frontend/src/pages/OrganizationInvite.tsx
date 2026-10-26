/**
 * Org invite (ATH-90): a coach accepts or declines an invite to join an organization, or a new
 * rate the owner asked for. Links come from the organization-email function.
 */
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "@/components/icons";
import { organizationsAPI } from "@/api/organizations";
import { card, meta, primaryButton, secondaryButton } from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { rateLabel } from "@/utils/organizations";

const OrganizationInvitePage = () => {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const invite = useQuery({ queryKey: ["org-invite", token], queryFn: () => organizationsAPI.getInvite(token) });
  const respond = useMutation({
    mutationFn: (accept: boolean) => organizationsAPI.respond(token, accept),
    onSuccess: (_, accept) => {
      qc.invalidateQueries({ queryKey: ["org-invite", token] });
      qc.invalidateQueries({ queryKey: ["organizations-public"] });
      const inv = invite.data!;
      toast({
        title: accept
          ? inv.kind === "join"
            ? `You joined ${inv.organization}`
            : `New rate accepted: ${rateLabel(inv.rate)}`
          : "Declined",
      });
      if (accept) navigate(ROUTES.DASHBOARD);
    },
    onError: (e: Error) => toast({ title: "Couldn't save", description: e.message, variant: "destructive" }),
  });

  const inv = invite.data;
  const body = (() => {
    if (invite.isLoading) return <p className={meta}>Loading the invite…</p>;
    if (!inv)
      return (
        <>
          <b className="text-subtitle">Invite not found</b>
          <p className="text-body-m text-dark-300">
            It may be for a different email address. Sign in with the email the invite was sent to.
          </p>
        </>
      );
    if (inv.status !== "pending")
      return (
        <>
          <b className="text-subtitle">This invite is no longer open</b>
          <p className="text-body-m text-dark-300">
            It was {inv.status}. Ask {inv.owner} to send a new one if you need it.
          </p>
        </>
      );
    const blocked = !inv.isCoach ? "Sign in with your coach account to accept." : inv.kind === "join" && inv.inOtherOrg ? "You are already in another organization. Leave it before joining this one." : "";
    return (
      <>
        <b className="text-section">
          {inv.kind === "join" ? `Join ${inv.organization}` : `New rate from ${inv.organization}`}
        </b>
        <p className="max-w-[460px] text-paragraph text-dark-400">
          {inv.kind === "join"
            ? `${inv.owner} invited you to join ${inv.organization}. You keep your own profile, athletes and payouts.`
            : `${inv.owner} asked to change ${inv.organization}'s share of each paid session from ${rateLabel(inv.currentRate ?? 0)} to ${rateLabel(inv.rate)}. It applies to sessions booked after you accept, never to ones already paid.`}
        </p>
        {blocked ? <p className="text-body-m text-error-700">{blocked}</p> : null}
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className={secondaryButton} disabled={respond.isPending} onClick={() => respond.mutate(false)}>Decline</button>
          <button type="button" className={primaryButton} disabled={Boolean(blocked) || respond.isPending} onClick={() => respond.mutate(true)}>
            {inv.kind === "join" ? "Accept and join" : `Accept ${rateLabel(inv.rate)}`}
          </button>
        </div>
      </>
    );
  })();

  return (
    <div className="overflow-x-hidden px-4 pb-8 pt-1 md:px-5 md:pb-12">
      <div className="mx-auto flex w-full max-w-wrapper-focused flex-col gap-4 pt-6 md:gap-6">
        <section className={cn(card, "items-center py-10 text-center")}>
          <Building2 className="size-6 text-dark-300" strokeWidth={1.5} aria-hidden="true" />
          {body}
        </section>
        <Link to={ROUTES.DASHBOARD} className={cn(meta, "self-center hover:underline")}>Go to home</Link>
      </div>
    </div>
  );
};

export default OrganizationInvitePage;
