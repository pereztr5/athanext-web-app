/** Named funnel events for the shared PostHog project (app + athanext.com). */
import { captureEvent } from "./posthog";

export const trackSignupStarted = (props?: { source?: string }) =>
  captureEvent("signup_started", props);

export const trackAccountCreated = (props?: { persona?: string; source?: string }) =>
  captureEvent("account_created", props);

export const trackBookingCompleted = (props?: { sessions?: number; requests?: number }) =>
  captureEvent("booking_completed", props);

export const trackCampSignupCompleted = (props?: { pay_method?: string; athletes?: number }) =>
  captureEvent("camp_signup_completed", props);
