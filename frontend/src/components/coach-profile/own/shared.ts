/** Helpers and class strings shared by the coach's own profile (view and Edit profile). */
import { BASE_SERVICE_ID, type ProfileService } from "@/api/coachProfile";
import { AGE_AND_UP } from "@/utils/coachAges";
import { cn } from "@/lib/utils";
import type { CoachProfileData } from "../CoachProfileView";

export const money = (dollars: number) => `$${Math.round(dollars).toLocaleString("en-US")}`;
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Working Copy `.sp2-h`. */
export const sectionTitle = "text-card-title text-dark";
export const caption = "text-caption text-dark-300";
/** Working Copy `.sp2-card`: the shared card with 18px gaps. */
export const sp2Card = "gap-[18px]";

/** "Soccer · Field players", from the coach's sport and positions. */
export const coachesLine = (coach: CoachProfileData) => {
  const sport = coach.sport ? coach.sport.charAt(0).toUpperCase() + coach.sport.slice(1) : "";
  const positions = ((coach as { favourite_positions?: string[] | null }).favourite_positions ?? []).map((p) => p.toLowerCase());
  const keeper = positions.some((p) => p.includes("goal") || p === "gk");
  const field = positions.some((p) => !(p.includes("goal") || p === "gk"));
  const who = !positions.length ? "" : keeper && field ? "Field players and goalkeepers" : keeper ? "Goalkeepers" : "Field players";
  return [sport, who].filter(Boolean).join(" · ");
};

/**
 * The coach's title from the positions they coach ("Goalkeeper coach", "Goalkeeper and field
 * player coach"). Read only on Edit profile: it follows coaches.favourite_positions.
 */
export const coachTitle = (coach: { favourite_positions?: string[] | null; positions?: string[] | null }) => {
  const list = (coach.favourite_positions?.length ? coach.favourite_positions : coach.positions ?? [])
    .map((p) => p.trim())
    .filter(Boolean);
  const names = Array.from(new Set(list.map((p) => p.toLowerCase()))).map((p, i) => (i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p));
  if (!names.length) return "Coach";
  const joined = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${joined} coach`;
};

/** "Ages 10 to 19" or "Ages 18 and up"; empty when not set. */
export const agesLine = ({ age_min, age_max }: { age_min?: number | null; age_max?: number | null }) => {
  if (age_min == null && age_max == null) return "";
  const lo = age_min ?? 3;
  if (age_max == null || age_max >= AGE_AND_UP) return `Ages ${lo} and up`;
  return lo === age_max ? `Age ${lo}` : `Ages ${lo} to ${age_max}`;
};

/** "In person", "Video call" or both, from coaches.session_types. */
export const whereFromSessionTypes = (types?: string[] | null) => {
  const t = (types ?? []).map((x) => x.toLowerCase());
  const inPerson = t.some((x) => x.includes("person"));
  const video = t.some((x) => x.includes("virtual") || x.includes("online") || x.includes("video"));
  if (inPerson && video) return "In person or video call";
  if (video) return "Video call";
  return "In person";
};

/** coaches.session_types for a "Where" choice on the base 1-on-1 row. */
export const sessionTypesFromWhere = (where: string) =>
  where === "Video call" ? ["virtual"] : where === "In person or video call" ? ["in-person", "virtual"] : ["in-person"];

/** Cancellation line under Sessions and pricing: notice hours, else the coach's policy text, else 24 hours. */
export const cancellationLine = (hours?: number | null, policy?: string | null) =>
  hours
    ? `Cancel up to ${hours} hours before for a session credit`
    : policy?.trim() || "Cancel up to 24 hours before for a session credit";

/** Session types with the base 1-on-1 row first, priced from hourly_rate. `always` keeps the base row while editing. */
export const withBaseService = (
  services: ProfileService[],
  coach: Pick<CoachProfileData, "hourly_rate" | "session_types">,
  always = false
): ProfileService[] => {
  const hourly = Number(coach.hourly_rate) || 0;
  const stored = services.find((s) => s.id === BASE_SERVICE_ID);
  const base: ProfileService = {
    id: BASE_SERVICE_ID,
    name: stored?.name || "Individual session",
    format: "individual",
    minutes: stored?.minutes || 60,
    where: stored?.where || whereFromSessionTypes(coach.session_types),
    price: hourly,
    on: stored ? stored.on : true,
  };
  return [...(always || hourly > 0 || stored ? [base] : []), ...services.filter((s) => s.id !== BASE_SERVICE_ID)];
};

/** Reviewers show as first name and last initial ("Casey S."). */
export const shortName = (name?: string | null) => {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "A family";
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
};

/** "Parent of a U16 athlete" or "Athlete, 18+". */
export const reviewerContext = (age?: number | null) => {
  if (age == null || age < 0) return "Family";
  return age >= 18 ? "Athlete, 18+" : `Parent of a U${age + 1} athlete`;
};

export const shortDate = (value?: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: "numeric" }) });
};

/** Working Copy `.chip`: toggle chip with a check when on. */
export const chip = (on: boolean) =>
  cn(
    "inline-flex h-control-sm items-center gap-1.5 whitespace-nowrap rounded-control border px-3 text-label-sm text-dark transition-colors [&>svg]:size-4",
    // The one selected style for choices: primary-50 fill, 1px primary border.
    on ? "border-primary bg-primary-50 text-primary" : "border-light-525 bg-light-400 hover:border-light-600"
  );
