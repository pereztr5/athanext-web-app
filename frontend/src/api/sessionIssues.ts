/**
 * Report an issue with a session. report_session_issue() checks the family is on the booking
 * and saves the report; the report-session-issue function then emails support (safety
 * concerns marked URGENT) and sends the family a confirmation.
 */
import { supabase } from "@/integrations/supabase/client";
import type { IssueReason } from "@/utils/sessionIssues";

export const sessionIssuesAPI = {
  /** Returns whether support was emailed. The report is saved either way. */
  async report(bookingId: string, reason: IssueReason, details: string): Promise<{ id: string; emailed: boolean }> {
    const { data, error } = await supabase.rpc(
      "report_session_issue" as never,
      { p_booking_id: bookingId, p_reason: reason, p_details: details.trim() } as never
    );
    if (error) throw new Error(error.message || "That didn't send. Try again");
    const id = String(data);
    const { data: sent, error: sendError } = await supabase.functions.invoke("report-session-issue", {
      body: { report_id: id, origin: window.location.origin },
    });
    if (sendError) console.error("report-session-issue failed; the report is saved", sendError);
    return { id, emailed: Boolean((sent as { emailed?: boolean } | null)?.emailed) };
  },
};
