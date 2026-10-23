/**
 * Coach gear picks: the AthaNext store products a coach recommends, by Shopify handle.
 * Matches backend/supabase/migrations/20261024120000_coach_gear_picks.sql. The table and RPC
 * are not in the generated types until that migration is applied, so calls go through a
 * loose client. Anyone can read picks; set_my_gear_picks() replaces the signed-in coach's list.
 */
import { supabase } from "@/integrations/supabase/client";

type LooseError = { code?: string; message?: string; hint?: string | null };
type Loose = { data: unknown; error: LooseError | null };

const db = supabase as unknown as {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        order: (column: string, options: { ascending: boolean }) => Promise<Loose>;
      };
    };
  };
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<Loose>;
};

const toError = (error: LooseError, fallback: string) => new Error(error.message || fallback);

export const gearPicksAPI = {
  /** The coach's picked product handles, in their order. */
  async getCoachPicks(coachId: string): Promise<string[]> {
    const { data, error } = await db
      .from("coach_gear_picks")
      .select("product_handle, position")
      .eq("coach_id", coachId)
      .order("position", { ascending: true });
    if (error) throw toError(error, "Couldn't load gear picks");
    return ((data as { product_handle: string }[] | null) ?? []).map((row) => row.product_handle);
  },

  /** Replaces the signed-in coach's picks; returns the saved handles in order. */
  async setMyPicks(handles: string[]): Promise<string[]> {
    const { data, error } = await db.rpc("set_my_gear_picks", { p_handles: handles });
    if (error) throw toError(error, "Couldn't save gear picks");
    return (data as string[] | null) ?? [];
  },
};
