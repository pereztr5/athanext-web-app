/**
 * Shared pieces of the create and plan session forms: one list of lengths, the "still missing"
 * line above a disabled button, and server errors in plain words.
 */

/** Every session length a coach can pick, in minutes. The database allows 15 to 480. */
export const SESSION_LENGTHS = [30, 45, 60, 75, 90, 120, 150, 180] as const;

/** "45 min", "90 min", "2 hours", "2 hr 30 min". */
export const lengthLabel = (minutes: number) => {
  if (minutes < 120) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hours`;
};

/** The lengths to offer, keeping a saved length that isn't in the list so it still shows. */
export const lengthOptions = (current?: number) =>
  current && !(SESSION_LENGTHS as readonly number[]).includes(current)
    ? [...SESSION_LENGTHS, current].sort((a, b) => a - b)
    : [...SESSION_LENGTHS];

/** "a", "a and b", "a, b and c". */
export const joinAnd = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/** Labels of the checks that failed, in order. Each check is [what to add, is it there]. */
export const missingFields = (checks: ReadonlyArray<readonly [string, boolean]>) =>
  checks.filter(([, ok]) => !ok).map(([what]) => what);

/** The line above a disabled button: "Still missing: a time and a price." Empty when nothing is. */
export const missingLine = (missing: string[]) => (missing.length ? `Still missing: ${joinAnd(missing)}.` : "");

const PLAIN: [RegExp, string][] = [
  [/failed to fetch|network ?error|load failed|networkerror/i, "You're offline or the connection dropped. Check your connection and try again."],
  [/jwt|not authenticated|auth session missing|refresh token/i, "You've been signed out. Sign in again and try once more."],
  [/permission denied|row-level security|42501/i, "You don't have access to do that. Sign in as the coach and try again."],
  [/duplicate key|already exists/i, "That session already exists. Check your schedule."],
  [/violates check constraint|invalid input syntax|out of range/i, "One of the values isn't allowed. Check the time, length and price."],
  [/could not find the function|schema cache|does not exist/i, "This isn't available yet. Try again in a few minutes."],
  [/timeout|timed out/i, "That took too long. Try again."],
];

/** Server and network errors in plain words. Messages the server already writes for people pass through. */
export const plainError = (err: unknown, fallback = "That didn't go through. Try again.") => {
  const message =
    err instanceof Error
      ? err.message
      : err && typeof err === "object" && "message" in err
        ? String((err as { message?: unknown }).message ?? "")
        : typeof err === "string"
          ? err
          : "";
  if (!message.trim()) return fallback;
  const match = PLAIN.find(([pattern]) => pattern.test(message));
  if (match) return match[1];
  // Server messages are short sentences; anything long or code-like gets the fallback.
  return message.length > 160 || /[{}<>]|\bsql\b|\bpgrst\d+/i.test(message) ? fallback : /[.!?]$/.test(message.trim()) ? message.trim() : `${message.trim()}.`;
};
