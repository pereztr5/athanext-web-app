import { supabase } from "@/integrations/supabase/client";

export type AdminAccount = {
  id: string;
  name: string;
  email: string;
  persona_type: "athlete" | "parent" | "coach" | null;
  is_active: boolean;
  coach_id: string | null;
  athlete_id: string | null;
};

type AdminAction =
  | { action: "search"; query: string }
  | { action: "update"; user_id: string; name: string; email: string; persona: string }
  | { action: "deactivate" | "reactivate" | "delete"; user_id: string };

const messageFrom = async (error: { message: string; context?: Response }) => {
  try {
    const body = await error.context?.json();
    if (body && typeof body.error === "string") return body.error;
  } catch {
    // The failed response had no JSON body.
  }
  return error.message;
};

export async function callAdminAccounts<T>(body: AdminAction): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-accounts", { body });
  if (error) {
    throw new Error(await messageFrom(error));
  }
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    throw new Error(data.error);
  }
  return data as T;
}

export const searchAdminAccounts = (query: string) =>
  callAdminAccounts<{ users: AdminAccount[] }>({ action: "search", query }).then((result) => result.users ?? []);
