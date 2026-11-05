import { MockError, mockId, type MockBackend } from "../backend";
import { IDS } from "../personas";

// Casey Coach's roster: three athletes from get_coach_roster (shaped like the jsonb rows in
// 20261029100000_camp_athletes_without_account.sql), Ava's athlete page from get_coach_athlete
// (20261012150000_package_in_progress.sql), open times and the book flow, and the invites
// work list from get_coach_invites. Session dates and times are Eastern wall-clock, like the
// database stores them; tests run in UTC, so `clockOf` gives the time the page shows.

export const ROSTER = {
  ava: "0000a7a0-0000-4000-8000-000000000001",
  ben: "0000a7a0-0000-4000-8000-000000000002",
  chloe: "0000a7a0-0000-4000-8000-000000000003",
  unknown: "0000a7a0-0000-4000-8000-0000000000ff",
  conversation: "0000a7a0-0000-4000-8000-00000000c0c0",
  package: "0000a7a0-0000-4000-8000-0000000000e1",
} as const;

type Row = Record<string, unknown>;

/** YYYY-MM-DD, `days` from today (UTC, which is also the viewer's zone in these tests). */
export const dayFromToday = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** The instant of an Eastern wall-clock date and time. */
export const easternInstant = (date: string, time: string) => {
  const [h, m] = time.split(":").map(Number);
  for (const offset of [4, 5]) {
    const at = new Date(`${date}T00:00:00Z`);
    at.setUTCHours(h + offset, m);
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
    if (parts === `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`) return at;
  }
  throw new Error(`no Eastern instant for ${date} ${time}`);
};

/** "3:00 pm": an Eastern session time as the page shows it to a UTC viewer. */
export const clockOf = (date: string, time: string) => {
  const at = easternInstant(date, time);
  const h = at.getUTCHours();
  return `${h % 12 || 12}:${String(at.getUTCMinutes()).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
};

/** "Fri, Nov 6": the viewer's day of an Eastern session, as the page shows it. */
export const shortDayOf = (date: string, time: string) =>
  easternInstant(date, time).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

const avaNext = { date: dayFromToday(3), startTime: "10:00:00", place: "Central Park" };

export const rosterRows = (): Row[] => [
  {
    id: ROSTER.ava,
    name: "Ava Martinez",
    imageUrl: null,
    age: 12,
    position: "Midfield",
    team: "Rovers U13",
    accountName: "Maria Martinez",
    email: "maria@e2e.test",
    phone: "+1 555 555 0111",
    isClient: true,
    fromCamp: false,
    hasAccount: true,
    joinedOn: "2025-03-10",
    pillars: ["Technique"],
    next: avaNext,
    lastDate: dayFromToday(-4),
    credits: 3,
    packageName: "Fall 8-pack",
    packageTotal: 8,
    packageUsed: 5,
    sessionsCount: 12,
    spent: 960,
    gearTotal: 0,
  },
  {
    id: ROSTER.ben,
    name: "Ben Carter",
    imageUrl: null,
    age: 15,
    position: "Forward",
    team: "City FC",
    accountName: "Dana Carter",
    email: "dana@e2e.test",
    phone: null,
    isClient: false,
    fromCamp: false,
    hasAccount: true,
    joinedOn: "2025-06-01",
    pillars: ["Speed"],
    next: null,
    lastDate: dayFromToday(-20),
    credits: 0,
    packageName: null,
    packageTotal: null,
    packageUsed: null,
    sessionsCount: 4,
    spent: 320,
    gearTotal: 0,
  },
  {
    id: ROSTER.chloe,
    name: "Chloe Diaz",
    imageUrl: null,
    age: 19,
    position: "Goalkeeper",
    team: null,
    accountName: "Chloe Diaz",
    email: "chloe@e2e.test",
    phone: null,
    isClient: true,
    fromCamp: true,
    hasAccount: false,
    joinedOn: dayFromToday(-2),
    pillars: ["Mindset"],
    next: null,
    lastDate: null,
    credits: 0,
    packageName: null,
    packageTotal: null,
    packageUsed: null,
    sessionsCount: 0,
    spent: 0,
    gearTotal: 0,
  },
];

export const AVA_SESSIONS = {
  upcoming: { id: mockId(), date: avaNext.date, startTime: "10:00:00", endTime: "11:00:00", name: "Technique", pillar: "Technique", kind: "individual", place: "Central Park", price: 80, status: "booked" },
  reviewed: {
    id: mockId(),
    date: dayFromToday(-4),
    startTime: "10:00:00",
    endTime: "11:00:00",
    name: "Technique",
    pillar: "Technique",
    kind: "individual",
    place: "in-person",
    price: 80,
    status: "completed",
    hasFeedback: true,
    noShow: false,
    summary: "Sharp first touch, worked on weak-foot passing.",
    note: "Weak-foot volleys",
  },
  feedbackDue: {
    id: mockId(),
    date: dayFromToday(-1),
    startTime: "16:00:00",
    endTime: "17:00:00",
    name: "Group training",
    pillar: null,
    kind: "group",
    place: "in-person",
    price: 40,
    status: "completed",
    hasFeedback: false,
    noShow: false,
    summary: null,
    note: null,
  },
};

/**
 * get_coach_athlete for the roster: Ava has a page; anyone else raises "Athlete not found" (42501),
 * like the real function does for an athlete who isn't on this coach's roster. Saved notes and
 * goals come back on the next read.
 */
export const seedRoster = (backend: MockBackend) => {
  const state = { note: "Loves the left wing.", goal: "Make the regional team" as string | null };
  backend.rpc.get_coach_roster = rosterRows();
  backend.rpc.get_coach_athlete = (args: Row) => {
    const athlete = rosterRows().find((r) => r.id === args.p_athlete_id);
    if (!athlete) return new MockError("Athlete not found", 403, "42501");
    if (athlete.id !== ROSTER.ava) {
      return { athlete, note: "", goal: null, video: null, relation: "Parent", packageExpires: null, packageProgress: null, due: null, upcoming: [], past: [] };
    }
    return {
      athlete,
      note: state.note,
      goal: state.goal,
      video: null,
      relation: "Mother",
      packageExpires: dayFromToday(60),
      packageProgress: null,
      due: null,
      upcoming: [AVA_SESSIONS.upcoming],
      past: [AVA_SESSIONS.feedbackDue, AVA_SESSIONS.reviewed],
    };
  };
  backend.rpc.set_coach_athlete_note = (args: Row) => {
    state.note = String(args.p_note);
    return null;
  };
  backend.rpc.set_coach_athlete_goal = (args: Row) => {
    state.goal = String(args.p_goal);
    return null;
  };
  backend.rpc.open_family_conversation = ROSTER.conversation;
  backend.rpc.upsert_package_in_progress = mockId();
  backend.seed("coach_packages", [
    {
      id: ROSTER.package,
      coach_id: IDS.coach,
      package_name: "Fall 8-pack",
      description: null,
      session_count: 8,
      duration_minutes: 60,
      total_price: 560,
      price_per_session: 70,
      validity_days: 90,
      features: [],
      is_active: true,
      display_order: 0,
      kind: "package",
      created_at: "2025-01-01T00:00:00Z",
    },
  ]);
  return state;
};

/** Ava's open times: Usual time (suggested), then two more days. Ids are fixed for asserting. */
export const OPEN_TIMES = [
  { id: "0000a7a0-0000-4000-8000-00000000a001", date: dayFromToday(2), startTime: "10:00:00", endTime: "11:00:00", price: 80, place: "Central Park", suggested: true },
  { id: "0000a7a0-0000-4000-8000-00000000a002", date: dayFromToday(4), startTime: "17:00:00", endTime: "18:00:00", price: 80, place: "online", suggested: false },
  { id: "0000a7a0-0000-4000-8000-00000000a003", date: dayFromToday(5), startTime: "09:00:00", endTime: "10:00:00", price: 80, place: null, suggested: false },
];

/** The book flow: open times, three credits, an own client who can also pay outside. */
export const seedBooking = (backend: MockBackend, payment: { credits?: number; own_client?: boolean; pays_direct?: boolean } = {}) => {
  backend.rpc.get_roster_open_times = OPEN_TIMES;
  backend.rpc.get_roster_book_payment = { credits: 3, own_client: true, pays_direct: false, ...payment };
  backend.rpc.get_roster_book_week = OPEN_TIMES.map((t) => ({ ...t, kind: "open", title: null, booked: 0, cap: 1, takenBy: null }));
  backend.rpc.coach_book_athlete = (args: Row) => (args.p_occurrence_ids as string[]).map(() => mockId());
  backend.rpc.coach_undo_booking = null;
  backend.rpc.schedule_offer_session = { sent: 1, channel: false };
  backend.functions["create-booking-payment-v0"] = { ok: true };
};

export const INVITES = {
  approval: "0000a7a0-0000-4000-8000-00000000b001",
  sent: "0000a7a0-0000-4000-8000-00000000b002",
  bounced: "0000a7a0-0000-4000-8000-00000000b003",
  joined: "0000a7a0-0000-4000-8000-00000000b004",
} as const;

const invite = (row: Row): Row => ({
  coach_id: IDS.coach,
  athlete_id: null,
  initiated_by: "coach",
  relationship_source: null,
  status: "invited",
  created_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  confirmed_at: null,
  client_name: null,
  athlete_first_name: null,
  invite_token: "tok",
  expires_at: new Date(Date.now() + 20 * 86_400_000).toISOString(),
  invited_via: "email",
  opened_at: null,
  email_bounced_at: null,
  resend_count: 0,
  updated_at: null,
  athlete_name: null,
  athlete_age: null,
  marketplace_since: null,
  ...row,
});

/** get_coach_invites: one link sign-up to approve, one waiting, one bounced, one joined. */
export const inviteRows = (): Row[] => [
  invite({ id: INVITES.approval, client_email: "sam@e2e.test", client_name: "Sam Lee", initiated_by: "athlete", status: "pending_confirmation", invited_via: "link", athlete_name: "Mia Lee", athlete_age: 11 }),
  invite({ id: INVITES.sent, client_email: "olga@e2e.test", client_name: "Olga Novak", athlete_first_name: "Leo", athlete_age: 13 }),
  invite({ id: INVITES.bounced, client_email: "tom@typo.test", client_name: "Tom Reed", email_bounced_at: new Date().toISOString() }),
  invite({ id: INVITES.joined, client_email: "kim@e2e.test", client_name: "Kim Park", status: "confirmed", athlete_id: ROSTER.ben, confirmed_at: new Date().toISOString(), athlete_first_name: "Ben" }),
];

export const seedInvites = (backend: MockBackend) => {
  backend.rpc.get_coach_invites = inviteRows();
  backend.rpc.coach_fix_invite_email = null;
  backend.rpc.acknowledge_coach_referral = null;
  backend.functions["add-client-referral"] = (body: unknown) => {
    const b = body as Row;
    if (b.action === "resend") return { invite_link: "http://localhost:5199/invite/new-token", emailed: true };
    return {
      results: ((b.clients as Row[]) ?? []).map((c) => ({ email: c.email, status: "invited", invite_link: "http://localhost:5199/invite/t", emailed: true })),
    };
  };
};
