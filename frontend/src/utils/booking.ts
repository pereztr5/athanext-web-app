/**
 * Book a Session helpers (ATH-73): pillar copy from the prototype, and grouping a coach's
 * bookable sessions into the viewer's days.
 */
import type { BookableSession } from "@/api/book";
import { getZonedISODate, zonedWallTimeToUtc } from "@/utils/dateHelpers";

/** Book by pillar skips the Goalkeeper / Field player choice for these. */
export const NO_POSITION_PILLARS = ["Academic tutoring"];

export const PILLAR_COPY: Record<string, { blurb: string; session: string; bring: string }> = {
  "On-field training": {
    blurb: "Technical and tactical work on the ball",
    session: "A quick check-in on what to improve, focused reps, then a short game. Notes go to the family afterwards.",
    bring: "Ball, water, cleats and shin guards",
  },
  "Video analysis": {
    blurb: "Your game film reviewed clip by clip",
    session: "Send a link to game film before the call. The coach breaks it down clip by clip and sends three things to work on.",
    bring: "A link to game film",
  },
  Mentorship: {
    blurb: "Mindset, habits and goal setting",
    session: "A relaxed video call about goals, habits and what's getting in the way, with one small step to try before next time.",
    bring: "Just yourself",
  },
  "Performance coaching": {
    blurb: "Speed, strength and conditioning",
    session: "Warm-up, a speed or strength block, then a cool-down. Each session builds on the last, with a short home plan.",
    bring: "Trainers, water, a towel",
  },
  "Academic tutoring": {
    blurb: "Study support and test prep",
    session: "Bring homework or a topic. Sessions mix explanation and practice, with a short recap afterwards.",
    bring: "Homework or class notes",
  },
  "College recruiting": {
    blurb: "Profiles, film and outreach plans",
    session: "A review of profile, film and target schools, ending with a clear list of next steps.",
    bring: "Highlight film and grades if you have them",
  },
};

export const pillarCopy = (pillar: string | null | undefined) =>
  PILLAR_COPY[pillar ?? ""] ?? PILLAR_COPY["On-field training"];

export const bookableStart = (s: Pick<BookableSession, "date" | "startTime">): Date =>
  zonedWallTimeToUtc(s.date, s.startTime) ?? new Date(NaN);
export const bookableEnd = (s: Pick<BookableSession, "date" | "endTime">): Date =>
  zonedWallTimeToUtc(s.date, s.endTime) ?? new Date(NaN);

export type BookFormat = "all" | "group" | "individual";

/** Whether a session can be picked: not already the family's, and not full. */
export const isPickable = (s: BookableSession) =>
  !s.myStatus && (s.sessionType === "group" ? s.bookedCount < s.capacity : s.bookedCount === 0);

/** Sessions on each of `dates` (viewer zone): pickable ones for the format, plus the family's own. Groups first. */
export const sessionsByDay = (
  sessions: BookableSession[],
  dates: string[],
  timeZone: string,
  format: BookFormat
): Map<string, BookableSession[]> => {
  const out = new Map<string, BookableSession[]>(dates.map((d) => [d, []]));
  sessions.forEach((s) => {
    if (!s.myStatus) {
      if (!isPickable(s)) return;
      if (format !== "all" && s.sessionType !== format) return;
    }
    out.get(getZonedISODate(bookableStart(s), timeZone))?.push(s);
  });
  out.forEach((list) =>
    list.sort((a, b) => bookableStart(a).getTime() - bookableStart(b).getTime() || (a.sessionType === "group" ? -1 : 1))
  );
  return out;
};

export const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
