/**
 * Booking receipt (Working Copy 2, a-receipt): every booking made in one go, across coaches.
 * RPC from 20261010250000_booking_receipt.sql.
 */
import { supabase } from "@/integrations/supabase/client";
import { verifyPaymentStatus } from "@/api/bookings";

export interface ReceiptBooking {
  id: string;
  athleteId: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  coach: { id: string; name: string; slug: string | null; payMode: "app" | "self"; payNote: string | null };
  sessionName: string | null;
  sessionType: string | null;
  pillar: string | null;
  /** Eastern date and wall times, as stored. */
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  location: string | null;
  place: string | null;
  price: number;
  /** Fee-inclusive amount charged, once the payment row is recorded. */
  charged: number | null;
  /** Platform fee and card processing, once the payment row is recorded. */
  platformFee: number | null;
  processingFee: number | null;
}

export interface BookingReceiptData {
  receiptNumber: string;
  issuedAt: string;
  email: string | null;
  bookings: ReceiptBooking[];
}

export interface ReceiptSource {
  stripeSessionId?: string | null;
  bookingIds?: string[];
}

type Row = Record<string, any>;

const num = (value: unknown): number | null => (value == null || value === "" ? null : Number(value));

const toBooking = (row: Row): ReceiptBooking => {
  return {
    id: row.id,
    athleteId: row.athlete_id,
    status: row.status,
    paymentStatus: row.payment_status,
    createdAt: row.created_at,
    coach: {
      id: row.coach?.id,
      name: row.coach?.name?.trim() || "Your coach",
      slug: row.coach?.slug ?? null,
      payMode: row.coach?.pay_mode === "self" ? "self" : "app",
      payNote: row.coach?.pay_note?.trim() || null,
    },
    sessionName: row.session_name?.trim() || null,
    sessionType: row.session_type ?? null,
    pillar: row.pillar?.trim() || null,
    date: row.occurrence_date,
    startTime: row.start_time,
    endTime: row.end_time,
    durationMinutes: Number(row.duration_minutes) || 0,
    location: row.location ?? null,
    place: row.place?.trim() || null,
    price: Number(row.price) || 0,
    charged: num(row.charged),
    platformFee: num(row.platform_fee),
    processingFee: num(row.processing_fee),
  };
};

const readReceipt = async ({ stripeSessionId, bookingIds }: ReceiptSource): Promise<BookingReceiptData> => {
  const { data, error } = await (supabase.rpc("get_booking_receipt" as never, {
    p_stripe_session_id: stripeSessionId || null,
    p_booking_ids: bookingIds?.length ? bookingIds : null,
  } as never) as unknown as Promise<{ data: Row | null; error: Error | null }>);
  if (error) throw error;
  return {
    receiptNumber: data?.receipt_number ?? "",
    issuedAt: data?.issued_at ?? "",
    email: data?.email ?? null,
    bookings: ((data?.bookings ?? []) as Row[]).map(toBooking),
  };
};

/**
 * Reads the receipt. Back from Stripe, the payment is verified first when the bookings are
 * missing or still unpaid (delayed webhook), then read again.
 */
export const fetchBookingReceipt = async (source: ReceiptSource): Promise<BookingReceiptData> => {
  const first = await readReceipt(source);
  if (!source.stripeSessionId) return first;
  const needsVerify =
    !first.bookings.length || first.bookings.some((b) => b.paymentStatus === "unpaid" || (b.paymentStatus === "paid" && b.charged == null));
  if (!needsVerify) return first;
  await verifyPaymentStatus(source.stripeSessionId);
  return readReceipt(source);
};

/** The function's own error message ("You've resent this receipt 3 times…"), else the client's. */
const functionErrorMessage = async (error: unknown): Promise<string> => {
  const fallback = "Couldn't send the receipt. Try again";
  const context = (error as { context?: Response }).context;
  if (!context || typeof context.clone !== "function") return fallback;
  try {
    const body = (await context.clone().json()) as { error?: unknown };
    if (typeof body?.error === "string" && body.error.trim()) return body.error.trim();
  } catch {
    // The client may already have read the body.
  }
  return fallback;
};

/**
 * Emails the receipt again from support@athanext.com to the account's own address. The
 * function checks the caller owns the bookings and allows 3 resends per booking an hour.
 * Returns the address it went to.
 */
export const resendBookingReceipt = async ({ stripeSessionId, bookingIds }: ReceiptSource): Promise<string> => {
  const { data, error } = await supabase.functions.invoke("send-booking-notifications", {
    body: {
      action: "resend_receipt",
      ...(stripeSessionId ? { stripe_session_id: stripeSessionId } : { booking_ids: bookingIds ?? [] }),
    },
  });
  if (error) throw new Error(await functionErrorMessage(error));
  return String((data as { email?: string } | null)?.email ?? "");
};
