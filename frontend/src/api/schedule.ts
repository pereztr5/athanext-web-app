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
  bring?: string;
}

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
};
