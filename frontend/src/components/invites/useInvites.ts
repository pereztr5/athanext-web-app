import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCoachInvites, resendReferral } from "@/api/referrals";
import { rosterAPI } from "@/api/roster";
import { REFERRAL_KEYS } from "@/hooks/useReferrals";

// Under the referrals key, so sending invites from Add athlete refreshes this list too.
export const INVITES_KEY = (coachId: string) => [...REFERRAL_KEYS.all, "invites", coachId] as const;

export const useCoachInvites = (coachId: string | undefined) =>
  useQuery({
    queryKey: INVITES_KEY(coachId ?? ""),
    queryFn: () => getCoachInvites(coachId!),
    enabled: Boolean(coachId),
  });

const RESEND_ERRORS: Record<string, string> = {
  invite_resend_limit: "This invite was already resent 3 times",
  invite_not_resendable: "This invite can't be resent anymore",
};

export const resendErrorMessage = (message: string | undefined) => {
  const key = Object.keys(RESEND_ERRORS).find((k) => message?.includes(k));
  return key ? RESEND_ERRORS[key] : message || "Couldn't resend the invite";
};

/** Resend through add-client-referral; a new token is issued and emailed. */
export const useResendInvite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (referralId: string) => {
      const { data, error } = await resendReferral(referralId);
      // functions.invoke hides the JSON error body behind a generic message; read it back.
      if (error) {
        const context = (error as { context?: Response }).context;
        const body = context?.json ? await context.json().catch(() => null) : null;
        throw new Error(resendErrorMessage((body as { error?: string } | null)?.error ?? error.message));
      }
      return data;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: REFERRAL_KEYS.all }),
  });
};

/** Save the corrected address, then send a new invite to it. */
export const useFixInviteEmail = () => {
  const queryClient = useQueryClient();
  const resend = useResendInvite();
  return useMutation({
    mutationFn: async ({ referralId, email }: { referralId: string; email: string }) => {
      await rosterAPI.fixInviteEmail(referralId, email);
      return resend.mutateAsync(referralId);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: REFERRAL_KEYS.all }),
  });
};
