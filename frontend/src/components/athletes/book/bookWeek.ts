import { supabase } from "@/integrations/supabase/client";
import { rosterAPI } from "@/api/roster";
import { addDaysISO } from "@/utils/schedule";
import { fromOpenTime, type BookTime } from "./bookHelpers";

type Row = Record<string, unknown>;

/**
 * Eight days of the coach's times from `from` (Eastern dates): open 1-on-1s, groups the athlete
 * can join and taken times. Until get_roster_book_week is deployed, open 1-on-1s only.
 */
export const fetchBookWeek = async (athleteId: string, from: string): Promise<BookTime[]> => {
  const { data, error } = await supabase.rpc("get_roster_book_week" as never, { p_athlete_id: athleteId, p_from: from } as never);
  if (!error) {
    return ((data as Row[] | null) ?? []).map((row) => ({
      id: String(row.id),
      date: String(row.date),
      startTime: String(row.startTime),
      endTime: String(row.endTime),
      price: Number(row.price) || 0,
      place: (row.place as string | null) ?? null,
      kind: row.kind === "group" || row.kind === "taken" ? row.kind : "open",
      title: (row.title as string | null) ?? null,
      booked: Number(row.booked) || 0,
      cap: Number(row.cap) || 1,
      takenBy: (row.takenBy as string | null) ?? null,
    }));
  }
  const to = addDaysISO(from, 7);
  const open = await rosterAPI.openTimes(athleteId, 40);
  return open.filter((t) => t.date >= from && t.date <= to).map(fromOpenTime);
};
