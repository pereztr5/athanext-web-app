// Session times in emails. Sessions are stored as an Eastern wall-clock date and time
// (public.eastern_timestamp); emails show them in the coach's time zone with its abbreviation,
// e.g. "Tue, Nov 24 at 4:00 PM ET". Pure, so it is tested.

export const SESSION_TIME_ZONE = "America/New_York";

export const isValidTimeZone = (timeZone: unknown): timeZone is string => {
  if (typeof timeZone !== "string" || !timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
};

/** Offset of `timeZone` from UTC at `instant`, in minutes. */
const offsetMinutes = (instant: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return (asUtc - instant.getTime()) / 60_000;
};

/** The instant of an Eastern "2026-11-24" + "16:00:00", or null when unreadable. */
export const easternInstant = (isoDate: unknown, time: unknown): Date | null => {
  if (typeof isoDate !== "string" || typeof time !== "string") return null;
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.slice(0, 10));
  const t = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!d || !t) return null;
  const wall = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
  // Two passes settle the offset on either side of a DST change.
  let guess = wall - offsetMinutes(new Date(wall), SESSION_TIME_ZONE) * 60_000;
  guess = wall - offsetMinutes(new Date(guess), SESSION_TIME_ZONE) * 60_000;
  return new Date(guess);
};

/** "ET", "CT", "MT", "PT" for US zones; otherwise the short name Intl gives ("GMT+1", "AKST"). */
const zoneLabel = (instant: Date, timeZone: string) => {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
      .formatToParts(instant)
      .find((p) => p.type === "timeZoneName")?.value ?? "";
  if (timeZone === "America/Phoenix") return "MST";
  return /^[ECMP][SD]T$/.test(name) ? `${name[0]}T` : name;
};

/**
 * "Tue, Nov 24 at 4:00 PM ET" for a stored Eastern session date and time, shown in `timeZone`
 * (the coach's; Eastern when missing or invalid). Falls back to the raw values when unreadable.
 */
export const formatSessionWhen = (isoDate: unknown, time: unknown, timeZone?: unknown): string => {
  const zone = isValidTimeZone(timeZone) ? timeZone : SESSION_TIME_ZONE;
  const instant = easternInstant(isoDate, time);
  if (!instant) return typeof isoDate === "string" ? isoDate : "your session";
  const day = instant.toLocaleDateString("en-US", { timeZone: zone, weekday: "short", month: "short", day: "numeric" });
  const clock = instant.toLocaleTimeString("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" });
  // Newer ICU puts a narrow no-break space before AM/PM; emails get a plain one.
  return `${day} at ${clock} ${zoneLabel(instant, zone)}`.replace(/[\u202f\u00a0]/g, " ");
};
