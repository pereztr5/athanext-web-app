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
  athlete_first_name: string | null;
  invite_token: string | null;
  expires_at: string | null;
}

/** A row on the Invites page: the referral plus what get_coach_invites adds. */
export interface CoachInviteRow extends CoachClientReferral {
  invited_via?: "email" | "import" | "link" | "admin" | null;
  opened_at?: string | null;
  email_bounced_at?: string | null;
  resend_count?: number;
  updated_at?: string | null;
  athlete_name?: string | null;
  athlete_age?: number | null;
  marketplace_since?: string | null;
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
  athlete_first_name?: string;
}

export interface AddClientResult {
  email: string;
  status: string;
  invite_link?: string;
  emailed?: boolean;
}

const table = () => supabase.from("coach_client_referrals");

export const getCoachReferrals = async (coachId: string) =>
  (await table()
    .select("*")
    .eq("coach_id", coachId)
    .order("created_at", { ascending: false })) as unknown as {
    data: CoachClientReferral[] | null;
    error: { message: string } | null;
  };

/** The Invites page. Falls back to the plain table read until get_coach_invites is deployed. */
export const getCoachInvites = async (coachId: string): Promise<CoachInviteRow[]> => {
  const { data, error } = await supabase.rpc("get_coach_invites" as never);
  if (!error) return ((data as unknown as CoachInviteRow[]) ?? []);
  const fallback = await getCoachReferrals(coachId);
  if (fallback.error) throw new Error(fallback.error.message);
  return (fallback.data ?? []).filter((r) => !(r.initiated_by === "athlete" && r.status === "declined"));
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
  supabase.rpc("attest_coach_referral", {
    _referral_id: referralId,
    _answer: answer,
  });

export const claimReferral = async (token: string, answer: AttestationAnswer) =>
  (await supabase.rpc("claim_coach_referral", { _token: token, _answer: answer })) as unknown as {
    data: "confirmed" | "already_confirmed" | "declined" | null;
    error: { message: string } | null;
  };

export const acknowledgeReferral = async (referralId: string, accept: boolean) =>
  supabase.rpc("acknowledge_coach_referral", {
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
  supabase.rpc("register_athlete_referral", { _coach_id: coachId });

/** The coach's name for a share link sign-up (coaches are public). */
export const getCoachName = async (coachId: string) => {
  const { data } = await supabase.from("coaches").select("name").eq("id", coachId).maybeSingle();
  return (data?.name as string | undefined) ?? null;
};

export const getReferralInvite = async (token: string) =>
  (await supabase.rpc("get_referral_invite", { _token: token })) as unknown as {
    data: ReferralInvite[] | null;
    error: { message: string } | null;
  };
