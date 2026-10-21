/**
 * "Get help" from a page (a session in progress) opens /help?from=<that page>. Help shows a back
 * link to it. Only plain in-app paths are accepted, so the query string can't send anyone to
 * another site.
 */

const SAFE_PATH = /^\/(?![/\\])[A-Za-z0-9\-._~/%?=&]*$/;

/** The validated in-app path to go back to, or null. */
export const helpBackPath = (from: string | null | undefined): string | null => {
  if (!from) return null;
  const value = from.trim();
  if (value.length > 300 || !SAFE_PATH.test(value)) return null;
  if (value === "/help" || value.startsWith("/help?") || value.startsWith("/help/")) return null;
  return value;
};

/** Back link for Help: "Back to session" for a session page, "Back" otherwise. */
export const helpBackLink = (from: string | null | undefined): { label: string; to: string } | null => {
  const to = helpBackPath(from);
  if (!to) return null;
  return { label: /^\/sessions\/[^/?]+/.test(to) ? "Back to session" : "Back", to };
};

/** The /help link a page uses so Help can send the family back to it. */
export const helpLinkFrom = (path: string) => `/help?from=${encodeURIComponent(path)}`;
