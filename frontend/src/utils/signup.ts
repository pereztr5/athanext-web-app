/**
 * Sign up (WC4 one-question flow): answers collected before the account exists, then
 * written into the profile. Session flags keep Auth from sending a half-finished
 * account to the old complete-profile form.
 */
import { LEVEL_OPTIONS } from "@/constants/pathwayTags";

export type SignupWho = "coach" | "self" | "parent";
export type SignupRole = "athlete" | "coach" | "parent";

export const SIGNUP_ROLE_KEY = "athanext:signup-role";
export const SIGNUP_ANSWERS_KEY = "athanext:signup-answers";
export const SIGNUP_STEP_KEY = "athanext:signup-step";

export type SignupAnswers = {
  who: SignupWho | null;
  sport: "Soccer" | "Rowing" | null;
  pos: string | null;
  cpos: string[];
  pillars: string[];
  level: string | null;
  clevels: string[];
  ctypes: string[];
  age: string | null;
  zip: string;
  video: boolean;
  first: string;
  last: string;
  email: string;
  phone: string;
  pw: string;
  ath: string;
  pemail: string;
  terms: boolean;
  code: string;
  /** Set after Google OAuth returns so the account step can skip email/password. */
  google?: boolean;
};

export const emptySignupAnswers = (): SignupAnswers => ({
  who: null,
  sport: null,
  pos: null,
  cpos: [],
  pillars: [],
  level: null,
  clevels: [],
  ctypes: [],
  age: null,
  zip: "",
  video: true,
  first: "",
  last: "",
  email: "",
  phone: "",
  pw: "",
  ath: "",
  pemail: "",
  terms: false,
  code: "",
});

export const roleFromWho = (who: SignupWho | null): SignupRole | null => {
  if (who === "coach") return "coach";
  if (who === "parent") return "parent";
  if (who === "self") return "athlete";
  return null;
};

export const readSignupRole = (): SignupRole | null => {
  try {
    const value = sessionStorage.getItem(SIGNUP_ROLE_KEY);
    if (value === "athlete" || value === "coach" || value === "parent") return value;
    const answers = readSignupAnswers();
    return roleFromWho(answers?.who ?? null);
  } catch {
    return null;
  }
};

export const writeSignupRole = (role: SignupRole | null) => {
  try {
    if (role) sessionStorage.setItem(SIGNUP_ROLE_KEY, role);
    else sessionStorage.removeItem(SIGNUP_ROLE_KEY);
  } catch {
    // ignore
  }
};

export const readSignupAnswers = (): SignupAnswers | null => {
  try {
    const raw = sessionStorage.getItem(SIGNUP_ANSWERS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SignupAnswers;
    return { ...emptySignupAnswers(), ...parsed };
  } catch {
    return null;
  }
};

export const writeSignupAnswers = (answers: SignupAnswers) => {
  try {
    sessionStorage.setItem(SIGNUP_ANSWERS_KEY, JSON.stringify(answers));
    const role = roleFromWho(answers.who);
    if (role) sessionStorage.setItem(SIGNUP_ROLE_KEY, role);
  } catch {
    // ignore
  }
};

export const clearSignupSession = () => {
  try {
    sessionStorage.removeItem(SIGNUP_ROLE_KEY);
    sessionStorage.removeItem(SIGNUP_ANSWERS_KEY);
    sessionStorage.removeItem(SIGNUP_STEP_KEY);
  } catch {
    // ignore
  }
};

/** Map sign-up level labels onto pathway_tags stored in the DB (shared with the coach profile). */
export const LEVEL_TO_PATHWAY: Record<string, string> = Object.fromEntries(LEVEL_OPTIONS.map((o) => [o.label, o.tag]));

export const COACH_POS_TO_DB: Record<string, string> = {
  Goalkeepers: "Goalkeeper",
  "Field players": "Field Player",
  Rowers: "Rower",
  Coxswains: "Coxswain",
};

export const ageYearsFromTile = (age: string | null): number | null => {
  if (age === null) return null;
  if (age === "u9") return 8;
  if (age === "18") return 18;
  const n = Number(age);
  return Number.isFinite(n) ? n : null;
};

export const dobFromAgeTile = (age: string | null, today = new Date()): string => {
  const years = ageYearsFromTile(age) ?? 18;
  const d = new Date(today);
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
};
