/**
 * Athlete Home (ATH-92): one call for the player card, next session, what they're working
 * on and their coaches; profile edits write straight to athlete_profiles.
 */
import { supabase } from "@/integrations/supabase/client";
import type { HomeAthlete } from "@/utils/athleteHome";
import { sessionInstantISO } from "@/utils/viewerTime";

type Row = Record<string, any>;

export interface HomeData {
  athlete: HomeAthlete | null;
  next: { id: string; start: string; end: string; title: string; place: string | null; coachName: string; status: string } | null;
  focus: { text: string; coachName: string; date: string } | null;
  coaches: { id: string; name: string; slug: string | null; photo: string | null; nextDate: string | null; creditsLeft: number }[];
}

export type AthleteProfileEdit = {
  fullName: string;
  dateOfBirth: string;
  sport: string;
  position: string;
  team: string;
  pathway: string;
  graduationYear: string;
  seasonGoal: string;
  highlightVideoUrl: string;
};

export const athleteHomeAPI = {
  async get(): Promise<HomeData> {
    const { data, error } = await supabase.rpc("get_athlete_home");
    if (error) throw error;
    const raw = (data ?? {}) as Row;
    const a = raw.athlete as Row | null;
    const next = raw.next as Row | null;
    const focus = raw.focus as Row | null;
    return {
      athlete: a
        ? {
            id: a.id,
            fullName: a.full_name ?? "",
            dateOfBirth: a.date_of_birth ?? null,
            sport: a.sport ?? null,
            position: a.position ?? null,
            team: a.team ?? null,
            graduationYear: a.graduation_year != null ? String(a.graduation_year) : null,
            pathway: a.pathway ?? null,
            seasonGoal: a.season_goal ?? null,
            highlightVideoUrl: a.highlight_video_url ?? null,
            photo: a.photo ?? null,
          }
        : null,
      next: next
        ? {
            id: next.id,
            start: sessionInstantISO(next.date, next.start_time),
            end: sessionInstantISO(next.date, next.end_time),
            title: next.title ?? "Session",
            place: next.place ?? null,
            coachName: next.coach_name ?? "Coach",
            status: next.status ?? "booked",
          }
        : null,
      focus: focus?.text ? { text: focus.text, coachName: focus.coach_name ?? "Your coach", date: focus.date } : null,
      coaches: ((raw.coaches as Row[]) ?? []).map((c) => ({
        id: c.id,
        name: c.name ?? "Coach",
        slug: c.slug ?? null,
        photo: c.photo ?? null,
        nextDate: c.next_date ?? null,
        creditsLeft: Number(c.credits_left) || 0,
      })),
    };
  },

  async save(athleteId: string, edit: AthleteProfileEdit): Promise<void> {
    const clean = (v: string) => v.trim() || null;
    const { error } = await supabase
      .from("athlete_profiles")
      .update({
        full_name: edit.fullName.trim(),
        date_of_birth: edit.dateOfBirth,
        sport: edit.sport,
        position: clean(edit.position),
        high_school: clean(edit.team),
        pathway_tags: edit.pathway ? [edit.pathway] : [],
        graduation_year: clean(edit.graduationYear),
        season_goal: clean(edit.seasonGoal),
        highlight_video_url: clean(edit.highlightVideoUrl),
        updated_at: new Date().toISOString(),
      })
      .eq("id", athleteId);
    if (error) throw error;
  },
};
