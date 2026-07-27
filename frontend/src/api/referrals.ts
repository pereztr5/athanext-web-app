import { supabase } from "@/integrations/supabase/client";
import type { AttestationAnswer, ReferralStatus } from "@/utils/referralHelpers";

export interface CoachClientReferral {
  id: string;
  coach_id: string;
  client_email: string;
  athlete_id: string | null;
  initiated_by: "coach" | "athlete" | "admin";
  relationship_source: "offline" | "platform" | null;
  status: ReferralStatus;
  created_at: string;
  confirmed_at: string | null;
}

const table = () => supabase.from("coach_client_referrals" as any);

export const getCoachReferrals = async (coachId: string) =>
  (await table()
    .select("*")
    .eq("coach_id", coachId)
    .order("created_at", { ascending: false })) as unknown as {
    data: CoachClientReferral[] | null;
    error: { message: string } | null;
  };

export const getMyReferrals = async (athleteId: string) =>
  (await table()
    .select("*")
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false })) as unknown as {
    data: CoachClientReferral[] | null;
    error: { message: string } | null;
  };

export const getAllReferrals = async () =>
  (await table()
    .select("*")
    .order("created_at", { ascending: false })) as unknown as {
    data: CoachClientReferral[] | null;
    error: { message: string } | null;
  };

export const addClientReferrals = async (emails: string[], coachId?: string) =>
  supabase.functions.invoke("add-client-referral", {
    body: { client_emails: emails, ...(coachId ? { coach_id: coachId } : {}) },
  });

export const attestReferral = async (referralId: string, answer: AttestationAnswer) =>
  supabase.rpc("attest_coach_referral" as any, {
    _referral_id: referralId,
    _answer: answer,
  });

export const claimReferral = async (token: string, answer: AttestationAnswer) =>
  supabase.rpc("claim_coach_referral" as any, { _token: token, _answer: answer });

export const acknowledgeReferral = async (referralId: string, accept: boolean) =>
  supabase.rpc("acknowledge_coach_referral" as any, {
    _referral_id: referralId,
    _accept: accept,
  });

export const removeReferral = async (referralId: string) =>
  table().delete().eq("id", referralId);

export const createAthleteInitiatedReferral = async (input: {
  coachId: string;
  athleteId: string;
  email: string;
}) =>
  table().insert({
    coach_id: input.coachId,
    athlete_id: input.athleteId,
    client_email: input.email.trim().toLowerCase(),
    initiated_by: "athlete",
    relationship_source: "offline",
    status: "pending_confirmation",
  });
