/**
 * Session feedback (ATH-82): who came, a 1 to 10 score families see too, one summary for
 * every family who came, and optional notes for single athletes, sent with the summary or later.
 */
import { supabase } from "@/integrations/supabase/client";

type Row = Record<string, any>;

export interface FeedbackAthlete {
  bookingId: string;
  athleteId: string;
  name: string;
  imageUrl: string | null;
  age: number | null;
  position: string | null;
  /** The parent's name on a minor's account, for the roll call. Null until the migration is applied. */
  parentName: string | null;
  attendance: "present" | "absent" | "no_show" | null;
  note: string | null;
}

export interface FeedbackScreen {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  sessionName: string;
  sessionType: "individual" | "group";
  pillar: string | null;
  location: "online" | "in-person";
  place: string | null;
  started: boolean;
  ended: boolean;
  submitted: boolean;
  noShow: boolean;
  summary: string | null;
  score: number | null;
  editCount: number;
  /** Server switch: families of athletes marked as missed get a short missed message, not the summary. */
  missedGetsShortMessage: boolean;
  athletes: FeedbackAthlete[];
}

/** A session that ended without feedback, for the "1 of N · feedback due" queue. */
export interface FeedbackDueSession {
  id: string;
  date: string;
  startTime: string;
  title: string;
}

export const feedbackAPI = {
  async screen(slotId: string): Promise<FeedbackScreen> {
    const { data, error } = await supabase.rpc("get_feedback_screen", { p_slot_id: slotId });
    if (error) throw error;
    const raw = (data ?? {}) as Row;
    return {
      id: raw.id,
      date: raw.date,
      startTime: raw.start_time,
      endTime: raw.end_time,
      sessionName: raw.session_name || "Session",
      sessionType: raw.session_type === "group" ? "group" : "individual",
      pillar: raw.pillar ?? null,
      location: raw.location === "online" ? "online" : "in-person",
      place: raw.place ?? null,
      started: Boolean(raw.started),
      ended: Boolean(raw.ended),
      submitted: Boolean(raw.submitted),
      noShow: Boolean(raw.no_show),
      summary: raw.summary ?? null,
      score: raw.score != null ? Number(raw.score) : null,
      editCount: Number(raw.edit_count) || 0,
      missedGetsShortMessage: Boolean(raw.missed_gets_short_message),
      athletes: ((raw.athletes as Row[]) ?? []).map((a) => ({
        bookingId: a.booking_id,
        athleteId: a.athlete_id,
        name: a.name || "Athlete",
        imageUrl: a.image_url ?? null,
        age: a.age != null ? Number(a.age) : null,
        position: a.position ?? null,
        parentName: a.parent_name ?? null,
        attendance: a.attendance ?? null,
        note: a.note ?? null,
      })),
    };
  },

  async due(): Promise<FeedbackDueSession[]> {
    const { data, error } = await supabase.rpc("get_feedback_due");
    if (error) throw error;
    return ((data as Row[]) ?? []).map((r) => ({
      id: r.id,
      date: r.date,
      startTime: r.start_time,
      title: r.title || r.session_name || "Session",
    }));
  },

  /** `notes` maps booking id to a note for an athlete who came; an empty note clears it. */
  async submit(slotId: string, absent: string[], score: number | null, summary: string, notes: Record<string, string> = {}) {
    // p_notes comes from 20261010150000_feedback_flow.sql; left out when empty.
    const args = {
      p_slot_id: slotId,
      p_absent: absent,
      p_score: score ?? 0,
      p_summary: summary,
      ...(Object.keys(notes).length ? { p_notes: notes } : {}),
    };
    const { data, error } = await supabase.rpc("submit_session_feedback", args);
    if (error) throw error;
    const raw = (data ?? {}) as Row;
    return { noShow: Boolean(raw.no_show), present: Number(raw.present) || 0 };
  },

  async setNote(bookingId: string, note: string): Promise<void> {
    const { error } = await supabase.rpc("set_session_note", { p_booking_id: bookingId, p_note: note });
    if (error) throw error;
  },
};
