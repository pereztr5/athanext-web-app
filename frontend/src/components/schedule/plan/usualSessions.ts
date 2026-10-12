/**
 * Usual sessions for Plan next week: ones the coach saved, plus recent live group
 * and 1-on-1 open slots from the last 4 weeks.
 */
import type { ScheduleSession } from "@/api/schedule";
import { getZonedISODate } from "@/utils/dateHelpers";
import { addDaysISO, minutesInZone, sessionStart } from "@/utils/schedule";

export type UsualSession = {
  title: string;
  startMinutes: number;
  durationMinutes: number;
  place: string;
  price: number;
  capacity: number;
  pillar: string;
  /** Real 1-on-1 open slot, not a one-spot group. */
  isOneOnOne: boolean;
};

const keyOf = (u: UsualSession) =>
  [u.title, u.startMinutes, u.durationMinutes, u.place, u.isOneOnOne ? "1" : "g"].join("|");

const storageKey = (coachId: string) => `athanext.usualSessions.${coachId}`;

export const loadSavedUsual = (coachId: string): UsualSession[] => {
  try {
    const raw = localStorage.getItem(storageKey(coachId));
    if (!raw) return [];
    const list = JSON.parse(raw) as UsualSession[];
    return Array.isArray(list) ? list.filter((u) => u && typeof u.title === "string") : [];
  } catch {
    return [];
  }
};

export const saveUsual = (coachId: string, usual: UsualSession) => {
  const current = loadSavedUsual(coachId).filter((u) => keyOf(u) !== keyOf(usual));
  current.unshift(usual);
  try {
    localStorage.setItem(storageKey(coachId), JSON.stringify(current.slice(0, 12)));
  } catch {
    // Ignore quota / private mode.
  }
};

/** Up to 8 usual templates: saved first, then recent live sessions before next Monday. */
export const buildUsualList = ({
  coachId,
  sessions,
  todayISO,
  nextMonday,
  timeZone,
}: {
  coachId: string;
  sessions: ScheduleSession[];
  todayISO: string;
  nextMonday: string;
  timeZone: string;
}): UsualSession[] => {
  const out: UsualSession[] = [];
  const seen = new Set<string>();
  const add = (u: UsualSession) => {
    const k = keyOf(u);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(u);
  };

  loadSavedUsual(coachId).forEach(add);

  const from = addDaysISO(todayISO, -28);
  sessions
    .filter((s) => !s.isDraft)
    .filter((s) => {
      const d = getZonedISODate(sessionStart(s), timeZone);
      return d >= from && d < nextMonday;
    })
    .filter((s) => s.sessionType === "group" || (s.sessionType === "individual" && s.visibility === "open"))
    .sort((a, b) => sessionStart(a).getTime() - sessionStart(b).getTime())
    .forEach((s) => {
      const isOne = s.sessionType === "individual";
      add({
        title: isOne ? (s.pillar ? `1-on-1 ${s.pillar.toLowerCase()}` : s.sessionName) : s.sessionName,
        startMinutes: minutesInZone(sessionStart(s), timeZone),
        durationMinutes: s.durationMinutes,
        place: s.location === "online" ? "Video call" : s.place || "In person",
        price: s.price,
        capacity: isOne ? 1 : s.capacity,
        pillar: s.pillar || "On-field training",
        isOneOnOne: isOne,
      });
    });

  return out.slice(0, 8);
};
