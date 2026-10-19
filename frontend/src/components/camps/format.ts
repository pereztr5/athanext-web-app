/** Display helpers for camp cards. Dates stay on the UTC calendar day stored in the database. */

export const packageKind = (pkg: object): string => ((pkg as { kind?: unknown }).kind === "camp" ? "camp" : "package");

export const campMoney = (dollars: number) => `$${Math.round(dollars).toLocaleString("en-US")}`;

export const campInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

export const todayUtc = () => new Date().toISOString().slice(0, 10);

export const campEnded = (endsOn: string | null, today = todayUtc()) => Boolean(endsOn && endsOn.slice(0, 10) < today);

export const spotsLabel = (spotsLeft: number | null): string | null => {
  if (spotsLeft == null) return null;
  if (spotsLeft <= 0) return "Full";
  return spotsLeft === 1 ? "1 spot left" : `${spotsLeft} spots left`;
};

export const formatAges = (min: number | null, max: number | null): string | null => {
  if (min != null && max != null) return min === max ? `Age ${min}` : `Ages ${min} to ${max}`;
  if (min != null) return `Ages ${min} and up`;
  if (max != null) return `Ages up to ${max}`;
  return null;
};

const formatDay = (iso: string, withYear: boolean) => {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  });
};

export const formatCampDates = (start: string | null, end: string | null): string | null => {
  const first = start?.slice(0, 10) || null;
  const last = end?.slice(0, 10) || null;
  if (!first && !last) return null;
  if (first && last && first !== last) {
    const withYear = first.slice(0, 4) !== last.slice(0, 4);
    return `${formatDay(first, withYear)} to ${formatDay(last, withYear)}`;
  }
  return formatDay((first || last) as string, false);
};

export const formatClock = (value: string | null): string | null => {
  if (!value) return null;
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
};

export const formatDailyTime = (start: string | null, end: string | null): string | null => {
  const open = formatClock(start);
  const close = formatClock(end);
  if (open && close) return `${open} to ${close}`;
  return open || close;
};

export const inclusiveDays = (start: string, end: string): number => {
  const first = Date.parse(`${start.slice(0, 10)}T00:00:00Z`);
  const last = Date.parse(`${end.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) return 0;
  return Math.round((last - first) / 86_400_000) + 1;
};

export const minutesBetween = (start: string, end: string): number => {
  const toMinutes = (value: string) => {
    const [hourText, minuteText] = value.split(":");
    const hour = Number(hourText);
    const minute = Number(minuteText);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return hour * 60 + minute;
  };
  const open = toMinutes(start);
  const close = toMinutes(end);
  if (open == null || close == null || close <= open) return 0;
  return close - open;
};

export const validityThrough = (end: string, today = todayUtc()): number => Math.max(1, inclusiveDays(today, end));
