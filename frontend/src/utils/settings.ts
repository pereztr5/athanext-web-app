/**
 * Coach Account Settings (ATH-87) helpers.
 */

export const splitName = (full: string | null | undefined) => {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
};

export const joinName = (first: string, last: string) => [first.trim(), last.trim()].filter(Boolean).join(" ");

/** 0 to 4: length 8+, a number, a symbol, length 12+. Account settings uses usePasswordValidation instead. */
export const passwordStrength = (value: string) => {
  let score = 0;
  if (value.length >= 8) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  if (value.length >= 12) score++;
  const hint = [
    "Use 8 or more characters with a number and a symbol.",
    "Weak. Add a number and a symbol.",
    "Okay. Add a symbol or make it longer.",
    "Strong.",
    "Very strong.",
  ][score];
  return { score, hint };
};

/**
 * Account settings > Notifications is email only (there is no mobile app yet). The in-app
 * notifications list always shows everything. Each switch saves "<kind>_email" in
 * user_profiles.notification_prefs; false turns that email off, missing means on.
 */
export type NotificationItem = {
  kind: string;
  title: string;
  detail: string;
};

/**
 * Every email switch and the edge function that reads it before sending. A switch only belongs
 * on the page if its key is in this map (settings.test.ts checks that).
 */
export const EMAIL_PREF_SENDERS: Record<string, string> = {
  booking_email: "send-booking-notifications",
  message_email: "send-conversation-email",
  receipts_email: "send-booking-notifications",
};

/** Shown under the switches on both settings pages. */
export const NOTIFICATIONS_CAPTION =
  "Emails go to your sign-in email. Everything also shows on your notifications list in AthaNext, whatever you choose here.";

export const emailPrefKey = (kind: string) => `${kind}_email`;

export const COACH_NOTIFICATIONS: NotificationItem[] = [
  {
    kind: "booking",
    title: "Bookings",
    detail: "An email when a family books and pays for a session",
  },
  {
    kind: "message",
    title: "Messages",
    detail: "An email when a family starts a chat or replies to you",
  },
];

/** Missing keys mean on; matches the checks in send-booking-notifications and send-conversation-email. */
export const notificationOn = (prefs: unknown, kind: string) => {
  const value = prefs && typeof prefs === "object" ? (prefs as Record<string, unknown>)[emailPrefKey(kind)] : undefined;
  return value !== false;
};

export const DEACTIVATE_WORD = "DEACTIVATE";

export const ATHLETE_NOTIFICATIONS: NotificationItem[] = [
  {
    kind: "booking",
    title: "Bookings",
    detail: "An email confirming each session you book and pay for",
  },
  {
    kind: "message",
    title: "Messages",
    detail: "An email when a coach replies to you",
  },
];

export const DELETE_WORD = "DELETE";
export const DELETION_GRACE_DAYS = 14;
