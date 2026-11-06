/**
 * Athlete Home (ATH-92): one call for the player card, next session, what they're working
 * on and their coaches; profile edits write straight to athlete_profiles.
 */
import { supabase } from "@/integrations/supabase/client";
import type { HomeAthlete } from "@/utils/athleteHome";
import { ATHLETE_IMAGE_LIMITS, toSportKey } from "@/utils/db";
import { getStoragePathFromPublicUrl } from "@/utils/storage";
import { sessionInstantISO } from "@/utils/viewerTime";

type Row = Record<string, any>;

export interface HomeData {
  athlete: HomeAthlete | null;
  next: {
    id: string;
    start: string;
    end: string;
    title: string;
    place: string | null;
    coachName: string;
    status: string;
    /** A camp day: its time shows on the camp's clock with the zone. */
    isCamp: boolean;
  } | null;
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
            // is_camp from 20261027100000; before that the camp title ("Camp · …") gives it away.
            isCamp: Boolean(next.is_camp) || String(next.title ?? "").startsWith("Camp · "),
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

  /** Removes a coach from the family's Coaches card. Booking them again brings them back. */
  async hideCoach(coachId: string): Promise<void> {
    const { error } = await supabase.rpc("hide_coach" as never, { p_coach_id: coachId } as never);
    if (error) throw error;
  },

  /** Undo for hideCoach. */
  async unhideCoach(coachId: string): Promise<void> {
    const { error } = await supabase.rpc("unhide_coach" as never, { p_coach_id: coachId } as never);
    if (error) throw error;
  },

  async save(athleteId: string, edit: AthleteProfileEdit): Promise<void> {
    const clean = (v: string) => v.trim() || null;
    const { error } = await supabase
      .from("athlete_profiles")
      .update({
        full_name: edit.fullName.trim(),
        date_of_birth: edit.dateOfBirth,
        sport: toSportKey(edit.sport),
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
    // The account carries the sport too (the sidebar label, the sport the coach list starts on).
    // Keep it in step when this is the account's own athlete.
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      const sport = toSportKey(edit.sport) || null;
      const { error: accountError } = await supabase
        .from("user_profiles")
        .update({ sport, updated_at: new Date().toISOString() })
        .eq("id", auth.user.id)
        .eq("athlete_id", athleteId);
      if (accountError) throw accountError;
    }
  },
  /**
   * Uploads a new athlete photo to athalink-images/athlete-profiles/<user id>-<time>.<ext>
   * (the storage policy only allows names starting with the uploader's id). An athlete's own
   * photo is also their account photo; a parent keeps their own.
   */
  async uploadPhoto(
    athleteId: string,
    file: File,
    { previousUrl, isAccountPhoto }: { previousUrl: string | null; isAccountPhoto: boolean }
  ): Promise<string> {
    if (!file.type.startsWith("image/")) throw new Error("Choose a JPG, PNG or WebP image.");
    if (file.size > ATHLETE_IMAGE_LIMITS.MAX_PROFILE_IMAGE_SIZE) throw new Error("The photo must be under 8 MB.");
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) throw new Error("Sign in again to change the photo.");

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `athlete-profiles/${userId}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("athalink-images")
      .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
    if (uploadError) throw uploadError;
    const url = `${supabase.storage.from("athalink-images").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;

    const { error } = await supabase
      .from("athlete_profiles")
      .update({ profile_image_url: url, updated_at: new Date().toISOString() })
      .eq("id", athleteId);
    if (error) throw error;
    if (isAccountPhoto) {
      const { error: accountError } = await supabase.from("user_profiles").update({ image_url: url }).eq("id", userId);
      if (accountError) throw accountError;
    }

    // Best effort: the old file only takes space. Older uploads may not be removable.
    const oldPath = getStoragePathFromPublicUrl(previousUrl);
    if (oldPath && oldPath !== path) await supabase.storage.from("athalink-images").remove([oldPath]);
    return url;
  },
};
