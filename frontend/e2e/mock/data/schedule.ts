import { MockError, type MockBackend } from "../backend";
import { IDS } from "../personas";

// Fixtures for the coach's scheduling area: My schedule, Create session, Plan next week,
// Schedule settings, Coach setup, the session page (coach and family views), feedback,
// coach My sessions and Camps. Shapes follow the mappers in src/api/schedule.ts,
// coachSession.ts, athleteSession.ts, feedback.ts, sessions.ts and camps.ts, and the SQL in
// backend/supabase/migrations (get_coach_schedule, get_coach_session, get_athlete_session,
// get_feedback_screen, get_bookings_by_user_id, camp_json).
//
// Sessions are stored as Eastern date + wall time. The coach here works in Eastern time (their
// profile timezone is America/New_York), so the times a test seeds are the times the app shows.

type Row = Record<string, unknown>;

export const SCH = {
  booked: "00000000-0000-4000-8000-0000000051a1",
  group: "00000000-0000-4000-8000-0000000051a2",
  open: "00000000-0000-4000-8000-0000000051a3",
  nextWeek: "00000000-0000-4000-8000-0000000051a4",
  request: "00000000-0000-4000-8000-0000000051a5",
  past: "00000000-0000-4000-8000-0000000051a6",
  pastGroup: "00000000-0000-4000-8000-0000000051a7",
  live: "00000000-0000-4000-8000-0000000051a8",
  lastWeekGroup: "00000000-0000-4000-8000-0000000051a9",
  draft: "00000000-0000-4000-8000-0000000051aa",
  bookingA: "00000000-0000-4000-8000-0000000052b1",
  bookingB: "00000000-0000-4000-8000-0000000052b2",
  bookingC: "00000000-0000-4000-8000-0000000052b3",
  athleteB: "00000000-0000-4000-8000-0000000053c2",
  athleteC: "00000000-0000-4000-8000-0000000053c3",
  seriesMon9: "00000000-0000-4000-8000-0000000054d1",
  seriesMon10: "00000000-0000-4000-8000-0000000054d2",
  slotTomorrow: "00000000-0000-4000-8000-0000000055e1",
  camp: "00000000-0000-4000-8000-0000000056f1",
  campGroup: "00000000-0000-4000-8000-0000000056f2",
  offer: "00000000-0000-4000-8000-0000000057a1",
} as const;

// ---------------------------------------------------------------------------------------------
// Eastern dates
// ---------------------------------------------------------------------------------------------

const ET = "America/New_York";

/** "YYYY-MM-DD" in Eastern time. */
export const etDate = (at: Date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ET, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);

/** "HH:MM:SS" in Eastern time. */
export const etTime = (at: Date) => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: ET, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("hour")}:${get("minute")}:00`;
};

export const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

/** ISO weekday, 1 = Monday. */
export const isoWeekday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay() || 7;

export const mondayOf = (iso: string) => addDays(iso, 1 - isoWeekday(iso));

export const today = () => etDate();

/** "Nov 4" for an ISO day, as formatDayISO shows it. */
export const shortDay = (iso: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) =>
  new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));

/**
 * A session that is on right now: an Eastern date with a start before now and an end after it,
 * kept inside one Eastern day.
 */
export const happeningNow = () => {
  const now = new Date();
  const date = etDate(now);
  const startAt = new Date(now.getTime() - 30 * 60_000);
  const endAt = new Date(now.getTime() + 30 * 60_000);
  const start = etDate(startAt) === date ? etTime(startAt) : "00:00:00";
  const end = etDate(endAt) === date ? etTime(endAt) : "23:59:00";
  return { date, start, end };
};

/** The coach in these tests works in Eastern time, so times show as stored. */
export const coachInEastern = (backend: MockBackend) => {
  const row = backend.table("user_profiles").find((r) => r.id === IDS.coachUser);
  if (row) row.timezone = ET;
};

/** Families in these tests also read Eastern time. */
export const familyInEastern = (backend: MockBackend, userId: string) => {
  const row = backend.table("user_profiles").find((r) => r.id === userId);
  if (row) row.timezone = ET;
};

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};
const hhmmss = (total: number) => `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}:00`;

// ---------------------------------------------------------------------------------------------
// get_coach_schedule
// ---------------------------------------------------------------------------------------------

export type ScheduleBookingRow = {
  id: string;
  athlete_id: string;
  athlete_name: string;
  status: "requested" | "pending_payment" | "booked" | "completed" | "no_show";
  payment_status: string;
  expires_at?: string | null;
  notes?: string | null;
  created_at?: string;
};

/** One element of get_coach_schedule().sessions. */
export const scheduleSession = (over: Partial<Row> & { id: string; date: string; start_time: string }) => {
  const duration = Number(over.duration_minutes ?? 60);
  return {
    end_time: hhmmss(minutes(String(over.start_time)) + duration),
    duration_minutes: duration,
    session_type: "individual",
    session_name: "1-on-1 session",
    price: 80,
    capacity: 1,
    location: "in-person",
    place: "Central Park",
    pillar: null,
    position: null,
    visibility: "open",
    offered_to: [],
    offered_names: [],
    details: {},
    is_draft: false,
    series_id: null,
    bookings: [] as ScheduleBookingRow[],
    camp: null,
    ...over,
  };
};

export const scheduleBooking = (over: Partial<ScheduleBookingRow> & { id: string }): ScheduleBookingRow => ({
  athlete_id: IDS.athlete,
  athlete_name: "Alex Athlete",
  status: "booked",
  payment_status: "paid",
  expires_at: null,
  notes: null,
  created_at: "2026-01-01T00:00:00Z",
  ...over,
});

export type ScheduleStore = {
  sessions: ReturnType<typeof scheduleSession>[];
  series: Row[];
  timeOff: { date: string; note: string | null }[];
  busy: { starts_at: string; ends_at: string }[];
  calendar: Row | null;
  rules: Row;
};

/**
 * Answers get_coach_schedule from a store the test fills, with the range the app asks for, and
 * keeps the write RPCs consistent with it (creates add sessions, removes drop them). Locations
 * and the hourly rate come from the coach row, so saving locations shows on the next read.
 */
export const installSchedule = (backend: MockBackend, seed: Partial<ScheduleStore> = {}) => {
  const store: ScheduleStore = {
    sessions: [],
    series: [],
    timeOff: [],
    busy: [],
    calendar: null,
    rules: { new_family_booking: "request", booking_window_weeks: 8, slug: IDS.coachSlug },
    ...seed,
  };
  coachInEastern(backend);
  const coach = () => backend.table("coaches").find((c) => c.id === IDS.coach) ?? {};

  backend.rpc.get_coach_schedule = (args) => {
    const from = String(args.p_from);
    const to = String(args.p_to);
    const c = coach();
    return {
      sessions: store.sessions.filter((s) => s.date >= from && s.date <= to),
      busy: store.busy,
      time_off: store.timeOff.filter((t) => t.date >= from && t.date <= to),
      series: store.series,
      rules: { ...store.rules, locations: c.locations ?? [], hourly_rate: c.hourly_rate ?? null },
      calendar: store.calendar,
    };
  };

  backend.rpc.schedule_create_sessions = (args) => {
    const p = args.p_session as Row;
    const times = (p.times as { date: string; start: string }[]) ?? [];
    const created = times.map((t, i) => {
      const id = `00000000-0000-4000-8000-0000000c${String(store.sessions.length + i).padStart(4, "0")}`;
      store.sessions.push(
        scheduleSession({
          id,
          date: t.date,
          start_time: `${t.start}:00`,
          duration_minutes: Number(p.duration_minutes) || 60,
          session_type: p.session_type,
          session_name: p.session_name ?? (p.session_type === "group" ? "Group session" : "1-on-1 session"),
          price: p.price,
          capacity: p.capacity,
          location: p.location,
          place: p.place,
          pillar: p.pillar,
          details: p.details ?? {},
          visibility: p.visibility,
          is_draft: Boolean(p.is_draft),
        })
      );
      return id;
    });
    return { created, series: p.repeat === "weekly" ? ["series-new"] : [], skipped: [] };
  };

  backend.rpc.schedule_remove_session = (args) => {
    store.sessions = store.sessions.filter((s) => s.id !== args.p_occurrence_id);
    return null;
  };
  backend.rpc.schedule_stop_series = (args) => {
    store.series = store.series.filter((s) => s.id !== args.p_series_id);
    return null;
  };
  backend.rpc.schedule_copy_groups = () => 1;
  backend.rpc.schedule_publish_groups = () => SCH.offer;
  backend.rpc.schedule_set_offer_session_tags = () => null;
  backend.rpc.get_coach_booking_requests = [];
  backend.rpc.get_coach_athlete_options = [
    { athlete_id: IDS.athlete, full_name: "Alex Athlete", user_id: IDS.athleteUser, last_session_date: null },
    { athlete_id: SCH.athleteB, full_name: "Blake Baker", user_id: null, last_session_date: null },
  ];
  backend.rpc.get_coach_channels = [];
  backend.functions["create-booking-payment-v0"] = (body) => {
    const b = body as Row;
    if (b.action === "respond_request") return { status: b.accept ? "booked" : "declined" };
    return {};
  };
  return store;
};

/** A repeating weekly open hour (get_coach_schedule().series). */
export const weeklySeries = (id: string, dayOfWeek: number, start: string) => ({
  id,
  session_type: "individual",
  day_of_week: dayOfWeek,
  start_time: `${start}:00`,
  duration_minutes: 60,
  location: "in-person",
  place: "Central Park",
  ends_on: null,
});

// ---------------------------------------------------------------------------------------------
// get_coach_session
// ---------------------------------------------------------------------------------------------

export type CoachBookingRow = {
  id: string;
  athlete_id: string;
  name: string;
  image_url: string | null;
  status: string;
  payment_status: string;
  attendance: string | null;
  notes: string | null;
  cancellation_reason: string | null;
  canceled_at: string | null;
  age: number | null;
  parent_name: string | null;
  credits_left: number;
  paid_amount: number | null;
  note: string | null;
  credit_back: boolean;
};

export const coachBooking = (over: Partial<CoachBookingRow> & { id: string }): CoachBookingRow => ({
  athlete_id: IDS.athlete,
  name: "Alex Athlete",
  image_url: null,
  status: "booked",
  payment_status: "paid",
  attendance: null,
  notes: null,
  cancellation_reason: null,
  canceled_at: null,
  age: 16,
  parent_name: "Pat Parent",
  credits_left: 0,
  paid_amount: 80,
  note: null,
  credit_back: false,
  ...over,
});

/** What get_coach_session returns (20261010140000_coach_session_page.sql). */
export const coachSession = (over: Partial<Row> & { id: string; date: string; start_time: string }) => {
  const duration = Number(over.duration_minutes ?? 60);
  return {
    end_time: hhmmss(minutes(String(over.start_time)) + duration),
    duration_minutes: duration,
    session_type: "individual",
    session_name: "1-on-1 session",
    pillar: "On-field training",
    price: 80,
    capacity: 1,
    location: "in-person",
    place: "Central Park",
    is_enabled: true,
    series_id: null,
    started: false,
    ended: false,
    cancel: null,
    bookings: [] as CoachBookingRow[],
    feedback: null,
    last_summary: null,
    last_focus: null,
    camp: null,
    ...over,
  };
};

/**
 * Answers get_coach_session for the sessions given. Any other id raises "Session not found"
 * (42501), as the real function does for a missing or someone else's session.
 */
export const installCoachSessions = (backend: MockBackend, sessions: ReturnType<typeof coachSession>[]) => {
  coachInEastern(backend);
  const byId = new Map(sessions.map((s) => [s.id, s]));
  backend.rpc.get_coach_session = (args) => byId.get(String(args.p_occurrence_id)) ?? new MockError("Session not found", 403, "42501");
  backend.rpc.coach_cancel_session = (args) =>
    String(args.p_reason ?? "").trim() ? { sent: 1, credits: 1 } : new MockError("Choose a reason", 400, "22023");
  backend.rpc.coach_move_session = () => 1;
  backend.rpc.coach_decline_note = () => null;
  backend.rpc.open_family_conversation = "00000000-0000-4000-8000-00000000cc01";
  backend.functions["stripe-payouts"] = {};
  backend.functions["create-booking-payment-v0"] = (body) => {
    const b = body as Row;
    if (b.action === "respond_request") return { status: b.accept ? "booked" : "declined" };
    return {};
  };
  return byId;
};

// ---------------------------------------------------------------------------------------------
// get_athlete_session
// ---------------------------------------------------------------------------------------------

/** What get_athlete_session returns (20261019132000_reschedule_my_booking.sql). */
export const athleteSession = (over: Partial<Row> & { id: string; date: string; start_time: string; booking?: Row }) => {
  const duration = Number(over.duration_minutes ?? 60);
  const { booking, ...rest } = over;
  return {
    end_time: hhmmss(minutes(String(over.start_time)) + duration),
    duration_minutes: duration,
    session_type: "individual",
    session_name: "1-on-1 session",
    pillar: "On-field training",
    price: 80,
    location: "in-person",
    place: "Central Park",
    started: false,
    ended: false,
    capacity: 1,
    taken: 1,
    cancel_notice_hours: 24,
    coach: { id: IDS.coach, name: "Casey Coach", slug: IDS.coachSlug, photo: null, pay_mode: "online", pay_note: null },
    booking: {
      id: SCH.bookingA,
      status: "booked",
      payment_status: "paid",
      paid_amount: 80,
      cancellation_reason: null,
      expires_at: null,
      ...(booking ?? {}),
    },
    attendance: null,
    summary: null,
    note: null,
    camp: null,
    ...rest,
  };
};

export const installAthleteSessions = (backend: MockBackend, sessions: ReturnType<typeof athleteSession>[]) => {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  backend.rpc.get_athlete_session = (args) => byId.get(String(args.p_occurrence_id)) ?? new MockError("Session not found", 403, "42501");
  backend.rpc.cancel_my_booking = () => ({ credit: true });
  backend.rpc.reschedule_my_booking = (args) => ({ occurrence_id: args.p_new_occurrence_id, notified: true });
  backend.functions["stripe-payouts"] = {};
  return byId;
};

/** One element of get_bookable_sessions().sessions (src/api/book.ts mapSession). */
export const bookableSession = (over: Partial<Row> & { id: string; occurrence_date: string; start_time: string }) => {
  const duration = Number(over.duration_minutes ?? 60);
  return {
    coach_id: IDS.coach,
    end_time: hhmmss(minutes(String(over.start_time)) + duration),
    duration_minutes: duration,
    session_type: "individual",
    session_name: "1-on-1 session",
    price: 80,
    capacity: 1,
    location: "in-person",
    place: "Central Park",
    pillar: null,
    position: null,
    details: {},
    booked_count: 0,
    my_status: null,
    ...over,
  };
};

// ---------------------------------------------------------------------------------------------
// get_feedback_screen
// ---------------------------------------------------------------------------------------------

export const feedbackAthlete = (over: Partial<Row> & { booking_id: string; athlete_id: string; name: string }) => ({
  image_url: null,
  age: 12,
  position: null,
  parent_name: null,
  attendance: null,
  note: null,
  ...over,
});

/** What get_feedback_screen returns (src/api/feedback.ts). */
export const feedbackScreen = (over: Partial<Row> & { id: string; date: string; start_time: string }) => {
  const duration = Number(over.duration_minutes ?? 60);
  return {
    end_time: hhmmss(minutes(String(over.start_time)) + duration),
    session_name: "Session",
    session_type: "individual",
    pillar: "On-field training",
    location: "in-person",
    place: "Central Park",
    started: true,
    ended: true,
    submitted: false,
    no_show: false,
    summary: null,
    score: null,
    edit_count: 0,
    missed_gets_short_message: true,
    athletes: [] as Row[],
    ...over,
  };
};

// ---------------------------------------------------------------------------------------------
// get_bookings_by_user_id (coach My sessions)
// ---------------------------------------------------------------------------------------------

export const bookingRecord = (over: Partial<Row> & { booking_id: string; occurrence_id: string; session_date: string; slot_start_time: string; slot_end_time: string }) => ({
  slot_id: over.occurrence_id,
  availability_id: over.occurrence_id,
  coach_id: IDS.coach,
  coach_name: "Casey Coach",
  athlete_count: 1,
  athletes_names: ["Alex Athlete"],
  slot_duration: 60,
  slot_session_type: "individual",
  slot_location: "in-person",
  slot_session_name: "1-on-1 session",
  slot_price: 80,
  pillar_slot: "On-field training",
  has_session_feedback: false,
  has_slot_feedback: false,
  ...over,
});

// ---------------------------------------------------------------------------------------------
// Camps (camp_json)
// ---------------------------------------------------------------------------------------------

export const campGroup = (over: Partial<Row> & { id: string }) => ({
  name: "All athletes",
  description: null,
  start_time: "09:00",
  end_time: "12:00",
  spots: 12,
  taken: 0,
  sort_order: 0,
  ...over,
});

export const coachCamp = (over: Partial<Row> & { id: string; name: string }) => ({
  coach_id: IDS.coach,
  description: null,
  price_cents: 26000,
  starts_on: addDays(etDate(), 20),
  ends_on: addDays(etDate(), 22),
  days: 3,
  location: "Central Park",
  capacity: 12,
  taken: 0,
  slug: "thanksgiving-camp",
  coach_slug: IDS.coachSlug,
  cover_url: null,
  included: [],
  tags: [],
  pay_direct: true,
  waiver_url: null,
  linked_coach: null,
  co_coach_ids: [],
  age_min: null,
  age_max: null,
  is_active: true,
  published: false,
  published_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-10-01T10:00:00Z",
  groups: [campGroup({ id: SCH.campGroup })],
  paid_count: 0,
  waiting_count: 0,
  ...over,
});

/** get_coach_camps, get_camp_editor and save_camp / publish_camp kept on one list. */
export const installCamps = (backend: MockBackend, camps: ReturnType<typeof coachCamp>[]) => {
  const list = [...camps];
  backend.rpc.get_coach_camps = () => list;
  backend.rpc.get_camp_run_again = [];
  backend.rpc.get_my_new_camp_signups = [];
  backend.rpc.camp_schedule_overlaps = { open: 0, booked: 0 };
  backend.rpc.get_camp_editor = (args) => list.find((c) => c.id === args.p_camp_id) ?? new MockError("Camp not found", 404);
  backend.rpc.save_camp = (args) => {
    const input = args.p_camp as Row;
    const groups = (args.p_groups as Row[]).map((g, i) => campGroup({ id: String(g.id ?? `00000000-0000-4000-8000-0000000c9${String(i).padStart(3, "0")}`), ...g, name: String(g.name || "All athletes"), sort_order: i }));
    const existing = list.find((c) => c.id === args.p_camp_id);
    const saved = coachCamp({
      ...(existing ?? {}),
      id: existing?.id ?? "00000000-0000-4000-8000-0000000c9a01",
      ...input,
      name: String(input.name),
      groups,
      updated_at: new Date().toISOString(),
    });
    if (existing) list.splice(list.indexOf(existing), 1, saved);
    else list.push(saved);
    return saved;
  };
  backend.rpc.publish_camp = (args) => {
    const camp = list.find((c) => c.id === args.p_camp_id);
    if (!camp) return new MockError("Camp not found", 404);
    Object.assign(camp, { published: true, published_at: new Date().toISOString(), schedule_sessions: 3 });
    return camp;
  };
  backend.rpc.unpublish_camp = (args) => {
    const camp = list.find((c) => c.id === args.p_camp_id);
    if (!camp) return new MockError("Camp not found", 404);
    Object.assign(camp, { published: false });
    return camp;
  };
  return list;
};
