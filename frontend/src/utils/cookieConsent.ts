/**
 * Cookie consent (ATH-119). "all" allows analytics / tracking; "essential" keeps only what the
 * app needs to work (sign-in, preferences). Tracking code must check analyticsAllowed() and
 * listen for COOKIE_CONSENT_EVENT before it loads anything.
 *
 * The choice is kept in localStorage and in a first-party cookie on .athanext.com, so the sales
 * site can read the same answer.
 */
export type CookieConsent = "all" | "essential";

const STORAGE_KEY = "athanext-cookie-consent";
const COOKIE = "an_cookie_consent";
const ONE_YEAR = 60 * 60 * 24 * 365;

/** Fired on window with the new choice as detail. */
export const COOKIE_CONSENT_EVENT = "athanext:cookie-consent";
/** Fired on window to show the banner again (Cookie settings). */
export const COOKIE_SETTINGS_EVENT = "athanext:cookie-settings";

const isConsent = (value: unknown): value is CookieConsent => value === "all" || value === "essential";

export const readCookieConsent = (): CookieConsent | null => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isConsent(stored)) return stored;
  } catch {
    // Storage blocked: fall back to the cookie.
  }
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`));
  return match && isConsent(match[1]) ? match[1] : null;
};

export const saveCookieConsent = (choice: CookieConsent) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Storage blocked: the cookie still carries it.
  }
  const domain = window.location.hostname.endsWith("athanext.com") ? "; domain=.athanext.com" : "";
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${COOKIE}=${choice}; path=/; max-age=${ONE_YEAR}; samesite=lax${domain}${secure}`;
  window.dispatchEvent(new CustomEvent<CookieConsent>(COOKIE_CONSENT_EVENT, { detail: choice }));
};

/** True only after the visitor pressed Accept all. */
export const analyticsAllowed = () => readCookieConsent() === "all";

export const openCookieSettings = () => window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT));
