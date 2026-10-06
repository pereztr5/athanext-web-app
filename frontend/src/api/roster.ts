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
    upcoming: AthleteSession[];
    past: AthleteSession[];
  }> {
    const { data, error } = await supabase.rpc("get_coach_athlete", { p_athlete_id: id });
    if (error) throw error;
    const raw = (data ?? {}) as Row;
    return {
      athlete: mapAthlete(raw.athlete ?? {}),
      note: raw.note ?? "",
      upcoming: (raw.upcoming as AthleteSession[]) ?? [],
      past: (raw.past as AthleteSession[]) ?? [],
    };
  },

  async openTimes(athleteId: string): Promise<OpenTime[]> {
    const { data, error } = await supabase.rpc("get_roster_open_times", { p_athlete_id: athleteId });
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

  async saveNote(athleteId: string, note: string): Promise<void> {
    const { error } = await supabase.rpc("set_coach_athlete_note", { p_athlete_id: athleteId, p_note: note });
    if (error) throw error;
  },
};
