/**
 * Sign up (ATH-93): while someone is between verifying their email and finishing their
 * profile, this session flag tells Auth not to send them to the old profile form.
 */
export type SignupRole = "athlete" | "coach";

export const SIGNUP_ROLE_KEY = "athanext:signup-role";

export const readSignupRole = (): SignupRole | null => {
  try {
    const value = sessionStorage.getItem(SIGNUP_ROLE_KEY);
    return value === "athlete" || value === "coach" ? value : null;
  } catch {
    return null;
  }
};
