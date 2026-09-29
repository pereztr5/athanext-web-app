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
  client_name: string | null;
  invite_token: string | null;
  expires_at: string | null;
}

export interface ReferralInvite {
  coach_id: string;
  coach_name: string;
  coach_slug: string | null;
  client_name: string | null;
  masked_email: string;
  state: "valid" | "expired" | "used";
  email_matches: boolean;
  is_athlete: boolean;
}

export interface ClientInviteInput {
  name: string;
  email: string;
}

export interface AddClientResult {
  email: string;
  status: string;
  invite_link?: string;
  emailed?: boolean;
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

export const addClientReferrals = async (clients: ClientInviteInput[], coachId?: string) =>
  supabase.functions.invoke<{ results: AddClientResult[] }>("add-client-referral", {
    body: { clients, ...(coachId ? { coach_id: coachId } : {}) },
  });

export const resendReferral = async (referralId: string) =>
  supabase.functions.invoke<{ invite_link: string; emailed: boolean }>("add-client-referral", {
    body: { action: "resend", referral_id: referralId },
  });

export const attestReferral = async (referralId: string, answer: AttestationAnswer) =>
  supabase.rpc("attest_coach_referral" as any, {
    _referral_id: referralId,
    _answer: answer,
  });

export const claimReferral = async (token: string, answer: AttestationAnswer) =>
  (await supabase.rpc("claim_coach_referral" as any, { _token: token, _answer: answer })) as unknown as {
    data: "confirmed" | "already_confirmed" | "declined" | null;
    error: { message: string } | null;
  };

export const acknowledgeReferral = async (referralId: string, accept: boolean) =>
  supabase.rpc("acknowledge_coach_referral" as any, {
    _referral_id: referralId,
    _accept: accept,
  });

/** Admin override (RLS: ccr_admin_all). Without a linked athlete the token stays
 * live so the athlete links the row when they sign up with that email. */
export const adminConfirmReferral = async (referral: Pick<CoachClientReferral, "id" | "athlete_id">) =>
  table()
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      ...(referral.athlete_id ? { invite_token: null } : {}),
    })
    .eq("id", referral.id);

export const removeReferral = async (referralId: string) =>
  table().delete().eq("id", referralId);

export const createAthleteInitiatedReferral = async (coachId: string) =>
  supabase.rpc("register_athlete_referral" as any, { _coach_id: coachId });

export const getReferralInvite = async (token: string) =>
  (await supabase.rpc("get_referral_invite" as any, { _token: token })) as unknown as {
    data: ReferralInvite[] | null;
    error: { message: string } | null;
  };
