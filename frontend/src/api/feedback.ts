/**
 * Session feedback (ATH-82): who came, a 1 to 10 score only the coach sees, one summary for
 * every family who came, and optional notes for single athletes afterwards.
 */
import { supabase } from "@/integrations/supabase/client";

type Row = Record<string, any>;

export interface FeedbackAthlete {
  bookingId: string;
  athleteId: string;
  name: string;
  imageUrl: string | null;
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
  started: boolean;
  ended: boolean;
  submitted: boolean;
  noShow: boolean;
  summary: string | null;
  score: number | null;
  editCount: number;
  athletes: FeedbackAthlete[];
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
      started: Boolean(raw.started),
      ended: Boolean(raw.ended),
      submitted: Boolean(raw.submitted),
      noShow: Boolean(raw.no_show),
      summary: raw.summary ?? null,
      score: raw.score != null ? Number(raw.score) : null,
      editCount: Number(raw.edit_count) || 0,
      athletes: ((raw.athletes as Row[]) ?? []).map((a) => ({
        bookingId: a.booking_id,
        athleteId: a.athlete_id,
        name: a.name || "Athlete",
        imageUrl: a.image_url ?? null,
        attendance: a.attendance ?? null,
        note: a.note ?? null,
      })),
    };
  },

  async submit(slotId: string, absent: string[], score: number | null, summary: string) {
    const { data, error } = await supabase.rpc("submit_session_feedback", {
      p_slot_id: slotId,
      p_absent: absent,
      p_score: score ?? 0,
      p_summary: summary,
    });
    if (error) throw error;
    const raw = (data ?? {}) as Row;
    return { noShow: Boolean(raw.no_show), present: Number(raw.present) || 0 };
  },

  async setNote(bookingId: string, note: string): Promise<void> {
    const { error } = await supabase.rpc("set_session_note", { p_booking_id: bookingId, p_note: note });
    if (error) throw error;
  },
};
