/**
 * Coach Home (ATH-76): money in per day and what families still owe, plus sessions that
 * ended without feedback. Sessions for Today and This week come from scheduleAPI.
 */
import { supabase } from "@/integrations/supabase/client";

type Row = Record<string, any>;

export interface CoachEarnings {
  /** One entry per day, oldest first: the period before, then the chosen period. */
  days: { date: string; amount: number }[];
  owed: number;
  overdueCount: number;
}

export interface FeedbackDue {
  id: string;
  date: string;
  startTime: string;
  sessionName: string;
  sessionType: "individual" | "group";
}

export const homeAPI = {
  async earnings(days: number): Promise<CoachEarnings> {
    const { data, error } = await supabase.rpc("get_coach_earnings", { p_days: days });
    if (error) throw error;
    const raw = (data ?? {}) as Row;
    return {
      days: ((raw.days as Row[]) ?? []).map((d) => ({ date: d.date, amount: Number(d.amount) || 0 })),
      owed: Number(raw.owed) || 0,
      overdueCount: Number(raw.overdue_count) || 0,
    };
  },

  async feedbackDue(): Promise<FeedbackDue[]> {
    const { data, error } = await supabase.rpc("get_feedback_due");
    if (error) throw error;
    return ((data as Row[]) ?? []).map((r) => ({
      id: r.id,
      date: r.date,
      startTime: r.start_time,
      sessionName: r.session_name || "Session",
      sessionType: r.session_type === "group" ? "group" : "individual",
    }));
  },
};
