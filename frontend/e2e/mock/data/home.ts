import type { MockBackend } from "../backend";
import { IDS } from "../personas";
import { rosterRows } from "./athletes";
import { seedCoachLookup } from "./business";
import { SCH, addDays, etDate, happeningNow, installSchedule, scheduleBooking, scheduleSession } from "./schedule";

// Home for both roles. The coach side is get_coach_schedule (installSchedule), get_coach_earnings,
// get_feedback_due, get_coach_roster, coach_pending_offline_payments and get_coach_camps; the
// family side is get_athlete_home (shaped like the mapper in src/api/athleteHome.ts), plus
// get_my_invoices. Session dates and times are Eastern wall-clock, like the database stores them.

type Row = Record<string, unknown>;

export const HOME = {
  privateToday: SCH.live,
  groupToday: SCH.group,
  requestSlot: SCH.request,
  feedbackSlot: SCH.past,
  offlineBooking: "0000b0b1-0000-4000-8000-000000000001",
  offlineOccurrence: "0000b0b1-0000-4000-8000-0000000000c1",
  camp: SCH.camp,
  coachJordan: "0000c0a0-0000-4000-8000-0000000000c2",
  nextSession: "0000a700-0000-4000-8000-0000000005e1",
  invoice: "0000a700-0000-4000-8000-0000000001e1",
} as const;

/** Minutes between two "HH:MM:SS" wall times. */
const minutesBetween = (start: string, end: string) => {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return Math.max(1, m(end) - m(start));
};

/** One element of get_coach_earnings().days for each of the last `n` days. */
export const earningsDays = (n: number, amount: (i: number) => number) => {
  const today = etDate();
  return Array.from({ length: n }, (_, i) => ({ date: addDays(today, i - n + 1), amount: amount(i) }));
};

/**
 * Casey's Home with something in every card: a 1-on-1 with Alex and a group (2 of 6) happening
 * now, an open slot tomorrow with a request from Blake, money in for the chosen period (the
 * period before earns half), one session waiting for feedback, an offline payment to confirm and
 * a published camp next month.
 */
export const seedCoachHome = (backend: MockBackend) => {
  seedCoachLookup(backend);
  const now = happeningNow();
  const today = etDate();
  const duration = minutesBetween(now.start, now.end);
  const store = installSchedule(backend, {
    sessions: [
      scheduleSession({
        id: HOME.privateToday,
        date: now.date,
        start_time: now.start,
        end_time: now.end,
        duration_minutes: duration,
        bookings: [scheduleBooking({ id: SCH.bookingA, athlete_name: "Alex Athlete", payment_status: "paid" })],
      }),
      scheduleSession({
        id: HOME.groupToday,
        date: now.date,
        start_time: now.start,
        end_time: now.end,
        duration_minutes: duration,
        session_type: "group",
        session_name: "Finishing group",
        capacity: 6,
        price: 30,
        bookings: [
          scheduleBooking({ id: SCH.bookingB, athlete_id: SCH.athleteB, athlete_name: "Blake Baker", payment_status: "paid" }),
          scheduleBooking({ id: SCH.bookingC, athlete_id: SCH.athleteC, athlete_name: "Cara Cole", payment_status: "unpaid", status: "pending_payment" }),
        ],
      }),
      scheduleSession({
        id: HOME.requestSlot,
        date: addDays(today, 1),
        start_time: "17:00:00",
        bookings: [scheduleBooking({ id: "0000b0b1-0000-4000-8000-0000000000a1", athlete_id: SCH.athleteB, athlete_name: "Blake Baker", status: "requested", payment_status: "unpaid" })],
      }),
    ],
  });

  // Money: the chosen period earns $40 a day, the period before it $20, so the change is +100%.
  backend.rpc.get_coach_earnings = (args: Row) => {
    const days = Number(args.p_days) || 7;
    const before = Math.max(days, 7);
    return {
      days: [...earningsDays(before, () => 20).map((d) => ({ ...d, date: addDays(d.date, -days) })), ...earningsDays(days, () => 40)],
      owed: 240,
      overdue_count: 1,
    };
  };
  backend.rpc.get_feedback_due = [{ id: HOME.feedbackSlot, date: addDays(today, -1), start_time: "16:00:00", session_name: "Ball mastery", session_type: "individual" }];
  backend.rpc.get_coach_roster = rosterRows();
  backend.rpc.coach_pending_offline_payments = [
    {
      booking_id: HOME.offlineBooking,
      occurrence_id: HOME.offlineOccurrence,
      athlete_id: SCH.athleteB,
      athlete_name: "Blake Baker",
      payer_name: "Dana Baker",
      occurrence_date: addDays(today, -2),
      start_time: "17:00:00",
      session_name: "Speed session",
      amount: 60,
      session_done: true,
    },
  ];
  backend.rpc.confirm_offline_payment = null;
  backend.rpc.get_coach_camps = [
    {
      id: HOME.camp,
      coach_id: IDS.coach,
      name: "Winter skills camp",
      description: null,
      price_cents: 20000,
      starts_on: addDays(today, 20),
      ends_on: addDays(today, 22),
      days: 3,
      location: "Central Park",
      capacity: 12,
      taken: 5,
      slug: "winter-skills",
      coach_slug: IDS.coachSlug,
      cover_url: null,
      included: [],
      tags: [],
      pay_direct: true,
      is_active: true,
      published: true,
      published_at: "2026-10-01T10:00:00Z",
      groups: [{ id: SCH.campGroup, name: "All athletes", description: null, start_time: "09:00", end_time: "12:00", spots: 12, taken: 5, sort_order: 0 }],
      paid_count: 3,
      waiting_count: 2,
    },
  ];
  backend.rpc.get_my_new_camp_signups = [];
  return store;
};

/** get_athlete_home: who the athlete is, the next session, the coach's focus and their coaches. */
export const athleteHome = (over: { athlete?: Row | null; next?: Row | null; focus?: Row | null; coaches?: Row[] } = {}) => {
  const today = etDate();
  return {
    athlete: {
      id: IDS.athlete,
      full_name: "Alex Athlete",
      date_of_birth: "2010-05-01",
      sport: "soccer",
      position: "Forward",
      team: "Rovers FC",
      graduation_year: 2028,
      pathway: null,
      season_goal: null,
      highlight_video_url: null,
      photo: null,
    },
    next: {
      id: HOME.nextSession,
      date: addDays(today, 2),
      start_time: "10:00:00",
      end_time: "11:00:00",
      title: "Finishing",
      place: "Central Park",
      coach_name: "Casey Coach",
      status: "booked",
      is_camp: false,
    },
    focus: { text: "Weak-foot finishing", coach_name: "Casey Coach", date: addDays(today, -3) },
    coaches: [
      { id: IDS.coach, name: "Casey Coach", slug: IDS.coachSlug, photo: null, next_date: addDays(today, 2), credits_left: 3 },
      { id: HOME.coachJordan, name: "Jordan Lee", slug: "jordan-lee", photo: null, next_date: null, credits_left: 0 },
    ],
    ...over,
  };
};

/** The family Home, populated, with a hide_coach / unhide_coach pair that keeps the list in step. */
export const seedAthleteHome = (backend: MockBackend, over: Parameters<typeof athleteHome>[0] = {}) => {
  const data = athleteHome(over);
  const hidden = new Set<string>();
  backend.rpc.get_athlete_home = () => ({ ...data, coaches: (data.coaches as Row[]).filter((c) => !hidden.has(String(c.id))) });
  backend.rpc.hide_coach = (args: Row) => {
    hidden.add(String(args.p_coach_id));
    return null;
  };
  backend.rpc.unhide_coach = (args: Row) => {
    hidden.delete(String(args.p_coach_id));
    return null;
  };
  backend.rpc.get_my_invoices = [
    { id: HOME.invoice, coach: "Casey Coach", athlete: "Alex Athlete", service: "Private session", amount: 80, due: addDays(etDate(), 5), status: "open", paid_at: null },
  ];
  return data;
};
