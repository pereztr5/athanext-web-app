/**
 * How AuthContext reacts to a Supabase auth event. Only a change of signed-in user blocks the
 * app with a spinner; token refreshes, profile updates and focus refreshes update quietly so
 * open pages and forms keep their state.
 */
export type AuthEventPlan = {
  /** Show the app-wide spinner (useRole().ready = false) while the profile loads. */
  blocking: boolean;
  /** Load the user profile (quietly when not blocking). */
  fetchProfile: boolean;
  /** The user signed out: clear user, session and profile. */
  clear: boolean;
};

const NOTHING: AuthEventPlan = { blocking: false, fetchProfile: false, clear: false };

export const planAuthEvent = (
  event: string,
  previousUserId: string | null,
  nextUserId: string | null,
  initialCheckDone: boolean
): AuthEventPlan => {
  if (event === "SIGNED_OUT" || (!nextUserId && previousUserId)) {
    return { blocking: false, fetchProfile: false, clear: true };
  }
  // The first session check loads the profile itself.
  if (!initialCheckDone || event === "INITIAL_SESSION" || !nextUserId) return NOTHING;
  if (nextUserId !== previousUserId) return { blocking: true, fetchProfile: true, clear: false };
  if (event === "USER_UPDATED") return { blocking: false, fetchProfile: true, clear: false };
  return NOTHING;
};
