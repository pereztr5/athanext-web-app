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

const formatClock = (value: string | null): string | null => {
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
