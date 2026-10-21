import { supabase } from "@/integrations/supabase/client";
import { toCoachTermsDoc, type CoachTermsDoc, type CoachTermsRow } from "@/utils/coachTerms";

/**
 * The active coach terms, or null when none are published yet.
 * public.coach_terms is not in the generated types, so the client is narrowed locally.
 */
export async function getCoachTerms(): Promise<CoachTermsDoc | null> {
  const client = supabase as unknown as {
    from: (table: "coach_terms") => {
      select: (cols: string) => {
        eq: (col: "is_active", v: boolean) => {
          order: (col: "updated_at", o: { ascending: boolean }) => {
            limit: (n: number) => {
              maybeSingle: () => Promise<{ data: CoachTermsRow | null; error: { message: string; code?: string } | null }>;
            };
          };
        };
      };
    };
  };
  const { data, error } = await client
    .from("coach_terms")
    .select("id, title, content, version, last_updated, updated_at, created_at")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // Before the coach_terms migration lands the table is missing: treat that as "not published".
  if (error && (error.code === "PGRST205" || error.code === "42P01")) return null;
  if (error) throw new Error(error.message);
  return toCoachTermsDoc(data);
}
