import { supabase } from "@/integrations/supabase/client";
import { checkMeetingUrl } from "@/utils/meetingUrl";

/**
 * coaches don't expose meeting_url on the public coach row. The link lives in
 * coach_meeting_links, which the coach can write and a family can read only while they
 * have a current booking with that coach. The table isn't in the generated types yet.
 */

type MeetingRow = { meeting_url: string | null };
type DbError = { message: string; code?: string } | null;

const missing = (error: DbError) => error?.code === "PGRST205" || error?.code === "42P01";

const links = () =>
  (
    supabase as unknown as {
      from: (table: "coach_meeting_links") => {
        select: (cols: string) => {
          eq: (col: "coach_id", id: string) => {
            maybeSingle: () => Promise<{ data: MeetingRow | null; error: DbError }>;
          };
        };
        upsert: (
          row: { coach_id: string; meeting_url: string; updated_at: string },
          options: { onConflict: string }
        ) => Promise<{ error: DbError }>;
        delete: () => {
          eq: (col: "coach_id", id: string) => Promise<{ error: DbError }>;
        };
      };
    }
  ).from("coach_meeting_links");

/** The coach's video link, or null. Families only get a row while they have a current booking. */
export async function getMeetingUrl(coachId: string): Promise<string | null> {
  const { data, error } = await links().select("meeting_url").eq("coach_id", coachId).maybeSingle();
  if (missing(error)) return null;
  if (error) throw new Error(error.message);
  return data?.meeting_url ?? null;
}

/** Saves an https link, or clears it when the field is empty. */
export async function saveMeetingUrl(coachId: string, raw: string): Promise<void> {
  if (!raw.trim()) {
    const { error } = await links().delete().eq("coach_id", coachId);
    if (error && !missing(error)) throw new Error(error.message);
    return;
  }
  const checked = checkMeetingUrl(raw);
  if (!checked.url) throw new Error(checked.error);
  const { error } = await links().upsert(
    { coach_id: coachId, meeting_url: checked.url, updated_at: new Date().toISOString() },
    { onConflict: "coach_id" }
  );
  // 23514: the database check. Same rule as checkMeetingUrl, so this only shows if they drift.
  if (error?.code === "23514") throw new Error("That link can't be used. Paste the full https link from Zoom, Meet or Teams");
  if (error) throw new Error(error.message);
}
