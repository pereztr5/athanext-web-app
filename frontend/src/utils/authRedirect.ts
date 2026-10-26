/**
 * Builds the path Google OAuth (and email confirmation) should return to, so invite,
 * coach share, and camp finish params survive the round trip.
 */
export type AuthReturnParams = {
  invite?: string | null;
  coach?: string | null;
  campSignup?: string | null;
  email?: string | null;
  /** Force the sign-up wizard (signup-tab Google / emailRedirectTo). */
  signup?: boolean;
};

/** Map ?persona= from Become a coach / invite links onto the sign-up "who" answer. */
export const whoFromPersona = (persona: string | null | undefined): "coach" | "self" | "parent" | null => {
  if (persona === "coach") return "coach";
  if (persona === "parent") return "parent";
  if (persona === "athlete") return "self";
  return null;
};

/**
 * Relative path for OAuth / emailRedirectTo (caller prefixes origin).
 * With no context → "/". With invite/coach/camp → "/auth?…" so the wizard keeps them.
 */
export const buildOAuthRedirectPath = (input: AuthReturnParams): string => {
  const invite = input.invite?.trim() || null;
  const coach = !invite && input.coach?.trim() ? input.coach.trim() : null;
  const campSignup = input.campSignup?.trim() || null;
  const email = input.email?.trim() || null;

  const needsAuth =
    Boolean(input.signup) || Boolean(invite) || Boolean(coach) || Boolean(campSignup);
  if (!needsAuth) return "/";

  const q = new URLSearchParams();
  if (input.signup || campSignup || coach || invite) q.set("mode", "signup");
  if (invite) q.set("invite", invite);
  if (coach) q.set("coach", coach);
  if (campSignup) {
    q.set("camp_signup", campSignup);
    if (email) q.set("email", email);
  }
  return `/auth?${q.toString()}`;
};
