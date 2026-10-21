/**
 * Turns a Supabase auth error from a password change or reset into short, plain copy.
 * Unknown errors keep Supabase's own message so the real reason is never hidden.
 */
type AuthErrorLike = { message?: string | null; code?: string | null; status?: number | null };

export const WRONG_PASSWORD_MESSAGE = "That password isn't right.";
export const PASSWORD_FALLBACK_MESSAGE = "Couldn't update your password. Try again.";

export const friendlyPasswordError = (raw: unknown, fallback = PASSWORD_FALLBACK_MESSAGE): string => {
  if (!raw || typeof raw !== "object") return fallback;
  const error = raw as AuthErrorLike & object;
  const code = (error.code ?? "").toLowerCase();
  const text = (error.message ?? "").toLowerCase();

  if (code === "same_password" || text.includes("different from the old password")) {
    return "Your new password must be different from your current one.";
  }
  if (code === "weak_password" || text.includes("weak") || text.includes("password should")) {
    return "That password is too easy to guess. Use 8 or more characters with upper and lower case letters, a number and a symbol.";
  }
  if (code === "invalid_credentials" || text.includes("invalid login") || text.includes("invalid credentials")) {
    return WRONG_PASSWORD_MESSAGE;
  }
  if (code === "reauthentication_needed" || code === "session_not_found" || text.includes("session missing")) {
    return "Your session has ended. Sign in again, then change your password.";
  }
  if (code === "over_request_rate_limit" || error.status === 429 || text.includes("rate limit")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  return error.message?.trim() || fallback;
};
