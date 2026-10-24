/**
 * Viewer time zone helpers (ATH-22).
 * Sessions are stored as Eastern wall-clock date + time; these convert them to real
 * instants and format them in the viewer's IANA zone. Display only: storage and the
 * Eastern booking window stay unchanged.
 */
import { SESSION_TIME_ZONE, zonedWallTimeToUtc, getZonedISODate } from "@/utils/dateHelpers";

export const isValidTimeZone = (timeZone: string | null | undefined): timeZone is string => {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
};

export const browserTimeZone = (): string => {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(zone) ? zone : SESSION_TIME_ZONE;
  } catch {
    return SESSION_TIME_ZONE;
  }
};

/** The saved preference when valid, otherwise the browser's zone. */
export const resolveTimeZone = (preferred?: string | null): string =>
  isValidTimeZone(preferred) ? preferred : browserTimeZone();

/**
 * Eastern session date + time as an ISO instant ("…Z").
 * Falls back to the naive local string if the inputs can't be parsed.
 */
export const sessionInstantISO = (isoDate: string, time: string): string => {
  const instant = isoDate && time ? zonedWallTimeToUtc(isoDate, time) : null;
  return instant ? instant.toISOString() : `${isoDate}T${time}`;
};

const clockParts = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { clock: `${get("hour")}:${get("minute")}`, period: get("dayPeriod").toLowerCase() };
};

/** "4:00 to 5:00 pm" in `timeZone`, keeping one am/pm when both times share it. */
export const formatInstantSpan = (start: Date, end: Date, timeZone: string): string => {
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return "";
  const s = clockParts(start, timeZone);
  const e = clockParts(end, timeZone);
  return s.period === e.period
    ? `${s.clock} to ${e.clock} ${e.period}`
    : `${s.clock} ${s.period} to ${e.clock} ${e.period}`;
};

/** Lower-case the day period, as the brand writes times ("4:00 pm"). */
export const lowerPeriod = (text: string): string => text.replace(/\b(AM|PM)\b/g, (p) => p.toLowerCase());

export const formatDateInZone = (
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions
): string => (isNaN(date.getTime()) ? "" : lowerPeriod(new Intl.DateTimeFormat("en-US", { ...options, timeZone }).format(date)));

/** Calendar date (YYYY-MM-DD) of an instant in `timeZone`. */
export const isoDateInZone = (date: Date, timeZone: string): string => getZonedISODate(date, timeZone);

/**
 * Eastern slot (date + start/end clock) formatted for the viewer.
 * `dayShift` is set when the viewer's calendar day differs from the Eastern one.
 */
export const formatSlotForViewer = (
  isoDate: string | null | undefined,
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  timeZone: string
): { span: string; dayShift: string | null } => {
  if (!isoDate || !startTime || !endTime) return { span: "", dayShift: null };
  const start = zonedWallTimeToUtc(isoDate, startTime);
  const end = zonedWallTimeToUtc(isoDate, endTime);
  if (!start || !end) return { span: "", dayShift: null };
  const viewerDate = isoDateInZone(start, timeZone);
  return {
    span: formatInstantSpan(start, end, timeZone),
    dayShift:
      viewerDate === isoDate
        ? null
        : formatDateInZone(start, timeZone, { weekday: "short", month: "short", day: "numeric" }),
  };
};

/** Short zone label such as "EDT", "PST" or "GMT+5". */
export const timeZoneAbbreviation = (timeZone: string, at: Date = new Date()): string => {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName");
    return part?.value ?? timeZone;
  } catch {
    return timeZone;
  }
};

/**
 * Camp times are the camp's own clock: stored like every session as Eastern wall time, and shown
 * that way to everyone with the zone ("4:00 to 5:30 pm ET"), never moved to the viewer's zone.
 */
export const CAMP_TIME_ZONE = SESSION_TIME_ZONE;

/** Short generic zone label ("ET", "CT"); the abbreviation ("GMT+1") where there's no short name. */
export const shortZoneLabel = (timeZone: string, at: Date = new Date()): string => {
  try {
    const generic = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortGeneric" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value;
    if (generic && !/\s/.test(generic)) return generic;
  } catch {
    // Older engines without shortGeneric fall through.
  }
  return timeZoneAbbreviation(timeZone, at);
};

/** The camp clock's label: "ET". */
export const campZoneLabel = (at?: Date): string => shortZoneLabel(CAMP_TIME_ZONE, at);

/**
 * Session span for display: camp sessions on the camp clock with its zone ("4:00 to 5:30 pm ET"),
 * every other session in the viewer's zone, unchanged.
 */
export const formatSessionSpan = (start: Date, end: Date, viewerTimeZone: string, isCamp: boolean): string => {
  if (!isCamp) return formatInstantSpan(start, end, viewerTimeZone);
  const span = formatInstantSpan(start, end, CAMP_TIME_ZONE);
  return span ? `${span} ${campZoneLabel(start)}` : span;
};

/** The zone a session's date and time show in: the camp clock for camp sessions. */
export const sessionDisplayZone = (viewerTimeZone: string, isCamp: boolean): string =>
  isCamp ? CAMP_TIME_ZONE : viewerTimeZone;

export interface TimeZoneOption {
  value: string;
  label: string;
}

// Curated list for Account Settings; the browser zone is added if it's missing.
const COMMON_TIME_ZONES: TimeZoneOption[] = [
  { value: "America/New_York", label: "Eastern Time (New York)" },
  { value: "America/Chicago", label: "Central Time (Chicago)" },
  { value: "America/Denver", label: "Mountain Time (Denver)" },
  { value: "America/Phoenix", label: "Mountain Time, no DST (Phoenix)" },
  { value: "America/Los_Angeles", label: "Pacific Time (Los Angeles)" },
  { value: "America/Anchorage", label: "Alaska Time (Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (Honolulu)" },
  { value: "America/Puerto_Rico", label: "Atlantic Time (Puerto Rico)" },
  { value: "America/Halifax", label: "Atlantic Time (Halifax)" },
  { value: "America/Toronto", label: "Eastern Time (Toronto)" },
  { value: "America/Vancouver", label: "Pacific Time (Vancouver)" },
  { value: "America/Mexico_City", label: "Mexico City" },
  { value: "America/Bogota", label: "Bogotá" },
  { value: "America/Sao_Paulo", label: "São Paulo" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Dublin", label: "Dublin" },
  { value: "Europe/Lisbon", label: "Lisbon" },
  { value: "Europe/Madrid", label: "Madrid" },
  { value: "Europe/Paris", label: "Paris" },
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Europe/Rome", label: "Rome" },
  { value: "Europe/Amsterdam", label: "Amsterdam" },
  { value: "Europe/Stockholm", label: "Stockholm" },
  { value: "Europe/Athens", label: "Athens" },
  { value: "Europe/Istanbul", label: "Istanbul" },
  { value: "Africa/Lagos", label: "Lagos" },
  { value: "Africa/Johannesburg", label: "Johannesburg" },
  { value: "Asia/Dubai", label: "Dubai" },
  { value: "Asia/Tashkent", label: "Tashkent" },
  { value: "Asia/Kolkata", label: "India (Kolkata)" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Shanghai", label: "China (Shanghai)" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Asia/Seoul", label: "Seoul" },
  { value: "Australia/Sydney", label: "Sydney" },
  { value: "Pacific/Auckland", label: "Auckland" },
];

export const getTimeZoneOptions = (extra?: string | null): TimeZoneOption[] => {
  const options = [...COMMON_TIME_ZONES];
  [extra, browserTimeZone()].forEach((zone) => {
    if (isValidTimeZone(zone) && !options.some((option) => option.value === zone)) {
      options.unshift({ value: zone, label: zone.replace(/_/g, " ") });
    }
  });
  return options;
};
