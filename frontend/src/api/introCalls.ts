/**
 * Free intro calls (Working Copy 2): coach settings, the family booking flow and the coach's
 * follow-up on Home. RPCs from 20261010240000_intro_calls.sql.
 */
import { supabase } from "@/integrations/supabase/client";

export type IntroFormat = "video" | "phone";

export interface IntroSettings {
  enabled: boolean;
  minutes: number;
  format: IntroFormat;
  newOnly: boolean;
  weeklyLimit: number;
  questions: string[];
  videoUrl: string | null;
}

export type IntroBlockReason = "signin" | "own" | "booked" | "noAthlete" | "client";

export interface CoachIntro {
  enabled: boolean;
  minutes: number;
  format: IntroFormat;
  questions: string[];
  canBook: boolean;
  reason: IntroBlockReason | null;
  athlete: { id: string; name: string; birthDate: string | null } | null;
  booked: { id: string; startsAt: string; minutes: number; status: string; videoUrl: string | null } | null;
  /** Start instants (ISO) the family can pick, soonest first. */
  times: string[];
}

export interface IntroCall {
  id: string;
  startsAt: string;
  minutes: number;
  format: IntroFormat;
  answers: { q: string; a: string }[];
  athleteId: string | null;
  athleteName: string | null;
  athleteBirthDate: string | null;
  familyName: string;
  phone: string | null;
}

export interface IntroOfferOption {
  key: string;
  label: string;
}

export interface CoachIntroCalls {
  weeklyLimit: number;
  bookedThisWeek: number;
  videoUrl: string | null;
  options: IntroOfferOption[];
  calls: IntroCall[];
}

type Row = Record<string, any>;

const rpc = (name: string, args?: Record<string, unknown>) =>
  supabase.rpc(name as never, args as never) as unknown as Promise<{ data: unknown; error: Error | null }>;

const format = (v: unknown): IntroFormat => (v === "phone" ? "phone" : "video");
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((q): q is string => typeof q === "string") : []);

export const introCallsAPI = {
  async mySettings(): Promise<IntroSettings & { bookedThisWeek: number }> {
    const { data, error } = await rpc("get_my_intro_settings");
    if (error) throw error;
    const raw = (data ?? {}) as Row;
    return {
      enabled: Boolean(raw.enabled),
      minutes: Number(raw.minutes) || 15,
      format: format(raw.format),
      newOnly: raw.newOnly !== false,
      weeklyLimit: Number(raw.weeklyLimit) || 3,
      questions: strings(raw.questions),
      videoUrl: raw.videoUrl || null,
      bookedThisWeek: Number(raw.bookedThisWeek) || 0,
    };
  },

  async saveSettings(settings: IntroSettings): Promise<void> {
    const { error } = await rpc("save_my_intro_settings", { p_settings: settings });
    if (error) throw error;
  },

  async enabledCoachIds(): Promise<string[]> {
    const { data, error } = await rpc("intro_enabled_coach_ids");
    if (error) throw error;
    // A setof uuid comes back as plain strings.
    return ((data as unknown[]) ?? []).map((v) => (typeof v === "string" ? v : String((v as Row)?.intro_enabled_coach_ids ?? ""))).filter(Boolean);
  },

  async forCoach(coachId: string): Promise<CoachIntro> {
    const { data, error } = await rpc("get_coach_intro", { p_coach_id: coachId });
    if (error) throw error;
    const raw = (data ?? {}) as Row;
    return {
      enabled: Boolean(raw.enabled),
      minutes: Number(raw.minutes) || 15,
      format: format(raw.format),
      questions: strings(raw.questions),
      canBook: Boolean(raw.canBook),
      reason: (raw.reason as IntroBlockReason) ?? null,
      athlete: raw.athlete ? { id: raw.athlete.id, name: raw.athlete.name ?? "", birthDate: raw.athlete.birthDate ?? null } : null,
      booked: raw.booked
        ? {
            id: raw.booked.id,
            startsAt: raw.booked.startsAt,
            minutes: Number(raw.booked.minutes) || 15,
            status: raw.booked.status ?? "booked",
            videoUrl: raw.booked.videoUrl || null,
          }
        : null,
      times: strings(raw.times),
    };
  },

  async book(coachId: string, startsAt: string, answers: string[]): Promise<void> {
    const { error } = await rpc("book_intro_call", { p_coach_id: coachId, p_starts_at: startsAt, p_answers: answers });
    if (error) throw error;
  },

  async coachCalls(): Promise<CoachIntroCalls> {
    const { data, error } = await rpc("get_coach_intro_calls");
    if (error) throw error;
    const raw = (data ?? {}) as Row;
    return {
      weeklyLimit: Number(raw.weeklyLimit) || 3,
      bookedThisWeek: Number(raw.bookedThisWeek) || 0,
      videoUrl: raw.videoUrl || null,
      options: ((raw.options as Row[]) ?? []).map((o) => ({ key: String(o.key), label: String(o.label) })),
      calls: ((raw.calls as Row[]) ?? []).map((c) => ({
        id: c.id,
        startsAt: c.startsAt,
        minutes: Number(c.minutes) || 15,
        format: format(c.format),
        answers: ((c.answers as Row[]) ?? []).map((a) => ({ q: String(a.q ?? ""), a: String(a.a ?? "") })),
        athleteId: c.athleteId ?? null,
        athleteName: c.athleteName ?? null,
        athleteBirthDate: c.athleteBirthDate ?? null,
        familyName: c.familyName || "A family",
        phone: c.phone || null,
      })),
    };
  },

  async sendOffer(callId: string, optionKey: string): Promise<void> {
    const { error } = await rpc("send_intro_offer", { p_call_id: callId, p_option_key: optionKey });
    if (error) throw error;
  },

  async notAFit(callId: string): Promise<void> {
    const { error } = await rpc("close_intro_call", { p_call_id: callId });
    if (error) throw error;
  },
};
