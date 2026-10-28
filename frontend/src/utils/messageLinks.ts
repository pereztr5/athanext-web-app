/**
 * Chat messages are plain text; web addresses in them become tappable. AthaNext links (this site,
 * athanext.com, app.athanext.com) open inside the app, so a shared session lands on that session.
 */
export type MessagePart = { kind: "text"; text: string } | { kind: "link"; text: string; href: string; appPath: string | null };

const URL_RE = /\bhttps?:\/\/[^\s<>"']+/gi;
// Punctuation that usually ends the sentence, not the link.
const TRAILING = /[.,;:!?)\]}'"]+$/;
const APP_HOSTS = new Set(["athanext.com", "www.athanext.com", "app.athanext.com"]);

/** The in-app path ("/coach?session=1") for an AthaNext link, or null for another site. */
export const appPathFor = (href: string, origin: string): string | null => {
  try {
    const url = new URL(href);
    const here = new URL(origin);
    if (url.host !== here.host && !APP_HOSTS.has(url.host)) return null;
    return `${url.pathname}${url.search}${url.hash}` || "/";
  } catch {
    return null;
  }
};

export const splitMessageLinks = (text: string, origin: string): MessagePart[] => {
  const parts: MessagePart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const raw = match[0];
    const start = match.index ?? 0;
    const href = raw.replace(TRAILING, "");
    if (start > last) parts.push({ kind: "text", text: text.slice(last, start) });
    parts.push({ kind: "link", text: href, href, appPath: appPathFor(href, origin) });
    last = start + href.length;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts;
};
