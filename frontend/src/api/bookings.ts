/**
 * Bookings API Layer
 * Centralized API functions for booking confirmation and related operations
 */

import type { ApiResponse, ApiError } from './client';
import { supabase } from '@/integrations/supabase/client';
import { functionPaymentError, paymentErrorMessage } from '@/utils/paymentErrors';

export interface BookingConfirmationData {
  bookingId: string;
  coachId: string;
  athleteId: string;
  status: string;
  paymentStatus: string;
  notes: string | null;
  createdAt: string;
  slot?: {
    session_name?: string | null;
    session_type?: string | null;
    location?: string | null;
    price?: number | null;
    duration_minutes?: number | null;
    occurrence_date?: string | null;
    start_time?: string | null;
    end_time?: string | null;
  };
}

export interface CoachInfo {
  name?: string | null;
  title?: string | null;
}

const buildApiError = (
  code: string,
  message: string,
  status = 500,
  originalError?: unknown
): ApiError => ({
  code,
  message,
  status,
  originalError,
});

/**
 * Verify payment status via edge function
 * Handles delayed webhooks and manual verification
 */
export const verifyPaymentStatus = async (
  sessionId: string
): Promise<ApiResponse<{ verified: boolean; paid: boolean }>> => {
  const fallback = "We couldn't confirm your payment yet. If you paid, it will show in My sessions shortly.";
  try {
    const { data, error } = await supabase.functions.invoke('create-booking-payment-v0', {
      body: { session_id: sessionId },
    });
    if (error || data?.error) {
      const message = error ? await functionPaymentError(error, fallback) : paymentErrorMessage(data.error, fallback);
      console.error('Payment verification failed:', error ?? data?.error);
      return { data: null, error: buildApiError('PAYMENT_VERIFICATION_ERROR', message, 500, error ?? data?.error) };
    }

    return {
      data: { verified: true, paid: Boolean(data?.paid) || data?.payment_status === 'paid' },
      error: null,
    };
  } catch (err: any) {
    console.error('Payment verification failed:', err);
    return {
      data: null,
      error: buildApiError('PAYMENT_VERIFICATION_ERROR', paymentErrorMessage(err, fallback), 500, err),
    };
  }
};

/**
 * Fetch booking confirmation details by stripe session ID
 */
export const fetchBookingConfirmation = async (
  sessionId: string
): Promise<ApiResponse<BookingConfirmationData>> => {
  try {
    const { data, error } = await supabase
      .from('coach_slot_bookings')
      .select(
        `id, coach_id, athlete_id, status, payment_status, notes, created_at,
         coach_availability_slot_occurrences (
           session_name,
           session_type,
           location,
           price,
           duration_minutes,
           occurrence_date,
           start_time,
           end_time
         )`
      )
      .eq('stripe_session_id', sessionId)
      // One checkout can cover several bookings; the full list comes from api/receipts.
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return {
        data: null,
        error: buildApiError(
          'BOOKING_NOT_FOUND',
          'Booking not found. If you just paid, please refresh in a moment.',
          404
        ),
      };
    }

    const typedData = data as any;
    return {
      data: {
        bookingId: typedData.id,
        coachId: typedData.coach_id,
        athleteId: typedData.athlete_id,
        status: typedData.status,
        paymentStatus: typedData.payment_status,
        notes: typedData.notes,
        createdAt: typedData.created_at,
        slot: typedData.coach_availability_slot_occurrences || {},
      },
      error: null,
    };
  } catch (err: any) {
    console.error('Failed to fetch booking confirmation:', err);
    return {
      data: null,
      error: buildApiError(
        'BOOKING_FETCH_ERROR',
        err?.message || 'Unable to load booking details',
        500,
        err
      ),
    };
  }
};

/**
 * Fetch coach information by ID
 */
export const fetchCoachInfo = async (
  coachId: string
): Promise<ApiResponse<CoachInfo>> => {
  try {
    const { data, error } = await supabase
      .from('coaches')
      .select('name')
      .eq('id', coachId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return {
        data: { name: 'Your coach', title: 'Coach' },
        error: null,
      };
    }

    return {
      data: {
        name: data.name,
        title: null,
      },
      error: null,
    };
  } catch (err: any) {
    console.error('Failed to fetch coach info:', err);
    // Return default coach info on error
    return {
      data: { name: 'Your coach', title: 'Coach' },
      error: null,
    };
  }
};

/**
 * Main function to fetch complete booking confirmation with coach details
 */
export const fetchCompleteBookingConfirmation = async (
  sessionId: string
): Promise<
  ApiResponse<{
    booking: BookingConfirmationData;
    coach: CoachInfo;
  }>
> => {
  try {
    const initialBookingResult = await fetchBookingConfirmation(sessionId);
    const needsVerification =
      !initialBookingResult.data ||
      initialBookingResult.data.paymentStatus !== 'paid';
      
    if (needsVerification) {
      const verifyResult = await verifyPaymentStatus(sessionId);
      if (verifyResult.error) {
        console.warn('Payment verification warning:', verifyResult.error);
      }
    }

    const bookingResult = needsVerification
      ? await fetchBookingConfirmation(sessionId)
      : initialBookingResult;
    if (bookingResult.error) {
      return {
        data: null,
        error: bookingResult.error,
      };
    }

    if (!bookingResult.data) {
      return {
        data: null,
        error: buildApiError(
          'NO_BOOKING_DATA',
          'No booking data available',
          500
        ),
      };
    }

    // Fetch coach info
    const coachResult = await fetchCoachInfo(bookingResult.data.coachId);
    const coachInfo = coachResult.data || { name: 'Your coach', title: 'Coach' };

    return {
      data: {
        booking: bookingResult.data,
        coach: coachInfo,
      },
      error: null,
    };
  } catch (err: any) {
    console.error('Failed to fetch complete booking confirmation:', err);
    return {
      data: null,
      error: buildApiError(
        'COMPLETE_BOOKING_ERROR',
        err?.message || 'Unable to load booking confirmation',
        500,
        err
      ),
    };
  }
};

/**
 * Pays for one booked-but-unpaid session. Opens Stripe when there is something to charge;
 * otherwise (free session, already paid, paid to the coach) the booking is confirmed as is and
 * `redirected` is false so the caller can say so and refresh.
 */
export const startOccurrenceCheckout = async (
  occurrenceId: string,
  athleteId: string
): Promise<{ redirected: boolean; booked: boolean }> => {
  const { data, error } = await supabase.functions.invoke("create-booking-payment-v0", {
    body: {
      occurrence_id: occurrenceId,
      occurrence_ids: [occurrenceId],
      athlete_id: athleteId,
    },
  });

  if (error) {
    throw new Error(await functionPaymentError(error, "Could not start payment. Please try again."));
  }
  if (data?.error) {
    throw new Error(paymentErrorMessage(data.error, "Could not start payment. Please try again."));
  }
  if (data?.url) {
    window.location.href = data.url;
    return { redirected: true, booked: false };
  }
  if (data?.booked || data?.direct || data?.requested) {
    return { redirected: false, booked: true };
  }
  throw new Error("Payment link was not created. Please try again.");
};

export const bookingsAPI = {
  fetchCompleteBookingConfirmation,
  fetchBookingConfirmation,
  fetchCoachInfo,
  verifyPaymentStatus,
};
