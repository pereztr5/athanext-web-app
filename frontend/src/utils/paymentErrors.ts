import { errorMessage } from "./errorMessage";

/**
 * Turns errors from the payment functions (create-booking-payment and friends) into plain copy
 * families can act on. Messages the function wrote for people are kept; technical ones
 * (database, Stripe, network, missing fields) become a short, honest fallback.
 */

export const PAYMENT_FALLBACK = "We couldn't start your payment. Please try again.";

const NETWORK = /failed to fetch|networkerror|network request failed|load failed|fetcherror|relay error|timed? ?out/i;
const SIGNED_OUT = /invalid authentication|authentication required|jwt|not authenticated|unauthorized|sign in first/i;
const NOT_SET_UP = /payments aren't set up|stripe_secret_key|api key|no such (customer|price|checkout)|stripe/i;
const FULL = /fully booked|is full|filled up/i;
const TECHNICAL =
  /violates|duplicate key|null value|syntax error|relation "|column "|does not exist|_id\b|is required$|non-2xx|edge function|internal server error|unknown error|undefined|\[object object\]|^\s*error\s*$/i;

/** Plain message for a payment failure. `fallback` is used when the raw text isn't meant for people. */
export const paymentErrorMessage = (raw: unknown, fallback = PAYMENT_FALLBACK): string => {
  const text = errorMessage(raw, "").trim();
  if (!text) return fallback;
  if (NETWORK.test(text)) return "We couldn't reach AthaNext. Check your connection and try again.";
  if (SIGNED_OUT.test(text)) return "Your sign-in has expired. Sign in again, then try once more.";
  if (FULL.test(text)) return "That time just filled up. Pick another time.";
  if (NOT_SET_UP.test(text)) return "Card payments aren't available right now. Please try again later.";
  if (TECHNICAL.test(text)) return fallback;
  return text;
};

type FunctionErrorLike = {
  message?: string;
  context?: { json?: () => Promise<{ error?: unknown } | null> };
};

/** Reads the `{ error }` body a Supabase function returned with a non-2xx status. */
export const readFunctionError = async (error: unknown): Promise<string> => {
  const candidate = (error ?? {}) as FunctionErrorLike;
  try {
    const body = await candidate.context?.json?.();
    if (body && typeof body.error === "string" && body.error) return body.error;
  } catch {
    // The response was not JSON.
  }
  return candidate.message ?? "";
};

/** One step: read the function's error, then make it plain. */
export const functionPaymentError = async (error: unknown, fallback = PAYMENT_FALLBACK) =>
  paymentErrorMessage(await readFunctionError(error), fallback);
