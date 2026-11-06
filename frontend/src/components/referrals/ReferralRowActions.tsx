import { errorMessage } from "@/utils/errorMessage";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useResendReferral } from "@/hooks/useReferrals";
import { inviteLinkFor, isInviteExpired, isOpenInvite } from "@/utils/referralHelpers";
import type { CoachClientReferral } from "@/api/referrals";
import { useCopyInviteLink } from "./useCopyInviteLink";

/** Copy link / Resend for an invite the athlete has not answered yet. */
export const ReferralRowActions = ({ referral: r }: { referral: CoachClientReferral }) => {
  const { toast } = useToast();
  const copyInviteLink = useCopyInviteLink();
  const resend = useResendReferral();
  const expired = isInviteExpired(r);

  if (!isOpenInvite(r)) return null;

  return (
    <>
      {r.invite_token && !expired ? (
        <Button size="sm" variant="outline" onClick={() => copyInviteLink(inviteLinkFor(r.invite_token!))}>
          Copy link
        </Button>
      ) : null}
      <Button
        size="sm"
        variant={expired ? "default" : "ghost"}
        disabled={resend.isPending}
        onClick={async () => {
          try {
            const data = await resend.mutateAsync(r.id);
            if (data?.invite_link) await copyInviteLink(data.invite_link);
          } catch (e) {
            toast({
              title: "Could not resend invite",
              description: errorMessage(e),
              variant: "destructive",
            });
          }
        }}
      >
        {resend.isPending ? "Resending…" : "Resend"}
      </Button>
    </>
  );
};
