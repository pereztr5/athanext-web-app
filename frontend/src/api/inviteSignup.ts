/**
 * Sign-up from a coach's invite (invite-signup function): the invite link proves the email, so
 * an account made with the invited email needs no 6-digit code.
 */
import { supabase } from "@/integrations/supabase/client";

export type InviteSignupInfo = {
  email: string;
  parent_name: string;
  athlete_first: string;
  coach_name: string;
  sport: "Soccer" | "Rowing" | null;
};

const call = async <T,>(body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke<T>("invite-signup", { body });
  if (error) {
    const message = await (error as { context?: Response }).context
      ?.json?.()
      .then((b: { error?: string }) => b?.error)
      .catch(() => null);
    throw new Error(message || error.message);
  }
  return data as T;
};

export const inviteSignupAPI = {
  lookup: (token: string) => call<InviteSignupInfo>({ action: "lookup", token }),
  /** Creates the account with the email confirmed; sign in with the password afterwards. */
  create: (token: string, password: string, phone: string) => call<{ created: boolean }>({ action: "create", token, password, phone }),
};
