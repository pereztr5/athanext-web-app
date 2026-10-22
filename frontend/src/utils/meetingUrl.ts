/**
 * A coach's video-call link (Zoom, Meet, Teams). Only https URLs are stored, so a
 * pasted "javascript:" or a bare word never becomes the join link.
 *
 * One rule, shared with the coach_meeting_links_https check in
 * backend/supabase/migrations/20261021201000_coach_meeting_links.sql (meetingUrl.test.ts
 * checks the migration uses this exact pattern and limit). The pattern is written so
 * JavaScript and Postgres read it the same way.
 */

export const MEETING_URL_MAX = 500;
export const MEETING_URL_PATTERN = "^https://[^/?#@\\s]+\\.[^/?#@\\s]+([/?#]\\S*)?$";
const pattern = new RegExp(MEETING_URL_PATTERN);

/** True when the database will accept this exact string. */
export const meetingUrlAllowed = (value: string) => value.length <= MEETING_URL_MAX && pattern.test(value);

export type MeetingUrlResult = { url: string; error?: undefined } | { url: null; error: string };

/** The https URL to store, or a friendly reason it can't be used. Empty input is an error too. */
export const checkMeetingUrl = (raw: string | null | undefined): MeetingUrlResult => {
  const value = (raw ?? "").trim();
  const generic = "Use the full link from Zoom, Meet or Teams, like https://zoom.us/j/123";
  if (!value) return { url: null, error: generic };
  if (/^http:\/\//i.test(value)) return { url: null, error: "Use the https:// version of the link" };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { url: null, error: generic };
  }
  if (url.protocol !== "https:") return { url: null, error: generic };
  if (url.username || url.password) return { url: null, error: "Remove the name and password from the link" };
  const out = url.toString();
  if (out.length > MEETING_URL_MAX) return { url: null, error: `Use a link of ${MEETING_URL_MAX} characters or fewer` };
  if (!meetingUrlAllowed(out)) return { url: null, error: generic };
  return { url: out };
};

/** The https URL to store, or null when it isn't a usable meeting link. Empty input is null. */
export const normalizeMeetingUrl = (raw: string | null | undefined): string | null => checkMeetingUrl(raw).url;
