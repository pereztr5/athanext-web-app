/**
 * My Schedule (ATH-71). Sessions are coach_availability_slot_occurrences rows stored as
 * Eastern date + time; weekly ones come from coach_session_series. Every write goes
 * through a security definer RPC scoped to the calling coach.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type SessionType = "individual" | "group";
export type SessionVisibility = "open" | "offered" | "clients";
export type SessionPosition = "Goalkeeper" | "Field player" | "Both";
export type NewFamilyBooking = "request" | "instant";

export interface ScheduleBooking {
  id: string;
  athleteId: string;
  athleteName: string;
  status: "requested" | "pending_payment" | "booked" | "completed" | "no_show";
  paymentStatus: string;
  expiresAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface SessionDetails {
  about?: string[];
  level?: string;
  ages?: string;
  /** Age group or level on a planned group session (U12, Youth development). */
  tag?: string;
  bring?: string;
}

/** PostgREST / Postgres when an RPC from a not-yet-applied migration is missing. */
export const isMissingRpc = (error: unknown) => {
  const code = (error as { code?: string } | null)?.code;
  const message = error instanceof Error ? error.message : String((error as { message?: string } | null)?.message ?? "");
  return code === "PGRST202" || code === "42883" || /could not find the function/i.test(message) || /does not exist/i.test(message);
};

export interface ScheduleSession {
  id: string;
  /** Eastern date (YYYY-MM-DD) and wall times (HH:MM:SS). */
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  sessionType: SessionType;
  sessionName: string;
  price: number;
  capacity: number;
  location: "online" | "in-person";
  place: string | null;
  pillar: string | null;
  position: SessionPosition | null;
  visibility: SessionVisibility;
  offeredTo: string[];
  offeredNames: string[];
  details: SessionDetails;
  isDraft: boolean;
  seriesId: string | null;
  bookings: ScheduleBooking[];
}

export interface ScheduleSeries {
  id: string;
  sessionType: SessionType;
  /** ISO weekday, 1 = Monday. */
  dayOfWeek: number;
  startTime: string;
  durationMinutes: number;
  location: "online" | "in-person";
  place: string | null;
  endsOn: string | null;
}

export interface BusyBlock {
  startsAt: string;
  endsAt: string;
}

export interface TimeOffDay {
  date: string;
  note: string | null;
}

export interface CalendarConnection {
  accountEmail: string | null;
  lastSyncedAt: string | null;
  syncError: string | null;
  /** Google granted event access, so accepted bookings are added (ATH-85). */
  canWrite: boolean;
}

export interface ScheduleRules {
  newFamilyBooking: NewFamilyBooking;
  bookingWindowWeeks: number;
  locations: string[];
  hourlyRate: number | null;
  slug: string | null;
}

export interface CoachSchedule {
  sessions: ScheduleSession[];
  busy: BusyBlock[];
  timeOff: TimeOffDay[];
  series: ScheduleSeries[];
  rules: ScheduleRules;
  calendar: CalendarConnection | null;
}

export interface CreateSessionsInput {
  sessionType: SessionType;
  visibility: SessionVisibility;
  /** Eastern date + "HH:MM". */
  times: { date: string; start: string }[];
  repeat: "none" | "weekly" | "weeks";
  weeks?: number;
  durationMinutes: number;
  sessionName?: string;
  price: number;
  capacity?: number;
  location: "online" | "in-person";
  place?: string | null;
  pillar?: string | null;
  position?: SessionPosition | null;
  details?: SessionDetails;
  offeredTo?: string[];
  /** One-time group drafts for the week planner; families can't see them until published. */
  isDraft?: boolean;
}

export interface DraftUpdate {
  date?: string;
  start?: string;
  durationMinutes?: number;
  sessionName?: string;
  price?: number;
  capacity?: number;
  location?: "online" | "in-person";
  place?: string | null;
  pillar?: string | null;
  position?: SessionPosition | null;
  details?: SessionDetails;
}

export interface CreateSessionsResult {
  created: string[];
  series: string[];
  skipped: { date: string; start: string }[];
}

export interface AthleteOption {
  athleteId: string;
  fullName: string;
  userId: string | null;
  lastSessionDate: string | null;
}

type Row = Record<string, any>;

const mapSession = (row: Row): ScheduleSession => ({
  id: row.id,
  date: row.date,
  startTime: row.start_time,
  endTime: row.end_time,
  durationMinutes: Number(row.duration_minutes) || 60,
  sessionType: row.session_type === "group" ? "group" : "individual",
  sessionName: row.session_name || "Session",
  price: Number(row.price) || 0,
  capacity: Number(row.capacity) || 1,
  location: row.location === "online" ? "online" : "in-person",
  place: row.place ?? null,
  pillar: row.pillar ?? null,
  position: row.position ?? null,
  visibility: row.visibility ?? "open",
  offeredTo: row.offered_to ?? [],
  offeredNames: row.offered_names ?? [],
  details: (row.details as SessionDetails) ?? {},
  isDraft: Boolean(row.is_draft),
  seriesId: row.series_id ?? null,
  bookings: ((row.bookings as Row[]) ?? []).map((b) => ({
    id: b.id,
    athleteId: b.athlete_id,
    athleteName: b.athlete_name || "Athlete",
    status: b.status,
    paymentStatus: b.payment_status,
    expiresAt: b.expires_at ?? null,
    notes: b.notes ?? null,
    createdAt: b.created_at,
  })),
});

export const scheduleAPI = {
  /** Eastern dates, inclusive; at most 62 days. */
  async get(from: string, to: string): Promise<CoachSchedule> {
    const { data, error } = await supabase.rpc("get_coach_schedule", { p_from: from, p_to: to });
    if (error) throw error;
    const raw = (data ?? {}) as Row;
    const rules = (raw.rules ?? {}) as Row;
    return {
      sessions: ((raw.sessions as Row[]) ?? []).map(mapSession),
      busy: ((raw.busy as Row[]) ?? []).map((b) => ({ startsAt: b.starts_at, endsAt: b.ends_at })),
      timeOff: ((raw.time_off as Row[]) ?? []).map((t) => ({ date: t.date, note: t.note ?? null })),
      series: ((raw.series as Row[]) ?? []).map((s) => ({
        id: s.id,
        sessionType: s.session_type === "group" ? "group" : "individual",
        dayOfWeek: Number(s.day_of_week),
        startTime: s.start_time,
        durationMinutes: Number(s.duration_minutes) || 60,
        location: s.location === "online" ? "online" : "in-person",
        place: s.place ?? null,
        endsOn: s.ends_on ?? null,
      })),
      rules: {
        newFamilyBooking: rules.new_family_booking === "instant" ? "instant" : "request",
        bookingWindowWeeks: Number(rules.booking_window_weeks) || 4,
        locations: Array.isArray(rules.locations) ? (rules.locations as string[]).filter(Boolean) : [],
        hourlyRate: rules.hourly_rate != null ? Number(rules.hourly_rate) : null,
        slug: rules.slug ?? null,
      },
      calendar: raw.calendar
        ? {
            accountEmail: raw.calendar.account_email ?? null,
            lastSyncedAt: raw.calendar.last_synced_at ?? null,
            syncError: raw.calendar.sync_error ?? null,
            canWrite: Boolean(raw.calendar.can_write),
          }
        : null,
    };
  },

  async createSessions(input: CreateSessionsInput): Promise<CreateSessionsResult> {
    const payload = {
      session_type: input.sessionType,
      visibility: input.visibility,
      times: input.times,
      repeat: input.repeat,
      weeks: input.weeks ?? 1,
      duration_minutes: input.durationMinutes,
      session_name: input.sessionName ?? null,
      price: input.price,
      capacity: input.capacity ?? 1,
      location: input.location,
      place: input.place ?? null,
      pillar: input.pillar ?? null,
      position: input.position ?? null,
      details: (input.details ?? {}) as Json,
      offered_to: input.offeredTo ?? [],
      is_draft: input.isDraft ?? false,
    };
    const { data, error } = await supabase.rpc("schedule_create_sessions", { p_session: payload as Json });
    if (error) throw error;
    const raw = (data ?? {}) as Row;
    return {
      created: raw.created ?? [],
      series: raw.series ?? [],
      skipped: raw.skipped ?? [],
    };
  },

  async updateDraft(occurrenceId: string, update: DraftUpdate): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (update.date) payload.date = update.date;
    if (update.start) payload.start = update.start;
    if (update.durationMinutes) payload.duration_minutes = update.durationMinutes;
    if (update.sessionName !== undefined) payload.session_name = update.sessionName;
    if (update.price !== undefined) payload.price = update.price;
    if (update.capacity !== undefined) payload.capacity = update.capacity;
    if (update.location) payload.location = update.location;
    if (update.place !== undefined) payload.place = update.place ?? "";
    if (update.pillar !== undefined) payload.pillar = update.pillar ?? "";
    if (update.position !== undefined) payload.position = update.position ?? "";
    if (update.details) payload.details = update.details;
    const { error } = await supabase.rpc("schedule_update_draft", {
      p_occurrence_id: occurrenceId,
      p_session: payload as Json,
    });
    if (error) throw error;
  },

  /** Copies group sessions from `days` earlier into from..to (Eastern dates) as drafts. */
  async copyGroups(from: string, to: string, days: number): Promise<number> {
    const { data, error } = await supabase.rpc("schedule_copy_groups", { p_from: from, p_to: to, p_days: days });
    if (error) throw error;
    return Number(data) || 0;
  },

  /** Publishes drafts in from..to and creates the pick-and-pay card; returns its id. */
  async publishGroups(input: {
    from: string;
    to: string;
    title: string;
    closesAt: string;
    postToChannel: boolean;
    message: string;
    linkBase: string;
  }): Promise<string> {
    const { data, error } = await supabase.rpc("schedule_publish_groups", {
      p_from: input.from,
      p_to: input.to,
      p_title: input.title,
      p_closes_at: input.closesAt,
      p_post_to_channel: input.postToChannel,
      p_message: input.message,
      p_link_base: input.linkBase,
    });
    if (error) throw error;
    return data as string;
  },

  async removeSession(occurrenceId: string): Promise<void> {
    const { error } = await supabase.rpc("schedule_remove_session", { p_occurrence_id: occurrenceId });
    if (error) throw error;
  },

  async updateSeries(seriesId: string, startTime: string, location: "online" | "in-person", place: string | null) {
    const { error } = await supabase.rpc("schedule_update_series", {
      p_series_id: seriesId,
      p_start_time: startTime,
      p_location: location,
      p_place: place ?? "",
    });
    if (error) throw error;
  },

  async stopSeries(seriesId: string): Promise<void> {
    const { error } = await supabase.rpc("schedule_stop_series", { p_series_id: seriesId });
    if (error) throw error;
  },

  async clearDay(date: string, note: string | null): Promise<number> {
    const { data, error } = await supabase.rpc("schedule_clear_day", { p_date: date, p_note: note ?? "" });
    if (error) throw error;
    return Number(data) || 0;
  },

  async restoreDay(date: string): Promise<number> {
    const { data, error } = await supabase.rpc("schedule_restore_day", { p_date: date });
    if (error) throw error;
    return Number(data) || 0;
  },

  async setRules(newFamilyBooking: NewFamilyBooking, bookingWindowWeeks: number): Promise<void> {
    const { error } = await supabase.rpc("schedule_set_rules", {
      p_new_family_booking: newFamilyBooking,
      p_booking_window_weeks: bookingWindowWeeks,
    });
    if (error) throw error;
  },

  async athleteOptions(): Promise<AthleteOption[]> {
    const { data, error } = await supabase.rpc("get_coach_athlete_options");
    if (error) throw error;
    return ((data as Row[]) ?? []).map((row) => ({
      athleteId: row.athlete_id,
      fullName: row.full_name || "Athlete",
      userId: row.user_id ?? null,
      lastSessionDate: row.last_session_date ?? null,
    }));
  },

  async offerSession(occurrenceIds: string[], athleteIds: string[], postToChannel: boolean, message: string) {
    const { data, error } = await supabase.rpc("schedule_offer_session", {
      p_occurrence_ids: occurrenceIds,
      p_athlete_ids: athleteIds,
      p_post_to_channel: postToChannel,
      p_message: message,
    });
    if (error) throw error;
    const raw = (data ?? {}) as Row;
    return { sent: Number(raw.sent) || 0, channel: Boolean(raw.channel) };
  },

  /** Like offerSession, but posts to any of the coach's channels (20261010200000_create_and_plan). */
  async shareSession(occurrenceIds: string[], athleteIds: string[], channelIds: string[], message: string) {
    const { data, error } = await supabase.rpc(
      "schedule_share_session" as never,
      { p_occurrence_ids: occurrenceIds, p_athlete_ids: athleteIds, p_channel_ids: channelIds, p_message: message } as never
    );
    if (error) throw error;
    const raw = (data ?? {}) as Row;
    return { sent: Number(raw.sent) || 0, channels: Number(raw.channels) || 0 };
  },

  /** The dates createSessions would skip because they clash, without creating anything. */
  async checkClashes(input: Pick<CreateSessionsInput, "visibility" | "times" | "repeat" | "weeks" | "durationMinutes">) {
    const payload = {
      visibility: input.visibility,
      times: input.times,
      repeat: input.repeat,
      weeks: input.weeks ?? 1,
      duration_minutes: input.durationMinutes,
    };
    const { data, error } = await supabase.rpc("schedule_check_clashes" as never, { p_session: payload } as never);
    if (error) throw error;
    return ((data as unknown as { date: string; start: string }[]) ?? []).map((c) => ({ date: c.date, start: c.start }));
  },

  /** Publishes drafts in from..to and posts the card to each chosen channel; returns its id. */
  async publishGroupsTo(input: {
    from: string;
    to: string;
    title: string;
    closesAt: string;
    channelIds: string[];
    message: string;
    linkBase: string;
  }): Promise<string> {
    const { data, error } = await supabase.rpc(
      "schedule_publish_groups_to" as never,
      {
        p_from: input.from,
        p_to: input.to,
        p_title: input.title,
        p_closes_at: input.closesAt,
        p_channel_ids: input.channelIds,
        p_message: input.message,
        p_link_base: input.linkBase,
      } as never
    );
    if (error) throw error;
    return data as unknown as string;
  },

  /**
   * Writes per-session tags onto the published week card.
   * until types are regenerated after the migration is applied.
   * Returns "unavailable" when that RPC is not deployed yet (tags still live on the session).
   */
  async setOfferSessionTags(offerId: string, tags: Record<string, string>): Promise<"saved" | "unavailable"> {
    // until types are regenerated after the migration is applied
    const rpc = supabase.rpc as unknown as (
      fn: string,
      args?: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
    const { error } = await rpc("schedule_set_offer_session_tags", { p_offer_id: offerId, p_tags: tags });
    if (!error) return "saved";
    if (isMissingRpc(error)) return "unavailable";
    throw new Error(error.message || "Couldn't save the tags");
  },
};

/** Google Calendar (edge function google-calendar). */
export const calendarSyncAPI = {
  async connectUrl(): Promise<string> {
    const { data, error } = await supabase.functions.invoke("google-calendar", {
      body: { action: "connect_url", origin: window.location.origin },
    });
    if (error) throw error;
    if (!data?.url) throw new Error(data?.error || "Couldn't start Google sign-in");
    return data.url as string;
  },

  /** Own calendar for coaches; another coach's (throttled server side) when coachId is given. */
  async sync(coachId?: string): Promise<boolean> {
    const { data, error } = await supabase.functions.invoke("google-calendar", {
      body: { action: "sync", ...(coachId ? { coach_id: coachId } : {}) },
    });
    if (error) throw error;
    return Boolean(data?.synced);
  },

  async disconnect(): Promise<void> {
    const { error } = await supabase.functions.invoke("google-calendar", { body: { action: "disconnect" } });
    if (error) throw error;
  },

  /** Adds an accepted booking to the coach's Google Calendar. Never throws; returns whether it was added. */
  async addEvent(bookingId: string): Promise<{ added: boolean; reason?: string }> {
    const { data, error } = await supabase.functions.invoke("google-calendar", {
      body: { action: "add_event", booking_id: bookingId },
    });
    if (error) return { added: false, reason: "error" };
    return { added: Boolean(data?.added), reason: data?.reason };
  },
};

export interface GroupOfferChangeFrom {
  date: string;
  startTime: string;
  place: string | null;
  location: "online" | "in-person";
}

export interface GroupOfferSession {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  sessionName: string;
  price: number;
  /** Previous listed price after the coach raised/lowered it (new picks only). */
  priceFrom: number | null;
  capacity: number;
  location: "online" | "in-person";
  place: string | null;
  bookedCount: number;
  pendingConfirmCount: number;
  myStatus: string | null;
  myBookingId: string | null;
  myPaidAmount: number | null;
  myChangeAsk: "pending" | "keep" | "cancel" | null;
  changeFrom: GroupOfferChangeFrom | null;
  cancelled: boolean;
  cancelRefund: string | null;
  isNew: boolean;
  started: boolean;
}

export interface GroupOffer {
  id: string;
  title: string;
  closesAt: string;
  closed: boolean;
  coachId: string;
  coachName: string;
  coachSlug: string | null;
  coachPaysDirect: boolean;
  coachPayNote: string | null;
  locations: string[];
  sessions: GroupOfferSession[];
}

export interface GroupOfferSessionPatch {
  id: string;
  date?: string;
  start?: string;
  where?: string;
  capacity?: number;
  price?: number;
}

export interface GroupOfferAdd {
  title: string;
  date: string;
  start: string;
  durationMinutes: number;
  where: string;
  capacity: number;
  price: number;
  pillar?: string;
}

const mapOfferSession = (s: Row): GroupOfferSession => {
  const from = (s.change_from ?? null) as Row | null;
  return {
    id: s.id,
    date: s.date,
    startTime: s.start_time,
    endTime: s.end_time,
    durationMinutes: Number(s.duration_minutes) || 60,
    sessionName: s.session_name || "Group session",
    price: Number(s.price) || 0,
    priceFrom: s.price_from != null ? Number(s.price_from) : null,
    capacity: Number(s.capacity) || 1,
    location: s.location === "online" ? "online" : "in-person",
    place: s.place ?? null,
    bookedCount: Number(s.booked_count) || 0,
    pendingConfirmCount: Number(s.pending_confirm_count) || 0,
    myStatus: s.my_status ?? null,
    myBookingId: s.my_booking_id ?? null,
    myPaidAmount: s.my_paid_amount != null ? Number(s.my_paid_amount) : null,
    myChangeAsk: s.my_change_ask === "pending" || s.my_change_ask === "keep" || s.my_change_ask === "cancel" ? s.my_change_ask : null,
    changeFrom: from
      ? {
          date: String(from.date),
          startTime: String(from.start_time ?? from.startTime ?? "00:00:00"),
          place: from.place ?? null,
          location: from.location === "online" ? "online" : "in-person",
        }
      : null,
    cancelled: Boolean(s.cancelled),
    cancelRefund: s.cancel_refund ?? null,
    isNew: Boolean(s.is_new),
    started: Boolean(s.started),
  };
};

/** Pick-and-pay cards for published group weeks (ATH-72 / WC4 week post). */
export const groupOffersAPI = {
  async get(offerId: string): Promise<GroupOffer | null> {
    const { data, error } = await supabase.rpc("get_group_offer", { p_offer_id: offerId });
    if (error) throw error;
    if (!data) return null;
    const raw = data as Row;
    return {
      id: raw.id,
      title: raw.title,
      closesAt: raw.closes_at,
      closed: Boolean(raw.closed),
      coachId: raw.coach_id,
      coachName: raw.coach_name || "Coach",
      coachSlug: raw.coach_slug ?? null,
      coachPaysDirect: raw.coach_pay_mode === "self",
      coachPayNote: raw.coach_pay_note ?? null,
      locations: Array.isArray(raw.locations) ? (raw.locations as string[]).filter(Boolean) : [],
      sessions: ((raw.sessions as Row[]) ?? []).map(mapOfferSession),
    };
  },

  /** Coach edits the live week card: when/where/spots/price, add, cancel, close picks. */
  async update(
    offerId: string,
    patch: {
      closePicks?: boolean;
      updates?: GroupOfferSessionPatch[];
      cancelIds?: string[];
      adds?: GroupOfferAdd[];
    }
  ): Promise<{ lines: string[]; posted: number }> {
    const payload: Record<string, unknown> = {};
    if (patch.closePicks) payload.close_picks = true;
    if (patch.updates?.length) {
      payload.updates = patch.updates.map((u) => ({
        id: u.id,
        ...(u.date ? { date: u.date } : {}),
        ...(u.start ? { start: u.start } : {}),
        ...(u.where !== undefined ? { where: u.where } : {}),
        ...(u.capacity !== undefined ? { capacity: u.capacity } : {}),
        ...(u.price !== undefined ? { price: u.price } : {}),
      }));
    }
    if (patch.cancelIds?.length) payload.cancel_ids = patch.cancelIds;
    if (patch.adds?.length) {
      payload.adds = patch.adds.map((a) => ({
        title: a.title,
        session_name: a.title,
        date: a.date,
        start: a.start,
        duration_minutes: a.durationMinutes,
        where: a.where,
        capacity: a.capacity,
        price: a.price,
        pillar: a.pillar ?? null,
      }));
    }
    const { data, error } = await supabase.rpc("update_group_offer" as never, {
      p_offer_id: offerId,
      p_patch: payload as Json,
    } as never);
    if (error) throw error;
    const raw = (data ?? {}) as Row;
    return {
      lines: Array.isArray(raw.lines) ? (raw.lines as string[]) : [],
      posted: Number(raw.posted) || 0,
    };
  },

  /** Family answers Still coming / Cancel after a time or place change (credit, not card refund). */
  async answerChange(occurrenceId: string, keep: boolean): Promise<{ kept: boolean; credit: boolean }> {
    const { data, error } = await supabase.rpc("answer_group_offer_change" as never, {
      p_occurrence_id: occurrenceId,
      p_keep: keep,
    } as never);
    if (error) throw error;
    const raw = (data ?? {}) as Row;
    return { kept: Boolean(raw.kept), credit: Boolean(raw.credit) };
  },
};
