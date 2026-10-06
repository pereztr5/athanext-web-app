/**
 * Coach Account Settings (ATH-87) helpers.
 */

export const splitName = (full: string | null | undefined) => {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
};

export const joinName = (first: string, last: string) => [first.trim(), last.trim()].filter(Boolean).join(" ");

/** 0 to 4: length 8+, a number, a symbol, length 12+. */
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

export type NotificationChannel = "email" | "app";

export const COACH_NOTIFICATIONS: [kind: string, title: string, detail: string][] = [
  ["booking", "Booking requests", "New requests and changes"],
  ["message", "Messages", "From families and athletes"],
  ["payment", "Payments", "Invoices paid and payouts sent"],
  ["reminder", "Session reminders", "1 hour before each session"],
  ["review", "Reviews", "New reviews on your profile"],
  ["tips", "Marketplace tips", "Ideas to grow your profile"],
];

/** Missing keys mean on; matches notification_allowed() in the database. */
export const notificationOn = (prefs: unknown, kind: string, channel: NotificationChannel) => {
  const value = prefs && typeof prefs === "object" ? (prefs as Record<string, unknown>)[`${kind}_${channel}`] : undefined;
  return value !== false;
};

export const DEACTIVATE_WORD = "DEACTIVATE";

export const ATHLETE_NOTIFICATIONS: [kind: string, title: string, detail: string][] = [
  ["booking", "Bookings", "Confirmations and changes"],
  ["message", "Messages", "From coaches and group channels"],
  ["reminder", "Session reminders", "24 hours and 1 hour before"],
  ["notes", "Session notes", "When a coach shares notes"],
];

export const DELETE_WORD = "DELETE";
export const DELETION_GRACE_DAYS = 14;
