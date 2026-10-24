import { supabase } from "@/integrations/supabase/client";
import type { PublicEmailRequest } from "@/utils/publicEmail";

/** send-email's own message ("Too many messages…", a field error), else the fallback. */
const functionErrorMessage = async (error: unknown, fallback: string): Promise<string> => {
  const context = (error as { context?: Response }).context;
  if (!context || typeof context.clone !== "function") return fallback;
  try {
    const body = (await context.clone().json()) as { error?: unknown };
    if (typeof body?.error === "string" && body.error.trim()) return body.error.trim();
  } catch {
    // The client may already have read the body.
  }
  return fallback;
};

/** Sends one of the fixed public emails through send-email. Throws with a readable message. */
export const sendPublicEmail = async (request: PublicEmailRequest): Promise<void> => {
  const { error } = await supabase.functions.invoke("send-email", { body: request });
  if (error) throw new Error(await functionErrorMessage(error, "Couldn't send the email. Try again"));
};
