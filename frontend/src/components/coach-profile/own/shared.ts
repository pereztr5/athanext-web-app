/** Helpers and class strings shared by the coach's own profile (view and Edit profile). */
import { BASE_SERVICE_ID, type ProfileService } from "@/api/coachProfile";
import { AGE_AND_UP } from "@/utils/coachAges";
import { cn } from "@/lib/utils";
import type { CoachProfileData } from "../CoachProfileView";

export const money = (dollars: number) => `$${Math.round(dollars).toLocaleString("en-US")}`;
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Working Copy `.sp2-h`. */
export const sectionTitle = "text-[20px] font-medium leading-[22px] tracking-[-0.05em] text-[#1A202C]";
export const caption = "text-[12px] leading-[16px] tracking-[-0.03em] text-[#767980]";
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
  hours ? `Free cancellation up to ${hours} hours before` : policy?.trim() || "Free cancellation up to 24 hours before";

/** "Within an hour", "Within a day", "Within 12 hours". */
export const repliesLabel = (hours?: number | null) => {
  const h = hours ?? 24;
  if (h <= 1) return "Within an hour";
  if (h === 24) return "Within a day";
  if (h % 24 === 0) return `Within ${h / 24} days`;
  return `Within ${h} hours`;
};

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
    "inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-[8px] border px-3 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2] [&>svg]:size-4",
    on ? "border-[#1A202C] bg-[#F7F7F0]" : "border-[#EAEADF] bg-[#F4F4EB] hover:border-[#C1C1B8]"
  );
