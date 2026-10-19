import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "@/components/icons";
import { rosterAPI, type OpenInvite } from "@/api/roster";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  dialogContent, input, label, meta, primaryButton, secondaryButton, smallButton, textButton,
} from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { useAcknowledgeReferral, useResendReferral, REFERRAL_KEYS } from "@/hooks/useReferrals";
import { cn } from "@/lib/utils";
import { EMAIL_RE } from "@/utils/invites";
import { INVITE_STATUS, INVITES_PATH, OPEN_INVITES_KEY, inviteLine } from "./invites";
import { avatar, initials } from "./styles";

/** The in-page invites tab (Working Copy `ath.tab = invites`). */
export const RosterInvites = ({ invites }: { invites: OpenInvite[] }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const approve = useAcknowledgeReferral();
  const resend = useResendReferral();
  const [fixing, setFixing] = useState<OpenInvite | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: OPEN_INVITES_KEY });
    queryClient.invalidateQueries({ queryKey: REFERRAL_KEYS.all });
  };
  const fail = (title: string) => (e: unknown) =>
    toast({ title, description: e instanceof Error ? e.message : undefined, variant: "destructive" });

  const act = (invite: OpenInvite) => {
    if (invite.status === "approval") {
      approve.mutate(
        { referralId: invite.id, accept: true },
        {
          onSuccess: () => {
            refresh();
            queryClient.invalidateQueries({ queryKey: ["coach-roster"] });
            toast({ title: `${invite.parent} approved`, description: `${invite.athlete ?? "Their athlete"} joined your roster and can book you directly.` });
          },
          onError: fail("Couldn't approve"),
        },
      );
    } else if (invite.status === "bounced") {
      setFixing(invite);
    } else {
      resend.mutate(invite.id, {
        onSuccess: (data) => {
          refresh();
          toast({ title: data?.emailed === false ? "Invite renewed, but the email didn't go out" : `Invite resent to ${invite.parent}` });
        },
        onError: fail("Couldn't resend the invite"),
      });
    }
  };

  const busy = (invite: OpenInvite) =>
    (approve.isPending && approve.variables?.referralId === invite.id) || (resend.isPending && resend.variables === invite.id);

  return (
    <>
      <div className="flex flex-col">
        {invites.length ? invites.map((invite) => {
          const status = INVITE_STATUS[invite.status];
          return (
            <div key={invite.id} className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-light-525 py-3 text-body-m last:border-b-0 md:gap-4">
              <span className={avatar} aria-hidden="true">{initials(invite.parent)}</span>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate font-medium">{invite.parent}</span>
                <span className="text-caption text-dark-300">{inviteLine(invite)}</span>
              </div>
              <button
                type="button"
                className={cn(status.primary ? primaryButton : secondaryButton, smallButton)}
                disabled={busy(invite)}
                onClick={() => act(invite)}
              >
                {status.action}
              </button>
            </div>
          );
        }) : <p className="text-body-m text-dark-300">No open invites.</p>}
      </div>
      <Link to={INVITES_PATH} className={cn(textButton, "self-start")}>
        All invites and history
        <ChevronRight strokeWidth={1.5} aria-hidden="true" />
      </Link>
      <FixEmailDialog invite={fixing} onClose={() => setFixing(null)} onSaved={refresh} />
    </>
  );
};

/** Fix email address for a bounced invite; saving sends a new invite. */
const FixEmailDialog = ({ invite, onClose, onSaved }: { invite: OpenInvite | null; onClose: () => void; onSaved: () => void }) => {
  const { toast } = useToast();
  const resend = useResendReferral();
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const bad = !EMAIL_RE.test(email.trim());
  const save = useMutation({
    mutationFn: async () => {
      await rosterAPI.fixInviteEmail(invite!.id, email.trim());
      await resend.mutateAsync(invite!.id);
    },
    onSuccess: () => {
      onSaved();
      toast({ title: "New invite sent" });
      onClose();
    },
    onError: (e) => toast({ title: "Couldn't save the email", description: e instanceof Error ? e.message : undefined, variant: "destructive" }),
  });

  return (
    <Dialog
      open={Boolean(invite)}
      onOpenChange={(o) => !o && onClose()}
    >
      <DialogContent
        className={dialogContent}
        onOpenAutoFocus={() => {
          setEmail(invite?.email ?? "");
          setTouched(false);
        }}
      >
        <DialogHeader className="gap-1.5 border-b border-light-525 px-4 py-5 pr-14 text-left sm:px-[25px]">
          <DialogTitle className="text-card-title sm:text-section">Fix email address</DialogTitle>
          <DialogDescription className={meta}>The invite to {invite?.parent} bounced</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-4 py-5 sm:px-[25px]">
          <label className="flex flex-col gap-1.5">
            <span className={label}>Parent email</span>
            <input
              className={cn(input, touched && bad && "ring-[1.5px] ring-error-600")}
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
            />
            {touched && bad ? <span className="text-caption text-error-700">Enter a valid email</span> : null}
          </label>
          <p className="text-caption text-dark-300">Saving sends a new invite.</p>
        </div>
        <div className="flex justify-end gap-2.5 border-t border-light-525 px-4 py-4 sm:px-[25px]">
          <button type="button" className={secondaryButton} onClick={onClose}>Cancel</button>
          <button
            type="button"
            className={primaryButton}
            disabled={save.isPending}
            onClick={() => (bad ? setTouched(true) : save.mutate())}
          >
            {save.isPending ? "Saving…" : "Save and resend"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
