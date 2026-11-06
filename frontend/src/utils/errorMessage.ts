/**
 * The message to show for a caught error.
 *
 * supabase-js RPC and PostgREST errors are plain `{ code, message, details, hint }` objects, not
 * `Error` instances, so an `err instanceof Error` check drops the server's message. This reads
 * `.message` from an `Error`, from any object with a string `message`, or a thrown string, and
 * returns `fallback` when there is no usable text.
 */
export function errorMessage(err: unknown): string | undefined;
export function errorMessage(err: unknown, fallback: string): string;
export function errorMessage(err: unknown, fallback?: string): string | undefined {
  let message: unknown;
  if (typeof err === "string") message = err;
  else if (err instanceof Error) message = err.message;
  else if (err && typeof err === "object" && "message" in err) message = (err as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message : fallback;
}
