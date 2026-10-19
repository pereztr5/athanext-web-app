/** Class strings and labels for the coach's athlete page (Working Copy `.sp-*`). */
import type { AthleteSession } from "@/api/roster";
import { getZonedISODate, zonedWallTimeToUtc } from "@/utils/dateHelpers";
import { formatClock, formatDayISO } from "@/utils/schedule";

/** Working Copy `.sp-lh`. */
export const listLabel = "mb-0.5 mt-2 text-label-xsm text-dark-300";
/** Working Copy `.sp-due`. */
export const dueText = "text-label-xsm text-info-800";
/** Working Copy `.lnkb`. */
export const linkButton = "font-medium text-primary hover:underline";

/** Day and time of a session in the viewer's zone: "2026-09-28" and "4:00 pm". */
export const zoned = (date: string, startTime: string, timeZone: string) => {
  const at = zonedWallTimeToUtc(date, startTime) ?? new Date(NaN);
  return { day: getZonedISODate(at, timeZone), clock: formatClock(at, timeZone) };
};

/** "Ava usually trains Mondays at 4:00 pm." from the most common day and time they came. */
export const usualTime = (first: string, past: AthleteSession[], timeZone: string): string | null => {
  const came = past.filter((s) => !s.noShow);
  const counts = new Map<string, number>();
  let best: string | null = null;
  for (const s of came.length ? came : past) {
    const { day, clock } = zoned(s.date, s.startTime, timeZone);
    const key = `${formatDayISO(day, { weekday: "long" })}s at ${clock}`;
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    if (!best || n > (counts.get(best) ?? 0)) best = key;
  }
  return best ? `${first} usually trains ${best}.` : null;
};

/** "March" this year, "Mar 2025" before. */
export const sinceLabel = (joinedOn: string | null, today: string) => {
  if (!joinedOn) return null;
  const iso = joinedOn.slice(0, 10);
  return iso.slice(0, 4) === today.slice(0, 4)
    ? formatDayISO(iso, { month: "long" })
    : formatDayISO(iso, { month: "short", year: "numeric" });
};
