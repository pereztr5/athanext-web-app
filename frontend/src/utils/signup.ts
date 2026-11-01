/**
 * Sign up (WC4 one-question flow): answers collected before the account exists, then
 * written into the profile. Every unfinished account (email, Google from either tab,
 * imported users) finishes here. Answers live in per-tab sessionStorage.
 */
import { LEVEL_OPTIONS } from "@/constants/pathwayTags";

export type SignupWho = "coach" | "self" | "parent";
export type SignupRole = "athlete" | "coach" | "parent";

export const SIGNUP_ROLE_KEY = "athanext:signup-role";
export const SIGNUP_ANSWERS_KEY = "athanext:signup-answers";
export const SIGNUP_STEP_KEY = "athanext:signup-step";
/** The coach invite this tab is signing up through (kept across the Google round trip). */
export const SIGNUP_INVITE_KEY = "athanext:signup-invite";

export const readSignupInvite = (): string | null => {
  try {
    return sessionStorage.getItem(SIGNUP_INVITE_KEY);
  } catch {
    return null;
  }
};

export const writeSignupInvite = (token: string | null) => {
  try {
    if (token) sessionStorage.setItem(SIGNUP_INVITE_KEY, token);
    else sessionStorage.removeItem(SIGNUP_INVITE_KEY);
  } catch {
    // ignore
  }
};

export type SignupAnswers = {
  who: SignupWho | null;
  sport: "Soccer" | "Rowing" | null;
  pos: string | null;
  cpos: string[];
  pillars: string[];
  level: string | null;
  clevels: string[];
  ctypes: string[];
  /** Kept for answers saved before the birth date question; new answers use dob. */
  age: string | null;
  /** Birth date, YYYY-MM-DD. */
  dob: string;
  zip: string;
  /** Kept for saved answers; new answers use locations. */
  video: boolean;
  /** Session formats wanted or offered: "Individual", "Group". */
  formats: string[];
  /** Where: "In person", "Online". */
  locations: string[];
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
  dob: "",
  zip: "",
  video: true,
  formats: [],
  locations: ["In person"],
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
    sessionStorage.removeItem(SIGNUP_INVITE_KEY);
  } catch {
    // ignore
  }
};

type SignedInUser = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
  identities?: { provider?: string | null }[] | null;
};

export const isGoogleUser = (user: SignedInUser | null | undefined) =>
  user?.app_metadata?.provider === "google" ||
  Boolean(user?.identities?.some((identity) => identity?.provider === "google"));

/**
 * Fills the account fields an existing (signed-in) account already has, so the account step
 * only asks for what's missing. Answers already typed win.
 */
export const prefillFromUser = (answers: SignupAnswers, user: SignedInUser): SignupAnswers => {
  const meta = user.user_metadata ?? {};
  const fullName = String(meta.full_name ?? meta.name ?? "").trim();
  const [first = "", ...rest] = fullName.split(/\s+/).filter(Boolean);
  const phone = typeof meta.phone_number === "string" ? meta.phone_number : "";
  return {
    ...answers,
    first: answers.first || first,
    last: answers.last || rest.join(" "),
    email: user.email || answers.email,
    phone: answers.phone || phone,
    google: answers.google || isGoogleUser(user) || undefined,
  };
};

/** Where the flow opens: a signed-in account with saved answers goes straight to the account step. */
export const initialSignupStep = (signedIn: boolean, saved: Pick<SignupAnswers, "who"> | null): "who" | "account" =>
  signedIn && saved?.who ? "account" : "who";

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

/** Session options, the same for families and coaches (signup field options). */
export const SESSION_FORMATS = ["Individual", "Group"] as const;
export const SESSION_LOCATIONS = ["In person", "Online"] as const;

/** "Individual" -> individual, "In person" -> in_person: how the choices are stored. */
export const formatToDb = (format: string) => format.toLowerCase();
export const locationToDb = (location: string) => (location === "Online" ? "online" : "in_person");
/** coaches.session_types keeps its older values. */
export const locationToCoachSessionType = (location: string) => (location === "Online" ? "virtual" : "in-person");

/** Whole years between a YYYY-MM-DD birth date and today; null when the date isn't valid. */
export const ageFromDob = (dob: string, today = new Date()): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const born = new Date(Date.UTC(y, mo - 1, d));
  if (Number.isNaN(born.getTime()) || born.getUTCMonth() !== mo - 1) return null;
  let age = today.getUTCFullYear() - y;
  if (today.getUTCMonth() < mo - 1 || (today.getUTCMonth() === mo - 1 && today.getUTCDate() < d)) age -= 1;
  return age;
};

/** Birth dates the form accepts: ages 4 to 99. */
export const dobBounds = (today = new Date()) => {
  const iso = (years: number) => {
    const d = new Date(Date.UTC(today.getUTCFullYear() - years, today.getUTCMonth(), today.getUTCDate()));
    return d.toISOString().slice(0, 10);
  };
  return { min: iso(99), max: iso(4) };
};

export const validDob = (dob: string, today = new Date()) => {
  const age = ageFromDob(dob, today);
  return age !== null && age >= 4 && age <= 99;
};

/** Grad years the optional profile offers: this year to 8 years ahead. */
export const gradYearOptions = (today = new Date()) =>
  Array.from({ length: 9 }, (_, i) => String(today.getFullYear() + i));
