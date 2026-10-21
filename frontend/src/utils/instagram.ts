/**
 * Instagram profile on the coach profile. coaches.instagram_handle stores the bare handle
 * ("jane.doe_10", no @ and no URL), so every way a coach might paste it comes down to that.
 */

/** Letters, numbers, periods and underscores, up to 30 characters. */
const HANDLE = /^[a-z0-9._]{1,30}$/i;

const HOSTS = new Set(["instagram.com", "www.instagram.com", "m.instagram.com", "instagr.am", "www.instagr.am"]);

/**
 * The handle from "@handle", "handle", "instagram.com/handle" or a full profile URL with
 * query or trailing slash. Null when it isn't a valid Instagram handle or profile link.
 */
export const normalizeInstagramHandle = (raw: string | null | undefined): string | null => {
  let value = (raw ?? "").trim();
  if (!value) return null;

  if (/instagram\.com|instagr\.am/i.test(value)) {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    } catch {
      return null;
    }
    if (!HOSTS.has(url.hostname.toLowerCase())) return null;
    const segments = url.pathname.split("/").filter(Boolean);
    // Only a profile link: one path segment (instagram.com/p/... is a post, not a person).
    if (segments.length !== 1) return null;
    value = decodeURIComponent(segments[0]);
  }

  value = value.replace(/^@/, "");
  if (!HANDLE.test(value)) return null;
  // Instagram doesn't allow a handle that starts or ends with a period, or two in a row.
  if (value.startsWith(".") || value.endsWith(".") || value.includes("..")) return null;
  return value;
};

/** https://www.instagram.com/<handle>, or null when the stored value isn't a valid handle. */
export const instagramUrl = (raw: string | null | undefined): string | null => {
  const handle = normalizeInstagramHandle(raw);
  return handle ? `https://www.instagram.com/${handle}` : null;
};
