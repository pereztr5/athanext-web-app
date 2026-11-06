import type { MockBackend } from "../backend";
import { IDS, coachRow } from "../personas";

// Fixtures for discovery and booking on the family side: the coach directory, a coach's public
// profile, Book a Session, receipts, group offers, camps, My coaches and My sessions. Shapes
// follow the mappers in src/api/*.ts and the SQL in backend/supabase/migrations.

type Row = Record<string, unknown>;

export const BOOK_IDS = {
  rowingCoach: "0000c0a0-0000-4000-8000-0000000000c2",
  goalieCoach: "0000c0a0-0000-4000-8000-0000000000c3",
  rowingCoachUser: "0000c0a0-0000-4000-8000-000000000002",
  /** The parent's child (an athlete_profiles row owned by the parent account). */
  child: "0000fa00-0000-4000-8000-0000000000a1",
  package5: "00000000-0000-4000-8000-00000000b005",
  package10: "00000000-0000-4000-8000-00000000b010",
  session1: "00000000-0000-4000-8000-00000000e001",
  session2: "00000000-0000-4000-8000-00000000e002",
  groupSession: "00000000-0000-4000-8000-00000000e003",
  booking1: "00000000-0000-4000-8000-00000000d001",
  booking2: "00000000-0000-4000-8000-00000000d002",
  camp: "00000000-0000-4000-8000-00000000ca01",
  campSlug: "summer-skills",
  campGroupYoung: "00000000-0000-4000-8000-00000000ca11",
  campGroupOld: "00000000-0000-4000-8000-00000000ca12",
  signup: "00000000-0000-4000-8000-00000000ca21",
  offerSession1: "00000000-0000-4000-8000-00000000f011",
  offerSession2: "00000000-0000-4000-8000-00000000f012",
  offerSession3: "00000000-0000-4000-8000-00000000f013",
} as const;

// ---------------------------------------------------------------------------------------------
// Dates. Sessions are stored as Eastern wall times; tests run in UTC.
// ---------------------------------------------------------------------------------------------

/** YYYY-MM-DD, `days` from today (UTC). */
export const isoDay = (days: number) => {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** The instant of an Eastern wall time ("10:00") on an ISO date. */
export const easternInstant = (date: string, time: string) => {
  const [h, m] = time.split(":").map(Number);
  for (const offset of [4, 5]) {
    const guess = new Date(`${date}T00:00:00Z`);
    guess.setUTCHours(h + offset, m, 0, 0);
    const shown = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hourCycle: "h23" }).format(guess);
    if (shown === `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` || shown === `${h}:${String(m).padStart(2, "0")}`) return guess;
  }
  throw new Error(`no Eastern instant for ${date} ${time}`);
};

/** "2:00 PM": how the app shows an Eastern wall time to a UTC viewer. */
export const utcClock = (date: string, time: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", hour: "numeric", minute: "2-digit" }).format(easternInstant(date, time));

// ---------------------------------------------------------------------------------------------
// Fees: configurations rows read by useFeeConfig.
// ---------------------------------------------------------------------------------------------

export const seedFees = (backend: MockBackend) => {
  backend.seed("configurations", [
    { key: "platform_fees", value: "10" },
    { key: "stripe_fees", value: "2.9" },
    { key: "stripe_fee_fixed", value: "0.30" },
  ]);
};

// ---------------------------------------------------------------------------------------------
// Directory: get_coaches_public rows (20261106100000_chat_start_pillar_search_hide_test_coaches).
// ---------------------------------------------------------------------------------------------

export const publicCoach = (overrides: Row = {}): Row => ({
  id: IDS.coach,
  name: "Casey Coach",
  bio: "Ten years coaching youth soccer.",
  profile_image_url: null,
  image_url: null,
  company: null,
  coach_position: "Midfield",
  positions: ["Midfield"],
  locations: ["Central Park"],
  specialties: ["Technique", "Speed"],
  pathway_tags: [],
  zip_code: "10001",
  languages: ["English"],
  hourly_rate: 80,
  rating: 4.9,
  total_reviews: 12,
  years_experience: 10,
  response_time_hours: 2,
  session_types: ["in-person", "virtual"],
  availability: null,
  cancellation_policy: null,
  instagram_handle: null,
  status: "active",
  is_verified: true,
  cover_image_urls: [],
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
  sport_type: "soccer",
  favourite_positions: [],
  age_min: 8,
  age_max: 18,
  title: "Head coach",
  ...overrides,
});

export const DIRECTORY = [
  publicCoach(),
  publicCoach({
    id: BOOK_IDS.rowingCoach,
    name: "Robin Rower",
    bio: "Sculling and erg technique.",
    coach_position: "Rower",
    positions: ["Rower"],
    locations: ["Harlem River"],
    specialties: ["Endurance"],
    hourly_rate: 60,
    rating: 4.5,
    total_reviews: 4,
    session_types: ["virtual"],
    sport_type: "rowing",
    age_min: 14,
    age_max: 22,
    title: "Rowing coach",
  }),
  publicCoach({
    id: BOOK_IDS.goalieCoach,
    name: "Gale Keeper",
    bio: "Shot stopping and distribution.",
    coach_position: "Goalkeeper",
    positions: ["Goalkeeper"],
    locations: ["Brooklyn Bridge Park"],
    specialties: ["Goalkeeping"],
    hourly_rate: 120,
    rating: 5,
    total_reviews: 30,
    session_types: ["in-person"],
    sport_type: "soccer",
    age_min: 6,
    age_max: 12,
    title: "Goalkeeper coach",
  }),
];

export const seedDirectory = (backend: MockBackend) => {
  backend.rpc.get_coaches_public = DIRECTORY;
  backend.rpc.get_organizations_public = [];
  backend.rpc.get_coach_coordinates = [];
  backend.rpc.intro_enabled_coach_ids = [];
  // The other coaches exist as rows too, so their profiles open.
  backend.seed("coaches", [
    { ...coachRow, id: BOOK_IDS.rowingCoach, slug: "robin-rower", name: "Robin Rower", email: "robin@e2e.test", sport: "rowing", hourly_rate: 60 },
    { ...coachRow, id: BOOK_IDS.goalieCoach, slug: "gale-keeper", name: "Gale Keeper", email: "gale@e2e.test", hourly_rate: 120 },
  ]);
};

// ---------------------------------------------------------------------------------------------
// Coach profile: resolve, packages, reviews, extras (20261010220000_coach_profile.sql).
// ---------------------------------------------------------------------------------------------

export const REVIEWS = [
  {
    id: "00000000-0000-4000-8000-0000000ae001",
    coach_id: IDS.coach,
    rating: 5,
    review_text: "Our daughter's first touch improved in three sessions.",
    created_at: "2026-09-01T12:00:00Z",
    reviewer_name: "Jordan Parent",
    athlete_age: 13,
    coach_reply: "Thanks Jordan, she worked hard!",
    coach_reply_at: "2026-09-02T12:00:00Z",
  },
  {
    id: "00000000-0000-4000-8000-0000000ae002",
    coach_id: IDS.coach,
    rating: 4,
    review_text: "Great drills, always on time.",
    created_at: "2026-08-15T12:00:00Z",
    reviewer_name: "Sam Smith",
    athlete_age: 19,
    coach_reply: null,
    coach_reply_at: null,
  },
];

export const packageRow = (overrides: Row = {}): Row => ({
  id: BOOK_IDS.package5,
  coach_id: IDS.coach,
  package_name: "5-session pack",
  description: "Five 1-on-1 sessions.",
  session_count: 5,
  duration_minutes: 60,
  total_price: 37500,
  price_per_session: 7500,
  validity_days: 90,
  features: ["Video review after each session"],
  is_active: true,
  display_order: 1,
  kind: "package",
  created_at: "2025-02-01T00:00:00Z",
  updated_at: "2025-02-01T00:00:00Z",
  ...overrides,
});

/** Casey's public profile, populated. `coach` overrides the coaches row. */
export const seedCoachProfile = (backend: MockBackend, coach: Row = {}) => {
  const row = backend.table("coaches").find((c) => c.id === IDS.coach)!;
  Object.assign(row, {
    profile_faqs: [{ id: "faq-1", question: "What should we bring?", answer: "Boots, shin pads and water." }],
    cancellation_policy: "Cancel 24 hours ahead for a full credit.",
    ...coach,
  });
  backend.rpc.resolve_coach_by_slug_or_id = ({ p_key }: Row) => {
    const key = String(p_key ?? "").toLowerCase();
    return backend.table("coaches").find((c) => c.id === key || c.slug === key)?.id ?? null;
  };
  backend.seed("coach_packages", [
    packageRow(),
    packageRow({ id: BOOK_IDS.package10, package_name: "10-session pack", description: "Ten 1-on-1 sessions.", session_count: 10, total_price: 70000, price_per_session: 7000, validity_days: 180, display_order: 2 }),
  ]);
  backend.seed("coach_certifications", [
    { id: "00000000-0000-4000-8000-0000000ce001", coach_id: IDS.coach, certification_name: "USSF C License", issuing_organization: "US Soccer", issue_date: "2020-01-01", expiry_date: null },
  ]);
  backend.rpc.get_coach_reviews_public = ({ coach_uuid }: Row) => REVIEWS.filter((r) => r.coach_id === coach_uuid);
  backend.rpc.get_coach_rating_stats = [{ average_rating: 4.5, total_reviews: 2, five_star: 1, four_star: 1, three_star: 0, two_star: 0, one_star: 0 }];
  backend.rpc.get_coach_profile_extras = {
    services: [
      { id: "individual", name: "1-on-1 session", format: "individual", minutes: 60, where: "In person", price: 80, on: true },
      { id: "small-group", name: "Small group", format: "group", minutes: 90, where: "Central Park", price: 35, on: true },
    ],
    most_booked_package_id: BOOK_IDS.package10,
    organization: null,
    has_availability: null,
  };
  backend.rpc.get_coach_public_packages = [];
  backend.rpc.get_coach_intro = { enabled: false };
  backend.rpc.get_coach_availability = [availabilityPeriod()];
  backend.rpc.record_coach_share_event = null;
};

/**
 * One availability period with two occurrences, for the signed-out profile's weekly table. Both
 * are on the same day so they share a week whatever today is (the table shows one week at a time).
 */
export const availabilityPeriod = (): Row => {
  const occ = (id: string, days: number, start: string, end: string): Row => ({
    id,
    weekly_slot_id: "00000000-0000-4000-8000-0000000a0101",
    availability_id: "00000000-0000-4000-8000-0000000a0100",
    coach_id: IDS.coach,
    occurrence_date: isoDay(days),
    session_name: "1-on-1 session",
    price: 80,
    duration_minutes: 60,
    start_time: start,
    end_time: end,
    session_type: "individual",
    location: "in-person",
    pillar_slot: "Technique",
    is_enabled: true,
    max_bookings_per_slot: 1,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  });
  return {
    id: "00000000-0000-4000-8000-0000000a0100",
    coach_id: IDS.coach,
    start_date: isoDay(-1),
    end_date: isoDay(27),
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    weekly_slots: [],
    occurrences: [occ("00000000-0000-4000-8000-0000000a0201", 2, "10:00:00", "11:00:00"), occ("00000000-0000-4000-8000-0000000a0202", 2, "12:00:00", "13:00:00")],
  };
};

// ---------------------------------------------------------------------------------------------
// Parent with a child: the athlete profile the parent books for.
// ---------------------------------------------------------------------------------------------

export const seedParentChild = (backend: MockBackend) => {
  backend.seed("athlete_profiles", [
    {
      id: BOOK_IDS.child,
      user_id: IDS.parentUser,
      full_name: "Riley Parent",
      date_of_birth: "2013-03-03",
      sport: "soccer",
      position: "Midfield",
      phone_number: null,
      location: "New York",
      tags: [],
      pathway_tags: [],
      profile_image_url: null,
      cover_image_urls: [],
      bio: null,
      profile_completed: true,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
      instagram_handle: null,
      graduation_year: 2031,
      current_year: null,
      high_school: null,
      gpa: null,
      height: null,
      weight: null,
      dominant_hand: null,
    },
  ]);
  const profile = backend.table("user_profiles").find((p) => p.id === IDS.parentUser)!;
  profile.athlete_id = BOOK_IDS.child;
};

// ---------------------------------------------------------------------------------------------
// Book a Session: booking_coach_card rows and get_bookable_sessions (20261006100000_book_a_session).
// ---------------------------------------------------------------------------------------------

export const bookingCoach = (overrides: Row = {}): Row => ({
  id: IDS.coach,
  name: "Casey Coach",
  slug: IDS.coachSlug,
  image_url: null,
  specialties: ["Technique", "Speed"],
  positions: ["Midfield"],
  hourly_rate: 80,
  locations: ["Central Park"],
  rating: 4.9,
  total_reviews: 12,
  is_client: true,
  needs_request: false,
  credits: 0,
  pay_mode: "app",
  pay_note: null,
  offline_pay_available: false,
  next_session: null,
  next_open: null,
  next_group: null,
  group_from: null,
  one_on_one_from: 80,
  ...overrides,
});

export const bookableSession = (overrides: Row = {}): Row => ({
  id: BOOK_IDS.session1,
  coach_id: IDS.coach,
  occurrence_date: isoDay(2),
  start_time: "10:00:00",
  end_time: "11:00:00",
  duration_minutes: 60,
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
  ...overrides,
});

/** Casey on Book a Session: one coach the family trains with and `sessions` to pick from. */
export const seedBookable = (backend: MockBackend, { coach = {}, sessions }: { coach?: Row; sessions?: Row[] } = {}) => {
  const card = bookingCoach(coach);
  const list = sessions ?? [
    bookableSession(),
    bookableSession({ id: BOOK_IDS.session2, start_time: "16:00:00", end_time: "17:00:00" }),
    bookableSession({
      id: BOOK_IDS.groupSession,
      occurrence_date: isoDay(3),
      start_time: "09:00:00",
      end_time: "10:30:00",
      duration_minutes: 90,
      session_type: "group",
      session_name: "Saturday small group",
      price: 35,
      capacity: 8,
      booked_count: 3,
    }),
  ];
  backend.rpc.get_my_coaches = [card];
  backend.rpc.get_bookable_sessions = ({ p_coach_id }: Row) => (p_coach_id === card.id ? { coach: card, sessions: list } : { coach: null, sessions: [] });
  backend.rpc.get_my_renewing_packages = [];
  return { card, sessions: list };
};

// ---------------------------------------------------------------------------------------------
// Receipt: get_booking_receipt (20261010250000_booking_receipt.sql).
// ---------------------------------------------------------------------------------------------

export const receiptBooking = (overrides: Row = {}): Row => ({
  id: BOOK_IDS.booking1,
  athlete_id: IDS.athlete,
  status: "booked",
  payment_status: "paid",
  created_at: new Date().toISOString(),
  coach: { id: IDS.coach, name: "Casey Coach", slug: IDS.coachSlug, pay_mode: "app", pay_note: null },
  session_name: "1-on-1 session",
  session_type: "individual",
  pillar: "Technique",
  occurrence_date: isoDay(2),
  start_time: "10:00:00",
  end_time: "11:00:00",
  duration_minutes: 60,
  location: "in-person",
  place: "Central Park",
  price: 80,
  charged: 91.01,
  platform_fee: 8,
  processing_fee: 3.01,
  ...overrides,
});

export const receipt = (bookings: Row[] = [receiptBooking()]): Row => ({
  receipt_number: "AN-10042",
  issued_at: new Date().toISOString(),
  email: "athlete@e2e.test",
  bookings,
});

// ---------------------------------------------------------------------------------------------
// Group offer: get_group_offer (20261005230000_schedule_offers.sql and later).
// ---------------------------------------------------------------------------------------------

export const offerSession = (overrides: Row = {}): Row => ({
  id: BOOK_IDS.offerSession1,
  date: isoDay(4),
  start_time: "17:00:00",
  end_time: "18:00:00",
  duration_minutes: 60,
  session_name: "Finishing clinic",
  price: 30,
  price_from: null,
  capacity: 10,
  location: "in-person",
  place: "Central Park",
  booked_count: 4,
  pending_confirm_count: 0,
  my_status: null,
  my_unpaid: false,
  my_booking_id: null,
  my_paid_amount: null,
  my_change_ask: null,
  change_from: null,
  cancelled: false,
  cancel_refund: null,
  is_new: false,
  started: false,
  ...overrides,
});

export const groupOffer = (overrides: Row = {}): Row => ({
  id: IDS.offer,
  kind: "week",
  suggestion: null,
  title: "Week of clinics",
  closes_at: new Date(Date.now() + 3 * 86400_000).toISOString(),
  closed: false,
  coach_id: IDS.coach,
  coach_name: "Casey Coach",
  coach_slug: IDS.coachSlug,
  coach_pay_mode: "app",
  coach_pay_note: null,
  locations: ["Central Park"],
  sessions: [
    offerSession(),
    offerSession({ id: BOOK_IDS.offerSession2, date: isoDay(5), session_name: "Passing clinic", price: 25, booked_count: 9 }),
    offerSession({ id: BOOK_IDS.offerSession3, date: isoDay(6), session_name: "Full clinic", booked_count: 10 }),
  ],
  ...overrides,
});

// ---------------------------------------------------------------------------------------------
// Camp page: get_camp_page (20261101100000_camp_page_owner_preview.sql) and camp-signup.
// ---------------------------------------------------------------------------------------------

export const campPage = (overrides: Row = {}): Row => ({
  id: BOOK_IDS.camp,
  name: "Summer Skills Camp",
  description: "Five mornings of ball mastery and small-sided games.",
  tags: ["Technique", "Small-sided games"],
  cover_url: null,
  cover_is_coach_photo: false,
  price_cents: 25000,
  days: 5,
  per_day_cents: 5000,
  starts_on: isoDay(20),
  ends_on: isoDay(24),
  location: "Central Park, North Meadow",
  included: ["Camp T-shirt", "Daily snack"],
  age_min: 8,
  age_max: 14,
  pay_direct: true,
  waiver_url: null,
  open: true,
  started: false,
  published: true,
  can_edit: false,
  spots_left: 12,
  coach: {
    id: IDS.coach,
    name: "Casey Coach",
    slug: IDS.coachSlug,
    photo_url: null,
    bio: "Ten years coaching youth soccer.",
    years_experience: 10,
    rating: 4.9,
    total_reviews: 12,
    cancellation_policy: "Full refund up to 7 days before the camp.",
  },
  linked_coach: null,
  groups: [
    { id: BOOK_IDS.campGroupYoung, name: "Ages 8 to 10", description: "Mornings", start_time: "09:00:00", end_time: "12:00:00", spots: 12, spots_left: 7, full: false },
    { id: BOOK_IDS.campGroupOld, name: "Ages 11 to 14", description: "Afternoons", start_time: "13:00:00", end_time: "16:00:00", spots: 12, spots_left: 0, full: true },
  ],
  ...overrides,
});

export const campQuote = (athletes: number, overrides: Row = {}): Row => {
  const listCents = 25000 * athletes;
  const totalCents = Math.round((listCents + 30) / (1 - 0.029));
  return {
    camp_id: BOOK_IDS.camp,
    price_cents: 25000,
    source: "marketplace",
    athletes,
    platform_waived: true,
    direct_allowed: true,
    card: { listCents, platformCents: 0, processingCents: totalCents - listCents, totalCents, lines: [] },
    ...overrides,
  };
};

// ---------------------------------------------------------------------------------------------
// My sessions: get_bookings_by_user_id rows (BookingRPCResponse).
// ---------------------------------------------------------------------------------------------

export const mySessionRow = (overrides: Row = {}): Row => ({
  booking_id: BOOK_IDS.booking1,
  slot_id: "00000000-0000-4000-8000-0000000a5001",
  occurrence_id: BOOK_IDS.session1,
  availability_id: "",
  coach_id: IDS.coach,
  coach_name: "Casey Coach",
  athlete_count: 1,
  athletes_names: ["Alex Athlete"],
  session_date: isoDay(2),
  slot_start_time: "10:00:00",
  slot_end_time: "11:00:00",
  slot_duration: 60,
  slot_session_type: "individual",
  slot_location: "in-person",
  slot_session_name: "Ball mastery",
  slot_price: 80,
  pillar_slot: "Technique",
  has_session_feedback: false,
  has_slot_feedback: false,
  ...overrides,
});
