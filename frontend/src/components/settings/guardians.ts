/**
 * Second guardians live in athlete_guardians. Types are local until regenerated
 * after migration 20261019121000 is applied.
 */
import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AthleteGuardian = {
  id: string;
  name: string;
  email: string;
  relationship: string;
  emailed_at: string | null;
};

type QueryResult<T> = { data: T | null; error: PostgrestError | null };

// until types are regenerated after the migration is applied
const guardians = () =>
  (supabase as unknown as {
    from: (table: "athlete_guardians") => {
      select: (columns: string) => {
        eq: (column: "athlete_id", value: string) => {
          order: (
            column: "invited_at",
            options: { ascending: boolean }
          ) => Promise<QueryResult<AthleteGuardian[]>>;
        };
      };
      insert: (row: {
        athlete_id: string;
        name: string;
        email: string;
        relationship: string;
      }) => {
        select: (columns: string) => {
          single: () => Promise<QueryResult<AthleteGuardian>>;
        };
      };
      delete: () => {
        eq: (column: "id", value: string) => Promise<QueryResult<null>>;
      };
    };
  }).from("athlete_guardians");

export const isMissingGuardiansTable = (error: { code?: string; message?: string } | null | undefined) => {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const message = error.message ?? "";
  return /athlete_guardians/i.test(message) && /does not exist|schema cache|could not find/i.test(message);
};

const columns = "id, name, email, relationship, emailed_at";

export const listAthleteGuardians = async (athleteId: string) => {
  const { data, error } = await guardians().select(columns).eq("athlete_id", athleteId).order("invited_at", { ascending: false });
  if (error) {
    if (isMissingGuardiansTable(error)) return { missing: true as const, rows: [] as AthleteGuardian[] };
    throw error;
  }
  return { missing: false as const, rows: data ?? [] };
};

export const insertAthleteGuardian = (row: {
  athlete_id: string;
  name: string;
  email: string;
  relationship: string;
}) => guardians().insert(row).select(columns).single();

export const deleteAthleteGuardian = (id: string) => guardians().delete().eq("id", id);

/** True only when guardian-invite reports the email actually went out. */
export const sendGuardianInvite = async (guardianId: string) => {
  const { data, error } = await supabase.functions.invoke("guardian-invite", {
    body: { guardian_id: guardianId },
  });
  if (error || !data || typeof data !== "object") return false;
  return (data as { emailed?: unknown }).emailed === true;
};
