import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addClientReferrals,
  attestReferral,
  acknowledgeReferral,
  getCoachReferrals,
  getMyReferrals,
  removeReferral,
  type CoachClientReferral,
} from "@/api/referrals";
import type { AttestationAnswer } from "@/utils/referralHelpers";

export const REFERRAL_KEYS = {
  all: ["referrals"] as const,
  coach: (coachId: string) => ["referrals", "coach", coachId] as const,
  athlete: (athleteId: string) => ["referrals", "athlete", athleteId] as const,
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
    mutationFn: async (input: { emails: string[]; coachId?: string }) => {
      const { data, error } = await addClientReferrals(input.emails, input.coachId);
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
  const referral = data?.find((r) => r.coach_id === coachId) ?? null;
  return {
    waived: referral?.status === "confirmed",
    pendingReferral:
      referral?.status === "pending_confirmation" && referral.initiated_by === "coach"
        ? referral
        : null,
  };
};
