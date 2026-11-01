/**
 * "Finish your account" after a camp sign-up: what the family already typed, kept in this tab so
 * the sign-up flow only asks for what's missing (password or Google, then phone).
 */
export type CampFinishDetails = {
  signupId: string;
  email: string;
  parentName: string;
  phone: string;
  athleteFirst: string;
  athleteLast: string;
  birthYear: number | null;
  /** For the profile questions that follow ("Besides [camp] with [coach], ..."). */
  campName?: string;
  coachName?: string;
  /** The camp's pillars, already marked in the pillars question. */
  campPillars?: string[];
};

/** Camps without pillars set are on-field training camps. */
export const campPillarsOf = (tags: string[] | null | undefined) => (tags?.length ? tags : ["On-field training"]);

const KEY = "athanext:camp-finish";

export const writeCampFinish = (details: CampFinishDetails) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(details));
  } catch {
    // Private mode: the flow just asks for the details again.
  }
};

export const readCampFinish = (signupId: string | null): CampFinishDetails | null => {
  if (!signupId) return null;
  try {
    const parsed = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as CampFinishDetails | null;
    return parsed && parsed.signupId === signupId ? parsed : null;
  } catch {
    return null;
  }
};

export const clearCampFinish = () => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
};

/** /auth link that finishes a camp family's account with the email filled in. */
export const finishAccountPath = (email: string, signupId: string) =>
  `/auth?mode=signup&email=${encodeURIComponent(email)}&camp_signup=${encodeURIComponent(signupId)}`;
