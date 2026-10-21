/**
 * Coach ZIP centers for "View All Coaches" distance. A coach's point is looked up from their ZIP
 * when they save their profile and stored with set_my_coach_coordinates.
 */
import { supabase } from "@/integrations/supabase/client";
import type { GeoPoint } from "@/components/browse/area";
import { fetchZipPoint } from "@/utils/geolocation";

type Row = { coach_id: string; zip: string | null; latitude: number | string; longitude: number | string };

export const coachLocationAPI = {
  /** Every active coach with a stored point. Empty on any error, so Browse falls back to ZIP prefixes. */
  async points(): Promise<Map<string, { zip: string | null; point: GeoPoint }>> {
    const map = new Map<string, { zip: string | null; point: GeoPoint }>();
    try {
      const { data, error } = await supabase.rpc("get_coach_coordinates" as never);
      if (error || !Array.isArray(data)) return map;
      for (const row of data as Row[]) {
        const lat = Number(row.latitude);
        const lng = Number(row.longitude);
        if (row.coach_id && Number.isFinite(lat) && Number.isFinite(lng)) map.set(row.coach_id, { zip: row.zip ?? null, point: { lat, lng } });
      }
    } catch {
      // Browse still works without points.
    }
    return map;
  },

  /** Best effort after a coach saves their profile: never throws. */
  async saveMine(zip: string | null | undefined): Promise<boolean> {
    const clean = (zip || "").trim().slice(0, 5);
    if (!/^\d{5}$/.test(clean)) return false;
    try {
      const point = await fetchZipPoint(clean);
      if (!point) return false;
      const { error } = await supabase.rpc(
        "set_my_coach_coordinates" as never,
        { p_zip: clean, p_latitude: point.lat, p_longitude: point.lng } as never
      );
      return !error;
    } catch {
      return false;
    }
  },
};
