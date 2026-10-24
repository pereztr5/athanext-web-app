/**
 * Coach Home "Coming up" camps: published camps that haven't ended yet, soonest first,
 * with the sign-up line, the money still to collect and the first day still ahead.
 * "Today" is the Eastern calendar day, like camp dates and the rest of the schedule.
 */
import type { CoachCamp } from "@/api/camps";
import { formatCampMoney } from "@/utils/camps";
import { getZonedISODate, SESSION_TIME_ZONE } from "@/utils/dateHelpers";

export type ComingUpCamp = {
  camp: CoachCamp;
  /** "YYYY-MM-DD": today when the camp is running, else its first day. */
  nextDay: string;
  taken: number;
  spots: number;
  /** "1 of 20 signed up". */
  signUps: string;
  /** Held spots not marked paid yet, at the camp price. */
  toCollectCents: number;
  /** "$300 to collect", or null when nothing is owed. */
  toCollect: string | null;
};

const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : null);

/** Group spots, or the old camp capacity for camps without groups. */
export const campSpots = (camp: Pick<CoachCamp, "groups" | "capacity">): number =>
  (camp.groups ?? []).reduce((n, g) => n + (Number(g.spots) || 0), 0) || Number(camp.capacity) || 0;

export const comingUpCamps = (camps: CoachCamp[] | null | undefined, now: Date = new Date()): ComingUpCamp[] => {
  const today = getZonedISODate(now, SESSION_TIME_ZONE);
  return (camps ?? [])
    .filter((camp) => {
      const start = day(camp.starts_on);
      if (!camp.published || !camp.is_active || !start) return false;
      return (day(camp.ends_on) ?? start) >= today;
    })
    .sort((a, b) => day(a.starts_on)!.localeCompare(day(b.starts_on)!) || a.name.localeCompare(b.name))
    .map((camp) => {
      const start = day(camp.starts_on)!;
      const taken = Math.max(0, Number(camp.taken) || 0);
      const spots = campSpots(camp);
      const toCollectCents = Math.max(0, Number(camp.waiting_count) || 0) * Math.max(0, Number(camp.price_cents) || 0);
      return {
        camp,
        nextDay: start > today ? start : today,
        taken,
        spots,
        signUps: spots ? `${taken} of ${spots} signed up` : `${taken} signed up`,
        toCollectCents,
        toCollect: toCollectCents > 0 ? `${formatCampMoney(toCollectCents)} to collect` : null,
      };
    });
};
