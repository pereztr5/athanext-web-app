/**
 * Coach My Athletes (ATH-74). The roster, the athlete page and open times come from
 * security definer RPCs that only return this coach's athletes.
 */
import { supabase } from "@/integrations/supabase/client";

type Row = Record<string, any>;

export interface RosterSession {
  date: string;
  startTime: string;
  place?: string | null;
}

export interface RosterAthlete {
  id: string;
  name: string;
  imageUrl: string | null;
  age: number | null;
  position: string | null;
  team: string | null;
  accountName: string | null;
  email: string | null;
  phone: string | null;
  isClient: boolean;
  /** A camp athlete made from a sign-up without an account (only the coach sees it). */
  fromCamp: boolean;
  /** The family has an AthaNext account. */
  hasAccount: boolean;
  joinedOn: string | null;
  pillars: string[];
  next: RosterSession | null;
  lastDate: string | null;
  credits: number;
  packageName: string | null;
  packageTotal: number | null;
  packageUsed: number | null;
  sessionsCount: number;
  spent: number;
  gearTotal: number;
}

/** Package card on the athlete page (WC4 #24). */
export interface PackageProgress {
  id: string;
  name: string;
  packageId: string | null;
  total: number;
  remaining: number;
  prior: number;
  price: number;
  outside: "paid" | "owed" | null;
  boughtAt: string | null;
  invoiceId: string | null;
}

export interface AthleteSession {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  name: string;
  pillar: string | null;
  kind: string;
  place: string | null;
  price: number;
  status: string;
  /** Previous sessions only (ATH-79). */
  hasFeedback?: boolean;
  noShow?: boolean;
  summary?: string | null;
  note?: string | null;
}

export interface OpenTime {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  price: number;
  place: string | null;
  suggested: boolean;
}

export type OpenInviteStatus = "approval" | "bounced" | "opened" | "sent";

/** An invite the family hasn't finished, for the My Athletes invites tab. */
export interface OpenInvite {
  id: string;
  parent: string;
  email: string;
  athlete: string | null;
  age: number | null;
  status: OpenInviteStatus;
}

const mapAthlete = (row: Row): RosterAthlete => ({
  id: row.id,
  name: row.name,
  imageUrl: row.imageUrl ?? null,
  age: row.age ?? null,
  position: row.position ?? null,
  team: row.team ?? null,
  accountName: row.accountName ?? null,
  email: row.email ?? null,
  phone: row.phone ?? null,
  isClient: Boolean(row.isClient),
  fromCamp: Boolean(row.fromCamp),
  hasAccount: row.hasAccount == null ? true : Boolean(row.hasAccount),
  joinedOn: row.joinedOn ?? null,
  pillars: Array.isArray(row.pillars) ? row.pillars : [],
  next: row.next ?? null,
  lastDate: row.lastDate ?? null,
  credits: Number(row.credits) || 0,
  packageName: row.packageName ?? null,
  packageTotal: row.packageTotal ?? null,
  packageUsed: row.packageUsed ?? null,
  sessionsCount: Number(row.sessionsCount) || 0,
  spent: Number(row.spent) || 0,
  gearTotal: Number(row.gearTotal) || 0,
});

export const rosterAPI = {
  async roster(): Promise<RosterAthlete[]> {
    const { data, error } = await supabase.rpc("get_coach_roster");
    if (error) throw error;
    return ((data as Row[]) ?? []).map(mapAthlete);
  },

  async athlete(id: string): Promise<{
    athlete: RosterAthlete;
    note: string;
    /** Set by the family on their Home (ATH-92). */
    goal: string | null;
    video: string | null;
    /** How the account holder is related to the athlete ("Parent", "Guardian", …). */
    relation: string | null;
    /** When the main package expires (YYYY-MM-DD). */
    packageExpires: string | null;
    /** Active package card (WC4 #24), including outside packages in progress. */
    packageProgress: PackageProgress | null;
    /** Open invoices for this athlete: the total and the first one to remind. */
    due: { amount: number; invoiceId: string; reminders: number } | null;
    upcoming: AthleteSession[];
    past: AthleteSession[];
  }> {
    const { data, error } = await supabase.rpc("get_coach_athlete", { p_athlete_id: id });
    if (error) throw error;
    const raw = (data ?? {}) as Row;
    const prog = raw.packageProgress as Row | null | undefined;
    return {
      athlete: mapAthlete(raw.athlete ?? {}),
      note: raw.note ?? "",
      goal: raw.goal ?? null,
      video: raw.video ?? null,
      relation: raw.relation ?? null,
      packageExpires: raw.packageExpires ?? null,
      packageProgress: prog?.id
        ? {
            id: prog.id,
            name: prog.name ?? "Package",
            packageId: prog.packageId ?? null,
            total: Number(prog.total) || 0,
            remaining: Number(prog.remaining) || 0,
            prior: Number(prog.prior) || 0,
            price: Number(prog.price) || 0,
            outside: prog.outside === "paid" || prog.outside === "owed" ? prog.outside : null,
            boughtAt: prog.boughtAt ?? null,
            invoiceId: prog.invoiceId ?? null,
          }
        : null,
      due: raw.due?.invoiceId ? { amount: Number(raw.due.amount) || 0, invoiceId: raw.due.invoiceId, reminders: Number(raw.due.reminders) || 0 } : null,
      upcoming: (raw.upcoming as AthleteSession[]) ?? [],
      past: (raw.past as AthleteSession[]) ?? [],
    };
  },

  async upsertPackageInProgress(input: {
    athleteId: string;
    packageId: string | null;
    customName: string | null;
    sessionsTotal: number;
    priorUsed: number;
    price: number;
    outside: "paid" | "owed";
  }): Promise<string> {
    const { data, error } = await supabase.rpc(
      "upsert_package_in_progress" as never,
      {
        p_athlete_id: input.athleteId,
        p_package_id: input.packageId,
        p_custom_name: input.customName,
        p_sessions_total: input.sessionsTotal,
        p_prior_used: input.priorUsed,
        p_price: input.price,
        p_outside: input.outside,
      } as never
    );
    if (error) throw error;
    return String(data);
  },

  async openTimes(athleteId: string, limit = 8): Promise<OpenTime[]> {
    const { data, error } = await supabase.rpc("get_roster_open_times", { p_athlete_id: athleteId, p_limit: limit });
    if (error) throw error;
    return ((data as Row[]) ?? []).map((row) => ({
      id: row.id,
      date: row.date,
      startTime: row.startTime,
      endTime: row.endTime,
      price: Number(row.price) || 0,
      place: row.place ?? null,
      suggested: Boolean(row.suggested),
    }));
  },

  /** How a booking from the roster can be paid (ATH-77). */
  async bookPayment(athleteId: string): Promise<{ credits: number; ownClient: boolean; paysDirect: boolean }> {
    const { data, error } = await supabase.rpc("get_roster_book_payment", { p_athlete_id: athleteId });
    if (error) throw error;
    const raw = (data ?? {}) as Row;
    return { credits: Number(raw.credits) || 0, ownClient: Boolean(raw.own_client), paysDirect: Boolean(raw.pays_direct) };
  },

  /** Books the athlete, paid with credits or outside AthaNext, and queues the confirmation email. Returns the booking ids. */
  async book(athleteId: string, occurrenceIds: string[], payment: "credit" | "outside"): Promise<string[]> {
    const { data, error } = await supabase.rpc("coach_book_athlete", { p_athlete_id: athleteId, p_occurrence_ids: occurrenceIds, p_payment: payment });
    if (error) throw error;
    const ids = (data as string[]) ?? [];
    // Confirmation email (with the video link for virtual sessions). The function waits out the
    // Undo window first and skips undone bookings. Never blocks the booking.
    if (ids.length) {
      void supabase.functions
        .invoke("create-booking-payment-v0", { body: { action: "notify_booked", booking_ids: ids } })
        .catch(() => undefined);
    }
    return ids;
  },

  async undoBooking(bookingIds: string[]): Promise<void> {
    const { error } = await supabase.rpc("coach_undo_booking", { p_booking_ids: bookingIds });
    if (error) throw error;
  },

  async openInvites(): Promise<OpenInvite[]> {
    const { data, error } = await supabase.rpc("get_coach_open_invites" as never);
    if (error) throw error;
    return ((data as Row[] | null) ?? []).map((row) => ({
      id: row.id,
      parent: row.parent ?? row.email ?? "",
      email: row.email ?? "",
      athlete: row.athlete || null,
      age: row.age ?? null,
      status: row.status as OpenInviteStatus,
    }));
  },

  /** Changes the address on an open invite; resend it afterwards. */
  async fixInviteEmail(referralId: string, email: string): Promise<void> {
    const { error } = await supabase.rpc("coach_fix_invite_email" as never, { p_referral_id: referralId, p_email: email } as never);
    if (error) throw error;
  },

  /** The pillars the coach offers (their profile specialties). */
  async coachPillars(coachId: string): Promise<string[]> {
    const { data, error } = await supabase.from("coaches").select("specialties").eq("id", coachId).maybeSingle();
    if (error) throw error;
    return ((data?.specialties as string[] | null) ?? []).filter(Boolean);
  },

  async saveNote(athleteId: string, note: string): Promise<void> {
    const { error } = await supabase.rpc("set_coach_athlete_note", { p_athlete_id: athleteId, p_note: note });
    if (error) throw error;
  },

  /** The season goal; the family can also change it on their Home. */
  async saveGoal(athleteId: string, goal: string): Promise<void> {
    const { error } = await supabase.rpc("set_coach_athlete_goal" as never, { p_athlete_id: athleteId, p_goal: goal } as never);
    if (error) throw error;
  },
};
