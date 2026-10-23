/** Coach offline payments to confirm (WC4). */
import { supabase } from "@/integrations/supabase/client";
import { toOfflineSummary, type OfflinePaymentsSummary } from "@/utils/offlinePayments";

export type PendingOfflinePayment = {
  bookingId: string;
  occurrenceId: string;
  athleteId: string;
  athleteName: string;
  payerName: string;
  occurrenceDate: string;
  startTime: string;
  sessionName: string;
  amount: number;
  sessionDone: boolean;
};

type Row = Record<string, unknown>;

const mapRow = (row: Row): PendingOfflinePayment => ({
  bookingId: String(row.booking_id),
  occurrenceId: String(row.occurrence_id),
  athleteId: String(row.athlete_id),
  athleteName: String(row.athlete_name || "Athlete"),
  payerName: String(row.payer_name || "Family"),
  occurrenceDate: String(row.occurrence_date),
  startTime: String(row.start_time || ""),
  sessionName: String(row.session_name || "Session"),
  amount: Number(row.amount) || 0,
  sessionDone: Boolean(row.session_done),
});

export const offlinePayAPI = {
  async pending(): Promise<PendingOfflinePayment[]> {
    const { data, error } = await supabase.rpc("coach_pending_offline_payments" as never);
    if (error) throw error;
    return ((data as Row[]) ?? []).map(mapRow);
  },

  /** My Business: waiting, paid to you directly (this month, all time) and the latest 10. */
  async summary(): Promise<OfflinePaymentsSummary> {
    const { data, error } = await supabase.rpc("get_coach_offline_payments" as never);
    if (error) throw error;
    return toOfflineSummary(data);
  },

  async confirm(bookingId: string): Promise<void> {
    const { error } = await supabase.rpc("confirm_offline_payment" as never, { p_booking_id: bookingId } as never);
    if (error) throw error;
  },
};
