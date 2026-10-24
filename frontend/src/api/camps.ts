import { supabase } from "@/integrations/supabase/client";
import { campWaiverFileError } from "@/utils/camps";
import type { CampRegistrationMoneyRow } from "@/utils/campSessions";

/**
 * Camps for coaches (editor, publish, registrations) and the family portal.
 * Matches backend/supabase/migrations/20261021210000_camp_signup.sql and the camp-signup
 * edge function. The camp tables and RPCs are not in the generated types until that
 * migration is applied, so calls go through a loose client.
 *
 * Coach RPCs check current_coach_id(); family RPCs use the signed-in user.
 */

type LooseError = { code?: string; message?: string; hint?: string | null };
type Loose = { data: unknown; error: LooseError | null };

const db = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<Loose> };

export class CampError extends Error {
  /** Machine code from the database hint: group_full, camp_full, duplicate, stale, schedule_clash, group_has_athletes, spots_below_taken, rate_ip, ... */
  code: string | null;
  constructor(message: string, code: string | null = null) {
    super(message);
    this.code = code;
  }
}

const fail = (error: LooseError | null, fallback: string): never => {
  throw new CampError(error?.message || fallback, error?.hint ?? null);
};

const call = async <T>(fn: string, args: Record<string, unknown> | undefined, fallback: string): Promise<T> => {
  const { data, error } = await db.rpc(fn, args);
  if (error) fail(error, fallback);
  return data as T;
};

// ---------------------------------------------------------------------------
// Shapes (snake_case, exactly as the RPCs return them)
// ---------------------------------------------------------------------------

export type CampCoachRef = { id: string; name: string; slug: string | null; photo_url: string | null };

export type CampGroup = {
  id: string;
  name: string;
  description: string | null;
  /** "HH:MM", half hours between 07:00 and 21:00. */
  start_time: string;
  end_time: string;
  spots: number;
  /** Paid + held + open card Checkouts. */
  taken: number;
  sort_order: number;
};

/** camp_json(): what get_coach_camps, get_camp_editor, save_camp, publish_camp return. */
export type CoachCamp = {
  id: string;
  coach_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  starts_on: string | null;
  ends_on: string | null;
  days: number | null;
  location: string | null;
  /** Sum of group spots (legacy camps: their old capacity). */
  capacity: number | null;
  /** Spots taken in the whole camp, including camps bought from the profile. */
  taken: number;
  slug: string | null;
  coach_slug: string | null;
  cover_url: string | null;
  included: string[];
  tags: string[];
  pay_direct: boolean;
  /** The camp waiver (https), or null. Optional until the waiver migration is live. */
  waiver_url?: string | null;
  linked_coach: CampCoachRef | null;
  co_coach_ids: string[];
  age_min: number | null;
  age_max: number | null;
  is_active: boolean;
  published: boolean;
  published_at: string | null;
  created_at: string;
  /** Pass back to save() so a save from a stale tab is refused. */
  updated_at: string;
  groups: CampGroup[];
  /** get_coach_camps only. */
  paid_count?: number;
  waiting_count?: number;
  /** publish_camp only: group sessions now on My schedule. */
  schedule_sessions?: number;
};

export type CampGroupInput = {
  /** Omit for a new group. Saved groups left out of the list are deleted (refused when athletes hold a spot). */
  id?: string;
  /** Required when there are 2+ groups; a single unnamed group becomes "All athletes". */
  name: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  /** 1 to 60. */
  spots: number;
};

export type CampInputPayload = {
  name: string;
  description?: string | null;
  price_cents: number;
  /** "YYYY-MM-DD". Same day twice (or ends_on omitted) = one-day camp. Drafts may leave dates out. */
  starts_on?: string | null;
  ends_on?: string | null;
  location?: string | null;
  /** https URL; null = the coach's photo. */
  cover_url?: string | null;
  included?: string[];
  tags?: string[];
  /** Omitted: new camps on, saved camps unchanged. */
  pay_direct?: boolean;
  /** https link or uploaded PDF; null removes it; omitted = unchanged. */
  waiver_url?: string | null;
  linked_coach_id?: string | null;
  age_min?: number | null;
  age_max?: number | null;
  /** Org teammates; omitted = unchanged. */
  co_coach_ids?: string[];
  /** Only used when the camp is created; the link stays the same after renames. */
  slug?: string;
};

export type CampDisplayStatus = "paid_in_app" | "paid_outside" | "waiting" | "paying";

export type CampRegistrationRow = {
  id: string;
  signup_id: string;
  group_id: string | null;
  group_name: string | null;
  athlete_first_name: string;
  athlete_last_name: string;
  athlete_id: string | null;
  birth_year: number | null;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  note: string | null;
  waiver_accepted_at: string | null;
  photo_consent: boolean;
  source: "link" | "marketplace" | "coach";
  pay_method: "card" | "direct" | "outside";
  status: "pending_payment" | "held" | "paid";
  display_status: CampDisplayStatus;
  price_cents: number;
  paid_at: string | null;
  hold_expires_at: string | null;
  created_at: string;
  /** joined: has an AthaNext account; not_finished: "Account not finished · Resend link"; no_email: "Not on AthaNext yet · Invite family". */
  account: "joined" | "not_finished" | "no_email";
  finish_emailed_at: string | null;
  /** Latest family invite for the parent email ("Invite sent, not joined yet" / "Opened, not joined yet"). */
  invite: { id: string; status: "sent" | "opened" | "joined"; sent_at: string; opened_at: string | null; resend_count: number } | null;
};

export type CampRegistrations = {
  camp: CoachCamp;
  groups: Array<{ id: string; name: string; start_time: string; end_time: string; spots: number; taken: number; paid: number; waiting: number }>;
  /** Camps bought from the profile (no group, no registration row). */
  legacy_purchases: number;
  /** "Paid so far" and "Still to collect" (list price per athlete). */
  paid_cents: number;
  to_collect_cents: number;
  rows: CampRegistrationRow[];
};

export type AddCampAthleteInput = {
  campId: string;
  groupId: string;
  /** From My athletes: names, birth year and parent come from the profile. */
  athleteId?: string | null;
  firstName?: string;
  lastName?: string;
  birthYear?: number | null;
  parentEmail?: string | null;
  parentName?: string | null;
  /** Already paid -> Paid outside; not paid yet -> Waiting (no expiry). */
  paid: boolean;
  /** Email the parent the camp details (default true when there is an email). */
  sendDetails?: boolean;
  /** Send the usual family invite when the parent has no account (default true). */
  sendInvite?: boolean;
};

export type AddCampAthleteResult = {
  id: string;
  signup_id: string;
  status: "paid" | "held";
  athlete_first_name: string;
  parent_email: string | null;
  parent_name: string | null;
  has_account: boolean;
  invite_needed: boolean;
  invited: boolean;
  emailed: boolean;
};

export type MyCamp = {
  camp_id: string;
  name: string;
  description: string | null;
  starts_on: string | null;
  ends_on: string | null;
  location: string | null;
  included: string[];
  cover_url: string | null;
  slug: string | null;
  coach: CampCoachRef;
  athletes: Array<{
    registration_id: string;
    athlete_id: string | null;
    first_name: string;
    last_name: string;
    group_name: string | null;
    start_time: string | null;
    end_time: string | null;
    status: "pending_payment" | "held" | "paid";
    pay_method: "card" | "direct" | "outside";
  }>;
};

/** A schedule session from get_coach_schedule that is a camp day (session.camp). */
export type CampDayInfo = {
  id: string;
  name: string;
  slug: string | null;
  days_total: number;
  group_name: string | null;
  group_spots: number | null;
  signed_up: number | null;
};

const invokeCampFunction = async <T>(body: Record<string, unknown>, fallback: string): Promise<T> => {
  const { data, error } = await supabase.functions.invoke("camp-signup", { body });
  if (error) {
    const context = (error as { context?: Response }).context;
    let message = fallback;
    let code: string | null = null;
    if (context && typeof context.clone === "function") {
      try {
        const parsed = (await context.clone().json()) as { error?: string; code?: string };
        if (parsed?.error) message = parsed.error;
        code = parsed?.code ?? null;
      } catch {
        // body already read
      }
    }
    throw new CampError(message, code);
  }
  return data as T;
};

export const campsAPI = {
  // ---------- Coach: camps ----------
  /** The signed-in coach's camps (profile row "Sessions, packages and camps", My schedule). */
  list: () => call<CoachCamp[]>("get_coach_camps", undefined, "Could not load your camps."),

  editor: (campId: string) => call<CoachCamp>("get_camp_editor", { p_camp_id: campId }, "Could not open this camp."),

  /** "Run a camp again": the two most recent camps, dates left empty. */
  runAgain: () => call<CoachCamp[]>("get_camp_run_again", undefined, "Could not load your camps."),

  /**
   * Creates (campId null) or updates a camp and its full group list in one transaction.
   * expectedUpdatedAt: the updated_at the editor loaded; another tab's newer save raises code "stale".
   * A published camp's schedule days are rebuilt.
   */
  save: (campId: string | null, camp: CampInputPayload, groups: CampGroupInput[], expectedUpdatedAt?: string | null) =>
    call<CoachCamp>(
      "save_camp",
      { p_camp_id: campId, p_camp: camp, p_groups: groups, p_expected_updated_at: expectedUpdatedAt ?? null },
      "That didn't save. Try again.",
    ),

  /** Live at /<coach>/<camp>, one group session per group per day on My schedule. */
  publish: (campId: string) => call<CoachCamp>("publish_camp", { p_camp_id: campId }, "Could not publish this camp."),

  unpublish: (campId: string) => call<CoachCamp>("unpublish_camp", { p_camp_id: campId }, "Could not unpublish this camp."),

  /** My Business > Camps: the coach's registrations (RLS: their own), summed by campMoneySummary. */
  async moneyRows(coachId: string): Promise<CampRegistrationMoneyRow[]> {
    const { data, error } = await supabase
      .from("camp_registrations")
      .select("status, pay_method, price_cents, created_at")
      .eq("coach_id", coachId)
      .in("status", ["held", "paid"]);
    if (error) throw new CampError("Could not load camp payments.");
    return (data ?? []) as CampRegistrationMoneyRow[];
  },

  /** Cover photo for the camp page (public URL for save()). */
  async uploadCover(file: File): Promise<string> {
    if (!file.type.startsWith("image/")) throw new CampError("Choose a JPG, PNG or WebP photo.");
    if (file.size > 8 * 1024 * 1024) throw new CampError("The photo must be under 8 MB.");
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `camps/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("athalink-images")
      .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
    if (error) throw new CampError(error.message || "The photo didn't upload. Try again.");
    return supabase.storage.from("athalink-images").getPublicUrl(path).data.publicUrl;
  },

  /** Camp waiver PDF (public URL for save()). Up to 10 MB. */
  async uploadWaiver(file: File): Promise<string> {
    const error = campWaiverFileError(file);
    if (error) throw new CampError(error);
    const path = `camp-waivers/${crypto.randomUUID()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("athalink-images")
      .upload(path, file, { cacheControl: "3600", upsert: false, contentType: "application/pdf" });
    if (uploadError) throw new CampError(uploadError.message || "The waiver didn't upload. Try again.");
    return supabase.storage.from("athalink-images").getPublicUrl(path).data.publicUrl;
  },

  // ---------- Coach: registrations ----------
  registrations: (campId: string) =>
    call<CampRegistrations>("get_camp_registrations", { p_camp_id: campId }, "Could not load registrations."),

  /** Direct / outside rows only. Card rows are confirmed by Stripe. */
  markPaid: (registrationId: string) =>
    call<{ id: string; status: "paid" }>("mark_camp_registration_paid", { p_id: registrationId }, "That didn't save."),

  /** Frees the spot. A card-paid row must be refunded first (code "card_paid"). */
  cancel: (registrationId: string) =>
    call<{ id: string; status: string }>("cancel_camp_registration", { p_id: registrationId }, "That didn't save."),

  /** Adds an athlete (takes a spot), then sends the family invite and camp details email. */
  addAthlete: (input: AddCampAthleteInput) =>
    invokeCampFunction<AddCampAthleteResult>(
      {
        action: "coach_add",
        camp_id: input.campId,
        group_id: input.groupId,
        athlete_id: input.athleteId ?? null,
        first_name: input.firstName ?? null,
        last_name: input.lastName ?? null,
        birth_year: input.birthYear ?? null,
        parent_email: input.parentEmail ?? null,
        parent_name: input.parentName ?? null,
        paid: input.paid,
        send_details: input.sendDetails ?? true,
        send_invite: input.sendInvite ?? true,
      },
      "Could not add this athlete.",
    ),

  /** "Account not finished · Resend link". Throttled to once per 10 minutes per row. */
  resendFinishLink: (registrationId: string) =>
    invokeCampFunction<{ emailed: boolean; reason?: string }>({ action: "resend_finish", registration_id: registrationId }, "Could not send the link."),

  /** Camp details email for a coach-added athlete. */
  sendDetails: (registrationId: string) =>
    invokeCampFunction<{ emailed: boolean }>({ action: "send_details", registration_id: registrationId }, "Could not send the email."),

  /** Resend the family invite shown on a row (row.invite.id). */
  resendInvite: (referralId: string) =>
    invokeCampFunction<{ invite_link?: string; emailed?: boolean }>({ action: "resend_invite", referral_id: referralId }, "Could not resend the invite."),

  // ---------- Family ----------
  /** Call after sign-up / sign-in: links registrations made with this (confirmed) email. */
  claim: () =>
    call<{ claimed: number; athletes_created: number; email_confirmed: boolean }>(
      "claim_camp_registrations",
      undefined,
      "Could not link your camp sign-ups.",
    ),

  /** Family portal: camps with each athlete's group, time and status. */
  myCamps: () => call<MyCamp[]>("get_my_camps", undefined, "Could not load your camps."),
};
