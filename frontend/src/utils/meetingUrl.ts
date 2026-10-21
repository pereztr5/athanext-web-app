/**
 * A coach's video-call link (Zoom, Meet, Teams). Only https URLs are stored, so a
 * pasted "javascript:" or a bare word never becomes the join link.
 */

const MAX = 500;

/** The https URL to store, or null when it isn't a usable meeting link. Empty input is null. */
export const normalizeMeetingUrl = (raw: string | null | undefined): string | null => {
  const value = (raw ?? "").trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (!url.hostname.includes(".")) return null;
  const out = url.toString();
  if (out.length > MAX) return null;
  return out;
};
