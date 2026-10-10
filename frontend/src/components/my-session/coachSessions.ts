import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { UISession } from "@/types/my-sessions";

export type CoachCardKind = "now" | "up" | "past";

export interface OccurrenceInfo {
  capacity: number | null;
  place: string | null;
  pillar: string | null;
}

/** Capacity, place and pillar for each occurrence; the sessions RPC doesn't return them. */
export const useOccurrenceInfo = (occurrenceIds: string[], enabled: boolean) =>
  useQuery({
    queryKey: ["my-sessions-occurrences", [...occurrenceIds].sort()],
    enabled: enabled && occurrenceIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_availability_slot_occurrences")
        .select("id, max_bookings_per_slot, place, pillar_slot")
        .in("id", occurrenceIds);
      if (error) throw error;
      const map: Record<string, OccurrenceInfo> = {};
      (data ?? []).forEach((row) => {
        map[row.id] = {
          capacity: row.max_bookings_per_slot ?? null,
          place: row.place?.trim() || null,
          pillar: row.pillar_slot ?? null,
        };
      });
      return map;
    },
  });

/** Group title, or "1-on-1 {pillar}". Stored names like "Upcoming soccer session" are never shown. */
export const coachSessionTitle = (session: UISession, pillar: string | null) => {
  const stored = session.title?.trim() ?? "";
  if (session.type === "group") {
    if (stored && !/^upcoming\b/i.test(stored)) return stored;
    return pillar ? `Group ${pillar.toLowerCase()}` : "Group session";
  }
  return pillar ? `1-on-1 ${pillar.toLowerCase()}` : "1-on-1 session";
};
