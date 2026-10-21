import { supabase } from "@/integrations/supabase/client";

/** Account settings emails, sent by the account-emails edge function to the signed-in person. */
export type AccountEmailEvent = "deletion_requested" | "deletion_cancelled" | "coach_deactivated";

/** Sends the matching account email. Never throws: the change already saved, the email is a courtesy. */
export const sendAccountEmail = async (event: AccountEmailEvent) => {
  try {
    const { data, error } = await supabase.functions.invoke("account-emails", { body: { event } });
    return !error && (data as { emailed?: unknown } | null)?.emailed === true;
  } catch {
    return false;
  }
};
