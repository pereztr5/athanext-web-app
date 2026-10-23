/**
 * Pure rules for camps: the public link, the family sign-up form, and the coach's camp editor
 * (dates, groups, price, what is still missing). The database checks the same limits again;
 * the form copy matches the camp-signup edge function (backend/.../_shared/camp_signup.ts).
 */
import type { CampGroupInput, CampInputPayload, CoachCamp, CampCoachRef } from "@/api/camps";

// ---------------------------------------------------------------------------
// Link
// ---------------------------------------------------------------------------

const CAMP_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const COACH_SLUG = /^[a-z0-9][a-z0-9._-]*$/i;

/** The camp page: athanext.com/<coach>/<camp>. */
export const campPath = (coachSlug: string, campSlug: string) =>
  `/${encodeURIComponent(coachSlug)}/${encodeURIComponent(campSlug)}`;

/**
 * Where a family's "Register" on a profile camp card goes: the camp page (no src, so
 * marketplace pricing) when the camp has a published link, otherwise null and the caller
 * falls back to the old package checkout.
 */
export const campPagePathFor = (
  coachSlug: string | null | undefined,
  camp: { slug: string | null | undefined; published?: boolean },
): string | null => {
  const coach = coachSlug?.trim();
  const slug = camp.slug?.trim();
  if (!coach || !slug || camp.published === false) return null;
  return campPath(coach, slug);
};

/** The coach's share link. src=link tells the coach the family came from his link. */
export const campShareUrl = (origin: string, coachSlug: string, campSlug: string) =>
  `${origin}${campPath(coachSlug, campSlug)}?src=link`;

/** "athanext.com/brayan/thanksgiving-camp" */
export const campLinkLabel = (coachSlug: string, campSlug: string) => `athanext.com/${coachSlug}/${campSlug}`;

/**
 * The two path segments of a camp page, or null when they can't be a camp link, so a typo
 * shows "not found" without asking the database.
 */
export const parseCampRoute = (coachSlug: string | undefined, campSlug: string | undefined) => {
  const coach = (coachSlug ?? "").trim();
  const camp = (campSlug ?? "").trim().toLowerCase();
  if (!coach || !camp || coach.length > 80 || camp.length > 80) return null;
  if (!COACH_SLUG.test(coach) || !CAMP_SLUG.test(camp)) return null;
  return { coachSlug: coach, campSlug: camp };
};

/** Only the coach's shared link counts as his own families. */
export const campSourceFromSearch = (search: string): "link" | null =>
  new URLSearchParams(search).get("src") === "link" ? "link" : null;

// ---------------------------------------------------------------------------
// Dates, times and money
// ---------------------------------------------------------------------------

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const utcDay = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
};

/** Inclusive number of days, 0 when the range is missing or backwards. */
export const campDayCount = (startsOn: string | null | undefined, endsOn: string | null | undefined): number => {
  if (!startsOn || !ISO_DAY.test(startsOn.slice(0, 10))) return 0;
  const end = endsOn && ISO_DAY.test(endsOn.slice(0, 10)) ? endsOn : startsOn;
  const days = Math.round((utcDay(end).getTime() - utcDay(startsOn).getTime()) / 86_400_000) + 1;
  return days > 0 ? days : 0;
};

const fmt = (iso: string, options: Intl.DateTimeFormatOptions) =>
  utcDay(iso).toLocaleDateString("en-US", { ...options, timeZone: "UTC" });

/** "Mon to Thu, Nov 23 to 26", "Sat, Nov 28", "Mon, Nov 30 to Wed, Dec 2". */
export const formatCampDates = (startsOn: string | null | undefined, endsOn: string | null | undefined): string | null => {
  if (!startsOn) return null;
  const first = startsOn.slice(0, 10);
  const last = (endsOn || startsOn).slice(0, 10);
  if (first === last) return fmt(first, { weekday: "short", month: "short", day: "numeric" });
  const sameMonth = first.slice(0, 7) === last.slice(0, 7);
  if (sameMonth) {
    return `${fmt(first, { weekday: "short" })} to ${fmt(last, { weekday: "short" })}, ${fmt(first, { month: "short", day: "numeric" })} to ${fmt(last, { day: "numeric" })}`;
  }
  const withYear = first.slice(0, 4) !== last.slice(0, 4);
  const opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) };
  return `${fmt(first, opts)} to ${fmt(last, opts)}`;
};

/** "Nov 23" for tiles and short lines. */
export const formatCampDay = (iso: string | null | undefined): string | null =>
  iso ? fmt(iso.slice(0, 10), { month: "short", day: "numeric" }) : null;

/** Half hours a group can start or end at: 7am to 9pm. */
export const CAMP_TIMES: string[] = Array.from({ length: 29 }, (_, i) => {
  const minutes = 7 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});
const FIRST = 7 * 60;
const LAST = 21 * 60;

export const timeToMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const minutesToTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** "9am", "9:30am", "12pm". */
export const formatCampTime = (time: string | null | undefined): string => {
  if (!time) return "";
  const minutes = timeToMinutes(time);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, "0")}${suffix}` : `${h12}${suffix}`;
};

/** "9am to 12pm" */
export const formatCampTimes = (start: string | null | undefined, end: string | null | undefined) =>
  start && end ? `${formatCampTime(start)} to ${formatCampTime(end)}` : formatCampTime(start || end);

/** Start times a group can pick (it must end by 9pm). */
export const groupStartOptions = () => CAMP_TIMES.slice(0, -1);
/** End times after the start. */
export const groupEndOptions = (start: string) => CAMP_TIMES.filter((t) => timeToMinutes(t) > timeToMinutes(start));

/** A new start keeps the group's length, cut off at 9pm. */
export const moveGroupStart = <G extends { start: string; end: string }>(group: G, start: string): G => {
  const from = Math.min(Math.max(timeToMinutes(start), FIRST), LAST - 30);
  const length = Math.max(30, timeToMinutes(group.end) - timeToMinutes(group.start));
  const end = Math.min(from + length, LAST);
  return { ...group, start: minutesToTime(from), end: minutesToTime(end) };
};

export const clampSpots = (value: number) => Math.min(60, Math.max(1, Math.round(Number(value) || 1)));

/** Whole dollars when it is even: "$260", else "$65.50". */
export const formatCampMoney = (cents: number) => {
  const dollars = cents / 100;
  return Number.isInteger(dollars)
    ? `$${dollars.toLocaleString("en-US")}`
    : `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/** Price per athlete typed in dollars: 1 to 10,000, cents allowed. */
export const parsePriceCents = (text: string): number | null => {
  const clean = text.replace(/[$,\s]/g, "");
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(clean)) return null;
  const cents = Math.round(Number(clean) * 100);
  return cents >= 100 && cents <= 1_000_000 ? cents : null;
};

export const perDayCents = (priceCents: number, days: number) => Math.round(priceCents / Math.max(1, days));

/** "4 days · $65 a day" */
export const perDayLine = (priceCents: number, days: number) =>
  days > 1 ? `${days} days · ${formatCampMoney(perDayCents(priceCents, days))} a day` : "1 day";

// ---------------------------------------------------------------------------
// Family sign-up form
// ---------------------------------------------------------------------------

export const CAMP_MAX_ATHLETES = 6;

export type CampFormAthlete = { first: string; last: string; year: string; groupId: string; note: string };
export type CampForm = {
  parent: { name: string; email: string; phone: string };
  athletes: CampFormAthlete[];
  waiver: boolean;
};

export const emptyAthlete = (groupId = ""): CampFormAthlete => ({ first: "", last: "", year: "", groupId, note: "" });

export const emptyCampForm = (groupId = ""): CampForm => ({
  parent: { name: "", email: "", phone: "" },
  athletes: [emptyAthlete(groupId)],
  waiver: false,
});

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE = /^[0-9+()\-. ]{7,30}$/;

/** Birth years the form takes: 2 to 80 years old this year (same as the server). */
export const birthYearRange = (now = new Date()) => ({ min: now.getUTCFullYear() - 80, max: now.getUTCFullYear() - 2 });

/**
 * Field errors with the mockup's copy, keyed like the server's (parent.name, athletes.0.birth_year, waiver).
 * Empty when the form can go to payment.
 */
export const validateCampForm = (
  form: CampForm,
  groups: { id: string; full: boolean }[],
  now = new Date(),
): Record<string, string> => {
  const errors: Record<string, string> = {};
  const name = form.parent.name.trim();
  if (!name || name.length > 120) errors["parent.name"] = "Add your name";
  const email = form.parent.email.trim();
  if (!email || email.length > 254 || !EMAIL.test(email)) errors["parent.email"] = "Add an email we can send the receipt to";
  const phone = form.parent.phone.trim();
  if (phone && !PHONE.test(phone)) errors["parent.phone"] = "Add a phone number, like 555 123 4567";
  const { min, max } = birthYearRange(now);
  const seen = new Set<string>();
  form.athletes.slice(0, CAMP_MAX_ATHLETES).forEach((a, i) => {
    const first = a.first.trim();
    const last = a.last.trim();
    if (!first || first.length > 60) errors[`athletes.${i}.first_name`] = "Add a first name";
    if (!last || last.length > 60) errors[`athletes.${i}.last_name`] = "Add a last name";
    const year = /^\d{4}$/.test(a.year.trim()) ? Number(a.year.trim()) : NaN;
    if (!Number.isInteger(year) || year < min || year > max) errors[`athletes.${i}.birth_year`] = "Add a birth year, like 2013";
    const group = groups.find((g) => g.id === a.groupId);
    if (!group) errors[`athletes.${i}.group_id`] = "Pick a group";
    else if (group.full) errors[`athletes.${i}.group_id`] = "This group is fully booked";
    if (a.note.trim().length > 500) errors[`athletes.${i}.note`] = "Keep the note under 500 characters";
    const key = `${first.toLowerCase()} ${last.toLowerCase()}`;
    if (first && last && seen.has(key)) errors[`athletes.${i}.first_name`] = `${first} is on the form twice`;
    seen.add(key);
  });
  if (!form.waiver) errors.waiver = "Agree to the waiver to continue";
  return errors;
};

/** What camp-signup takes. */
export const campFormAthletes = (form: CampForm) =>
  form.athletes.map((a) => ({
    first_name: a.first.trim(),
    last_name: a.last.trim(),
    birth_year: Number(a.year.trim()),
    group_id: a.groupId,
    ...(a.note.trim() ? { note: a.note.trim() } : {}),
  }));

/** "U13" style age group for a birth year in the camp's year. */
export const ageGroupFor = (birthYear: number | null | undefined, year = new Date().getUTCFullYear()) =>
  birthYear ? `U${year - birthYear + 1}` : null;

export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

// ---------------------------------------------------------------------------
// Coach's camp editor
// ---------------------------------------------------------------------------

export type CampDraftGroup = {
  /** Stable React key. */
  key: string;
  id?: string;
  name: string;
  description: string;
  start: string;
  end: string;
  spots: number;
};

export type CampDraft = {
  name: string;
  description: string;
  startsOn: string | null;
  endsOn: string | null;
  location: string;
  groups: CampDraftGroup[];
  /** Dollars as typed. */
  price: string;
  coverUrl: string | null;
  included: string[];
  linkedCoach: CampCoachRef | null;
  payDirect: boolean;
  /** Waiver link as typed or uploaded ("" = none). */
  waiverUrl: string;
};

let groupKey = 0;
const newKey = () => `g${Date.now().toString(36)}${(groupKey += 1)}`;

export const newGroup = (previous?: CampDraftGroup): CampDraftGroup => ({
  key: newKey(),
  name: "",
  description: "",
  start: previous?.start ?? "09:00",
  end: previous?.end ?? "12:00",
  spots: previous?.spots ?? 12,
});

export const emptyCampDraft = (): CampDraft => ({
  name: "",
  description: "",
  startsOn: null,
  endsOn: null,
  location: "",
  groups: [newGroup()],
  price: "",
  coverUrl: null,
  included: [],
  linkedCoach: null,
  // New camps let families pay the coach directly; the coach can turn it off.
  payDirect: true,
  waiverUrl: "",
});

const priceText = (cents: number) => (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));

/** The editor's form for a saved camp. */
export const draftFromCamp = (camp: CoachCamp): CampDraft => ({
  name: camp.name,
  description: camp.description ?? "",
  startsOn: camp.starts_on?.slice(0, 10) ?? null,
  endsOn: camp.ends_on?.slice(0, 10) ?? null,
  location: camp.location ?? "",
  groups: camp.groups.length
    ? camp.groups.map((g) => ({
        key: g.id,
        id: g.id,
        name: g.name === "All athletes" && camp.groups.length === 1 ? "" : g.name,
        description: g.description ?? "",
        start: g.start_time.slice(0, 5),
        end: g.end_time.slice(0, 5),
        spots: g.spots,
      }))
    : [newGroup()],
  price: camp.price_cents ? priceText(camp.price_cents) : "",
  coverUrl: camp.cover_url,
  included: [...camp.included],
  linkedCoach: camp.linked_coach,
  payDirect: camp.pay_direct,
  waiverUrl: camp.waiver_url ?? "",
});

/** "Run a camp again": everything but the dates, as a new camp (new groups, no ids). */
export const runAgainDraft = (camp: CoachCamp): CampDraft => {
  const draft = draftFromCamp(camp);
  return {
    ...draft,
    startsOn: null,
    endsOn: null,
    groups: draft.groups.map((g) => ({ ...g, id: undefined, key: newKey() })),
  };
};

/**
 * Picking a day on the Starts or Ends tile. A start after the end moves the end with it; an end
 * before the start swaps them. The same day twice is a one-day camp.
 */
export const pickCampDay = (
  dates: { startsOn: string | null; endsOn: string | null },
  which: "start" | "end",
  day: string,
): { startsOn: string | null; endsOn: string | null } => {
  if (which === "start") {
    return { startsOn: day, endsOn: dates.endsOn && dates.endsOn >= day ? dates.endsOn : day };
  }
  if (!dates.startsOn) return { startsOn: day, endsOn: day };
  if (day < dates.startsOn) return { startsOn: day, endsOn: dates.startsOn };
  return { startsOn: dates.startsOn, endsOn: day };
};

export type CampStep = "name" | "dates" | "where" | "groups" | "price" | "details" | "review";
/** Phone: one question per screen. The first five fill the progress bar. */
export const CAMP_STEPS: CampStep[] = ["name", "dates", "where", "groups", "price", "details", "review"];
export const CAMP_PROGRESS_STEPS = 5;

const groupsReady = (groups: CampDraftGroup[]) =>
  groups.length >= 1 &&
  groups.length <= 4 &&
  groups.every((g) => g.spots >= 1 && g.spots <= 60 && timeToMinutes(g.end) > timeToMinutes(g.start)) &&
  (groups.length === 1 || groups.every((g) => g.name.trim()));

/** Whether a phone question has its answer (Next stays off until it does). Details is optional. */
export const campStepAnswered = (step: CampStep, draft: CampDraft, today: string): boolean => {
  if (step === "name") return draft.name.trim().length > 0 && draft.name.trim().length <= 100;
  if (step === "dates") return Boolean(draft.startsOn && draft.endsOn && draft.startsOn >= today && draft.endsOn >= draft.startsOn);
  if (step === "where") return draft.location.trim().length > 0 && draft.location.trim().length <= 200;
  if (step === "groups") return groupsReady(draft.groups);
  if (step === "price") return parsePriceCents(draft.price) != null;
  return true;
};

/** What "Still missing: …" lists before Review camp turns on. */
export const campMissing = (draft: CampDraft, today: string): string[] => {
  const missing: string[] = [];
  if (!campStepAnswered("name", draft, today)) missing.push("camp name");
  if (!campStepAnswered("dates", draft, today)) missing.push(draft.startsOn && draft.startsOn < today ? "dates from today on" : "dates");
  if (!campStepAnswered("where", draft, today)) missing.push("location");
  if (!campStepAnswered("groups", draft, today)) {
    missing.push(draft.groups.length > 1 && draft.groups.some((g) => !g.name.trim()) ? "group names" : "group times");
  }
  if (!campStepAnswered("price", draft, today)) missing.push("price per athlete");
  if (campWaiverUrlError(draft.waiverUrl)) missing.push("a waiver link that starts with https://");
  return missing;
};

export const missingLine = (missing: string[]) => (missing.length ? `Still missing: ${missing.join(", ")}` : null);

/** What save_camp takes. Groups are never empty; one unnamed group is "All athletes" on the server. */
export const draftToPayload = (draft: CampDraft): { camp: CampInputPayload; groups: CampGroupInput[] } => ({
  camp: {
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    price_cents: parsePriceCents(draft.price) ?? 0,
    starts_on: draft.startsOn,
    ends_on: draft.endsOn ?? draft.startsOn,
    location: draft.location.trim() || null,
    cover_url: draft.coverUrl,
    included: draft.included.map((item) => item.trim()).filter(Boolean),
    pay_direct: draft.payDirect,
    waiver_url: campWaiverUrl(draft.waiverUrl),
    linked_coach_id: draft.linkedCoach?.id ?? null,
  },
  groups: draft.groups.map((g) => ({
    ...(g.id ? { id: g.id } : {}),
    name: g.name.trim(),
    description: g.description.trim() || null,
    start_time: g.start,
    end_time: g.end,
    spots: clampSpots(g.spots),
  })),
});

/** Local calendar day, "YYYY-MM-DD". */
export const localIsoDay = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// ---------------------------------------------------------------------------
// Waiver
// ---------------------------------------------------------------------------

/** Same rule as save_camp: https, a host with a dot, no spaces, up to 1000 characters. */
const WAIVER_URL = /^https:\/\/[^\s/?#]+\.\S*$/;
export const CAMP_WAIVER_MAX_BYTES = 10 * 1024 * 1024;

/** The waiver link to save, or null when there is none or it isn't a safe https link. */
export const campWaiverUrl = (text: string | null | undefined): string | null => {
  const url = (text ?? "").trim();
  return url && url.length <= 1000 && WAIVER_URL.test(url) ? url : null;
};

/** Why a typed waiver link can't be saved, or null (an empty field is fine: the waiver is optional). */
export const campWaiverUrlError = (text: string | null | undefined): string | null => {
  const url = (text ?? "").trim();
  if (!url) return null;
  return campWaiverUrl(url) ? null : "Add a link that starts with https://";
};

/** Why a waiver file can't be uploaded, or null. PDF only, up to 10 MB (the bucket's limit). */
export const campWaiverFileError = (file: { name: string; type: string; size: number }): string | null => {
  const pdf = file.type === "application/pdf" || (!file.type && /\.pdf$/i.test(file.name));
  if (!pdf) return "Choose a PDF file.";
  if (file.size > CAMP_WAIVER_MAX_BYTES) return "The waiver must be under 10 MB.";
  if (file.size === 0) return "That file is empty. Choose another PDF.";
  return null;
};

/** "camp-waiver.pdf" for an uploaded waiver, else the link's host and path, for the editor. */
export const campWaiverLabel = (url: string): string => {
  try {
    const parsed = new URL(url);
    if (parsed.pathname.includes("/camp-waivers/")) return "Waiver PDF";
    return `${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return url;
  }
};

// ---------------------------------------------------------------------------
// Review and pay
// ---------------------------------------------------------------------------

/**
 * What the family pays on the review step. Camps have no platform fee: card is the camp price
 * plus card processing (shown only on the card option); paying the coach directly is the camp
 * price and is offered whenever the camp allows it (quote.direct_allowed).
 */
export const campReviewPayment = (
  quote: { direct_allowed: boolean; card: { listCents: number; totalCents: number; platformCents: number; processingCents: number } } | null | undefined,
  pay: "card" | "direct",
  fallbackListCents: number,
) => {
  const direct = pay === "direct" && Boolean(quote?.direct_allowed);
  const card = quote?.card ?? null;
  const listCents = card?.listCents ?? fallbackListCents;
  return {
    direct,
    directOffered: Boolean(quote?.direct_allowed),
    listCents,
    /** Card processing on the card option; nothing when paying the coach directly. */
    feeCents: direct || !card ? null : card.totalCents - card.listCents,
    totalCents: direct ? listCents : card?.totalCents ?? null,
  };
};
