import { supabase } from "@/integrations/supabase/client";

export type CoachShareEventType =
  | "pricing_view"
  | "profile_share"
  | "pricing_copy"
  | "pricing_download";

export async function resolveCoachId(key: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("resolve_coach_by_slug_or_id", {
    p_key: key,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function renameCoachSlug(
  coachId: string,
  newSlug: string
): Promise<string> {
  const { data, error } = await supabase.rpc("rename_coach_slug", {
    p_coach_id: coachId,
    p_new_slug: newSlug,
  });
  if (error) throw error;
  return data as string;
}

export async function recordCoachShareEvent(
  coachId: string,
  eventType: CoachShareEventType
): Promise<void> {
  const { error } = await supabase.rpc("record_coach_share_event", {
    p_coach_id: coachId,
    p_event_type: eventType,
  });
  if (error) {
    console.warn("Failed to record share event", error);
  }
}
