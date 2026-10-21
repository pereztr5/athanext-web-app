// Pure helpers shared by the Stripe Checkout functions (create-booking-payment, coach-billing).

/** Stripe accepts a Checkout expiry 30 minutes to 24 hours out; 32 leaves room for clock drift. */
export const CHECKOUT_HOLD_MINUTES = 32;

const MINUTE_MS = 60_000;

/** Start of the current minute. Keys and expiries built from it repeat within that minute. */
export const minuteBucket = (nowMs: number) => Math.floor(nowMs / MINUTE_MS);

/**
 * When a new Checkout (and the spots it holds) expires. Rounded to the minute so the same
 * request retried within that minute sends Stripe identical parameters for its idempotency key.
 */
export const checkoutExpiry = (nowMs: number, minutes = CHECKOUT_HOLD_MINUTES) => {
  const ms = (minuteBucket(nowMs) + 1 + minutes) * MINUTE_MS;
  return { unix: Math.floor(ms / 1000), iso: new Date(ms).toISOString() };
};

const sha256Hex = async (text: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

/**
 * Stripe idempotency key from the rows a request is for (order does not matter) and the
 * attempt (for example the Checkout it replaces), so a retry of the same attempt gets the same
 * Checkout back while a new attempt gets a new one. Stays under Stripe's 255 character limit.
 */
export const idempotencyKey = async (prefix: string, ids: string[], attempt: string | number) => {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))].sort();
  const hash = await sha256Hex(unique.join(","));
  return `${prefix}:${hash.slice(0, 40)}:${String(attempt).slice(0, 120)}`;
};

/** Comma list from Checkout metadata, for example booking_ids. */
export const idsFromMetadata = (value: unknown): string[] =>
  [...new Set(String(value ?? "").split(",").map((id) => id.trim()).filter(Boolean))];
