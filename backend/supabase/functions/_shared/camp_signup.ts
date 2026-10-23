// Pure helpers for camp sign-up (camp-signup function and the Stripe webhook). No imports
// besides fees.ts, so everything here is unit tested.
//
// Fee rule (fees.ts, kind "camp"): no platform fee on any camp sign-up (link, marketplace or
// added by the coach). A card payment adds card processing only; paying the coach directly adds
// nothing. Paying the coach directly is offered to every family whenever the camp allows it.

import { checkoutFees, type FeeBreakdown, type FeeConfig } from "./fees.ts";

export const CAMP_MAX_ATHLETES = 6;

/** Limits passed to camp_signup_start (enforced there, inside the camp lock). */
export const CAMP_RATE_LIMITS = {
  /** Sign-ups per hour from one device (hashed IP). */
  perIpHour: 5,
  /** Sign-ups per hour for one parent email. */
  perEmailHour: 5,
  /** Unpaid "pay the coach directly" sign-ups one email may have at one camp. */
  directPerEmail: 3,
} as const;

/** A direct-pay hold lasts this long unless the coach marks it paid. */
export const CAMP_DIRECT_HOLD_DAYS = 7;

export type CampSource = "link" | "marketplace";
export type CampPayMethod = "card" | "direct";

export interface CampAthleteInput {
  first_name: string;
  last_name: string;
  birth_year: number;
  group_id: string;
  note?: string;
}

export interface CampSignupInput {
  camp_id: string;
  source: CampSource;
  pay_method: CampPayMethod;
  parent: { name: string; email: string; phone: string | null };
  note: string | null;
  waiver: true;
  photo_consent: boolean;
  athletes: CampAthleteInput[];
}

/** Field errors keyed like the form: parent.name, athletes.0.birth_year, waiver ... */
export type CampFieldErrors = Record<string, string>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^[0-9+()\-. ]{7,30}$/;

export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_RE.test(value);

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Birth years the form accepts: 2 to 80 years old this year. */
export const birthYearRange = (now = new Date()) => {
  const year = now.getUTCFullYear();
  return { min: year - 80, max: year - 2 };
};

/** "src=link" on the shared link marks the coach's own families; anything else is marketplace. */
export const campSource = (src: unknown): CampSource => (str(src).toLowerCase() === "link" ? "link" : "marketplace");

/**
 * Validates the sign-up form. Returns the cleaned input, or the errors with the form's copy.
 * The database checks the same rules again.
 */
export const validateCampSignup = (
  body: unknown,
  now = new Date(),
): { ok: true; value: CampSignupInput } | { ok: false; errors: CampFieldErrors } => {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const parent = (b.parent && typeof b.parent === "object" ? b.parent : {}) as Record<string, unknown>;
  const errors: CampFieldErrors = {};

  const campId = str(b.camp_id);
  if (!isUuid(campId)) errors.camp_id = "This camp link is not right";

  const payMethod = str(b.pay_method);
  if (payMethod !== "card" && payMethod !== "direct") errors.pay_method = "Choose how to pay";

  const name = str(parent.name);
  if (!name || name.length > 120) errors["parent.name"] = "Add your name";
  const email = str(parent.email).toLowerCase();
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    errors["parent.email"] = "Add an email we can send the receipt to";
  }
  const phone = str(parent.phone);
  if (phone && !PHONE_RE.test(phone)) errors["parent.phone"] = "Add a phone number, like 555 123 4567";

  const note = str(b.note);
  if (note.length > 500) errors.note = "Keep the note under 500 characters";

  if (b.waiver !== true) errors.waiver = "Agree to the waiver to continue";

  const { min, max } = birthYearRange(now);
  const rawAthletes = Array.isArray(b.athletes) ? b.athletes : [];
  if (rawAthletes.length < 1) errors.athletes = "Add an athlete";
  if (rawAthletes.length > CAMP_MAX_ATHLETES) errors.athletes = `Add up to ${CAMP_MAX_ATHLETES} athletes`;
  const seen = new Set<string>();
  const athletes: CampAthleteInput[] = rawAthletes.slice(0, CAMP_MAX_ATHLETES).map((raw, i) => {
    const a = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const first = str(a.first_name);
    const last = str(a.last_name);
    const yearText = str(typeof a.birth_year === "number" ? String(a.birth_year) : a.birth_year);
    const year = /^\d{4}$/.test(yearText) ? Number(yearText) : NaN;
    const groupId = str(a.group_id);
    const athleteNote = str(a.note);
    if (!first || first.length > 60) errors[`athletes.${i}.first_name`] = "Add a first name";
    if (!last || last.length > 60) errors[`athletes.${i}.last_name`] = "Add a last name";
    if (!Number.isInteger(year) || year < min || year > max) {
      errors[`athletes.${i}.birth_year`] = "Add a birth year, like 2013";
    }
    if (!isUuid(groupId)) errors[`athletes.${i}.group_id`] = "Pick a group";
    if (athleteNote.length > 500) errors[`athletes.${i}.note`] = "Keep the note under 500 characters";
    const key = `${first.toLowerCase()} ${last.toLowerCase()}`;
    if (first && last && seen.has(key)) errors[`athletes.${i}.first_name`] = `${first} is on the form twice`;
    seen.add(key);
    return { first_name: first, last_name: last, birth_year: year, group_id: groupId, ...(athleteNote ? { note: athleteNote } : {}) };
  });

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      camp_id: campId,
      source: campSource(b.src ?? b.source),
      pay_method: payMethod as CampPayMethod,
      parent: { name, email, phone: phone || null },
      note: note || null,
      waiver: true,
      photo_consent: b.photo_consent === true,
      athletes,
    },
  };
};

/** Camps never carry a platform fee, whoever signs up (kept on the Checkout metadata as "1"). */
export const CAMP_PLATFORM_WAIVED = true;

/** Paying the coach directly: offered to every family whenever the camp's switch is on. */
export const campDirectAllowed = (payDirect: boolean) => payDirect === true;

/** Card fees for a camp Checkout: one line per athlete at the camp's list price, card processing only. */
export const campCheckoutFees = (priceCents: number, athletes: number, config: FeeConfig): FeeBreakdown =>
  checkoutFees(
    Array.from({ length: Math.max(0, athletes) }, () => ({ listCents: priceCents, kind: "camp" as const })),
    config,
  );

/** Stripe metadata values stop at 500 characters. */
const metaList = (ids: string[]) => {
  const value = ids.join(",");
  return value.length <= 500 ? value : "";
};

export interface CampCheckoutMeta {
  kind: "camp";
  signupId: string;
  campId: string;
  coachId: string;
  registrationIds: string[];
  source: CampSource;
  platformWaived: boolean;
  listCents: number;
  athletes: number;
}

export const campMetadata = (m: Omit<CampCheckoutMeta, "kind">): Record<string, string> => ({
  kind: "camp",
  signup_id: m.signupId,
  camp_id: m.campId,
  coach_id: m.coachId,
  registration_ids: metaList(m.registrationIds),
  source: m.source,
  platform_waived: m.platformWaived ? "1" : "0",
  list_cents: String(m.listCents),
  athletes: String(m.athletes),
});

/** The camp fields of a Checkout's metadata, or null when it is not a camp Checkout. */
export const parseCampMetadata = (metadata: Record<string, unknown> | null | undefined): CampCheckoutMeta | null => {
  if (!metadata || metadata.kind !== "camp") return null;
  const signupId = str(metadata.signup_id);
  if (!isUuid(signupId)) return null;
  const registrationIds = [...new Set(str(metadata.registration_ids).split(",").map((id) => id.trim()).filter(isUuid))];
  const listCents = Number.parseInt(str(metadata.list_cents), 10);
  const athletes = Number.parseInt(str(metadata.athletes), 10);
  return {
    kind: "camp",
    signupId,
    campId: str(metadata.camp_id),
    coachId: str(metadata.coach_id),
    registrationIds,
    source: campSource(metadata.source),
    platformWaived: metadata.platform_waived === "1",
    listCents: Number.isFinite(listCents) ? listCents : 0,
    athletes: Number.isFinite(athletes) ? athletes : registrationIds.length,
  };
};

/** HTTP status and message for a camp_signup_start / coach RPC error hint. */
export const campErrorStatus = (hint: string | null | undefined): number => {
  switch (hint) {
    case "rate_ip":
    case "rate_email":
    case "rate_direct":
    case "throttled":
      return 429;
    case "group_full":
    case "camp_full":
    case "duplicate":
    case "stale":
    case "schedule_clash":
      return 409;
    case "closed":
    case "camp_missing":
      return 404;
    default:
      return 400;
  }
};

/** Start of the rate-limit window that contains `nowMs` for a sliding window of `windowMs`. */
export const rateWindowStart = (nowMs: number, windowMs = 60 * 60 * 1000) => new Date(nowMs - windowMs).toISOString();

/** Seconds until a sliding-window limit frees up, given the oldest attempt in the window. */
export const retryAfterSeconds = (oldestIso: string | null, nowMs: number, windowMs = 60 * 60 * 1000) => {
  if (!oldestIso) return 0;
  const free = Date.parse(oldestIso) + windowMs;
  return Number.isFinite(free) ? Math.max(0, Math.ceil((free - nowMs) / 1000)) : 0;
};

/**
 * The app origin for links in emails and Stripe redirects. The caller's Origin is used only for
 * local dev, athanext.com and the team's Vercel previews; anything else falls back to the default.
 */
export const resolveAppOrigin = (origin: string | null | undefined, fallback: string): string => {
  if (!origin) return fallback;
  try {
    const url = new URL(origin);
    const host = url.hostname;
    if (host === "localhost" || host === "127.0.0.1") return url.origin;
    if (url.protocol !== "https:") return fallback;
    if (host === "athanext.com" || host.endsWith(".athanext.com")) return url.origin;
    if (/^athanext(-[a-z0-9-]+)?\.vercel\.app$/.test(host)) return url.origin;
  } catch {
    // fall through
  }
  return fallback;
};

/** The camp page path. Slugs are URL-encoded (coach slugs may hold any character). */
export const campPath = (coachSlug: string, campSlug: string) =>
  `/camps/${encodeURIComponent(coachSlug)}/${encodeURIComponent(campSlug)}`;

/** "Finish your account" link: sign-up with the parent email filled in. */
export const finishAccountUrl = (origin: string, email: string, signupId?: string) =>
  `${origin}/auth?mode=signup&email=${encodeURIComponent(email)}${signupId ? `&camp_signup=${encodeURIComponent(signupId)}` : ""}`;

/** First address of x-forwarded-for (the client), else the other proxy headers. */
export const clientIp = (headers: Headers): string => {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return (headers.get("cf-connecting-ip") ?? headers.get("x-real-ip") ?? "").trim();
};

/** The IP is never stored, only a salted hash for the rate limit. */
export const hashIp = async (ip: string, salt: string): Promise<string | null> => {
  if (!ip) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${ip}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 64);
};
