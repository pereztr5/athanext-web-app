import { supabase } from "@/integrations/supabase/client";

export type WalkInAthlete = {
  id: string;
  name: string;
  email: string | null;
};

export type WalkInRosterEntry = {
  id: string;
  name: string;
  bookingId: string;
  requiresPayment: boolean;
};

const invoke = async <T>(body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke("create-booking-payment-v0", { body });
  if (error) {
    let message = error.message || "Request failed.";
    try {
      const context = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
      const parsed = await context?.json?.();
      if (parsed?.error) message = parsed.error;
    } catch {
      // Keep the generic message.
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
};

export const searchWalkInAthletes = (query: string) =>
  invoke<{ athletes: WalkInAthlete[] }>({ action: "walk_in_search", query });

export const listWalkInRoster = (slotId: string, sessionDate?: string | null) =>
  invoke<{ athletes: WalkInRosterEntry[] }>({
    action: "walk_in_list",
    slot_id: slotId,
    session_date: sessionDate ?? null,
  });

export const addWalkInAthlete = (slotId: string, sessionDate: string | null, athleteId: string) =>
  invoke<{
    bookingId: string;
    athlete: { id: string; name: string };
    requiresPayment: boolean;
    alreadyAdded: boolean;
  }>({
    action: "walk_in_add",
    slot_id: slotId,
    session_date: sessionDate,
    athlete_id: athleteId,
  });
