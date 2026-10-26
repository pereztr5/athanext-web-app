import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addClientReferrals,
  attestReferral,
  acknowledgeReferral,
  claimReferral,
  resendReferral,
  getCoachReferrals,
  getMyReferrals,
  getReferralInvite,
  removeReferral,
  type ClientInviteInput,
  type CoachClientReferral,
} from "@/api/referrals";
import { useAuth } from "@/contexts/AuthContext";
import type { AttestationAnswer } from "@/utils/referralHelpers";

export const REFERRAL_KEYS = {
  all: ["referrals"] as const,
  coach: (coachId: string) => ["referrals", "coach", coachId] as const,
  athlete: (athleteId: string) => ["referrals", "athlete", athleteId] as const,
};

/** Public view of an invite link; `email_matches` depends on who is signed in. */
export const useReferralInvite = (token: string | null | undefined) => {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["referral-invite", token, user?.id ?? null],
    queryFn: async () => {
      const { data, error } = await getReferralInvite(token!);
      if (error) throw new Error(error.message);
      return data?.[0] ?? null;
    },
    enabled: !!token,
  });
  return { invite: data ?? null, isLoading: Boolean(token) && isLoading };
};

export const useCoachReferrals = (coachId: string | undefined) =>
  useQuery({
    queryKey: REFERRAL_KEYS.coach(coachId ?? ""),
    queryFn: async () => {
      const { data, error } = await getCoachReferrals(coachId!);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!coachId,
  });

export const useMyReferrals = (athleteId: string | undefined) =>
  useQuery({
    queryKey: REFERRAL_KEYS.athlete(athleteId ?? ""),
    queryFn: async () => {
      const { data, error } = await getMyReferrals(athleteId!);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!athleteId,
  });

const useInvalidateReferrals = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: REFERRAL_KEYS.all });
};

export const useAddClientReferrals = () => {
  const invalidate = useInvalidateReferrals();
  return useMutation({
    mutationFn: async (input: { clients: ClientInviteInput[]; coachId?: string }) => {
      const { data, error } = await addClientReferrals(input.clients, input.coachId);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: invalidate,
  });
};

export const useAttestReferral = () => {
  const invalidate = useInvalidateReferrals();
  return useMutation({
    mutationFn: async (input: { referralId: string; answer: AttestationAnswer }) => {
      const { error } = await attestReferral(input.referralId, input.answer);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
};

export const useAcknowledgeReferral = () => {
  const invalidate = useInvalidateReferrals();
  return useMutation({
    mutationFn: async (input: { referralId: string; accept: boolean }) => {
      const { error } = await acknowledgeReferral(input.referralId, input.accept);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
};

export const useResendReferral = () => {
  const invalidate = useInvalidateReferrals();
  return useMutation({
    mutationFn: async (referralId: string) => {
      const { data, error } = await resendReferral(referralId);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: invalidate,
  });
};

export const useClaimReferral = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { token: string; answer: AttestationAnswer }) => {
      const { data, error } = await claimReferral(input.token, input.answer);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REFERRAL_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ["referral-invite"] });
    },
  });
};

export const useRemoveReferral = () => {
  const invalidate = useInvalidateReferrals();
  return useMutation({
    mutationFn: async (referralId: string) => {
      const { error } = await removeReferral(referralId);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
};

/** Waiver state for the current athlete against one coach (checkout surfaces). */
export const useReferralWaiver = (
  athleteId: string | undefined,
  coachId: string | undefined,
): { waived: boolean; pendingReferral: CoachClientReferral | null } => {
  const { data } = useMyReferrals(athleteId);
  const forCoach = data?.filter((r) => r.coach_id === coachId) ?? [];
  const referral =
    forCoach.find((r) => r.status === "confirmed") ?? forCoach[0] ?? null;
  return {
    waived: referral?.status === "confirmed",
    pendingReferral:
      referral?.status === "pending_confirmation" && referral.initiated_by === "coach"
        ? referral
        : null,
  };
};
