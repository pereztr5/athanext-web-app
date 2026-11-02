/**
 * PostHog (product analytics). Loads only after cookie consent is "all". One shared project
 * with athanext.com so a visitor can be followed from the marketing site into the app
 * (cross-subdomain cookie on .athanext.com).
 */
import posthog from "posthog-js";
import { analyticsAllowed, COOKIE_CONSENT_EVENT, type CookieConsent } from "@/utils/cookieConsent";

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = import.meta.env.VITE_POSTHOG_HOST as string | undefined;

let started = false;

export const isPostHogReady = () => started;

export const startPostHog = () => {
  if (!KEY || !HOST || !analyticsAllowed()) return;
  if (started) {
    posthog.opt_in_capturing();
    return;
  }
  posthog.init(KEY, {
    api_host: HOST,
    // Keep the distinct_id across athanext.com ↔ app.athanext.com.
    cross_subdomain_cookie: true,
    persistence: "localStorage+cookie",
    capture_pageview: false,
    capture_pageleave: true,
    person_profiles: "identified_only",
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "*",
    },
  });
  started = true;
};

export const stopPostHog = () => {
  if (!started) return;
  // Keep the anonymous id so Accept all later still ties to the same person.
  posthog.opt_out_capturing();
};

/** Call once near the app root: starts if already consented, and reacts to banner choices. */
export const bindPostHogConsent = () => {
  if (analyticsAllowed()) startPostHog();
  const onConsent = (event: Event) => {
    const choice = (event as CustomEvent<CookieConsent>).detail;
    if (choice === "all") startPostHog();
    else stopPostHog();
  };
  window.addEventListener(COOKIE_CONSENT_EVENT, onConsent);
  return () => window.removeEventListener(COOKIE_CONSENT_EVENT, onConsent);
};

export const captureEvent = (event: string, properties?: Record<string, unknown>) => {
  if (!isPostHogReady() || posthog.has_opted_out_capturing()) return;
  posthog.capture(event, properties);
};

export const capturePageview = (path: string) => {
  if (!isPostHogReady() || posthog.has_opted_out_capturing()) return;
  posthog.capture("$pageview", { $current_url: `${window.location.origin}${path}` });
};

/** Link the anonymous visitor to the signed-in account. Never pass email or name. */
export const identifyUser = (accountId: string | null | undefined) => {
  if (!isPostHogReady() || posthog.has_opted_out_capturing() || !accountId) return;
  posthog.identify(accountId);
};

export const resetUser = () => {
  if (!isPostHogReady()) return;
  posthog.reset();
};
