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

export type NotificationChannel = "email" | "app";

/** A row on Account settings > Notifications. Only channels that are actually sent get a switch. */
export type NotificationItem = {
  kind: string;
  title: string;
  detail: string;
  channels: readonly NotificationChannel[];
};

export const COACH_NOTIFICATIONS: NotificationItem[] = [
  {
    kind: "booking",
    title: "Booking requests and bookings",
    detail: "Requests in the app, and an email when a booking is confirmed",
    channels: ["email", "app"],
  },
  {
    kind: "message",
    title: "Messages",
    detail: "From families and athletes",
    channels: ["email", "app"],
  },
  {
    kind: "notes",
    title: "Feedback due",
    detail: "Sessions from the last week that still need feedback",
    channels: ["app"],
  },
  {
    kind: "review",
    title: "Reviews",
    detail: "New reviews on your profile",
    channels: ["app"],
  },
  {
    kind: "reminder",
    title: "Session reminders",
    detail: "On your notifications list 24 hours before",
    channels: ["app"],
  },
];

/** Missing keys mean on; matches notification_allowed() in the database. */
export const notificationOn = (prefs: unknown, kind: string, channel: NotificationChannel) => {
  const value = prefs && typeof prefs === "object" ? (prefs as Record<string, unknown>)[`${kind}_${channel}`] : undefined;
  return value !== false;
};

export const DEACTIVATE_WORD = "DEACTIVATE";

export const ATHLETE_NOTIFICATIONS: NotificationItem[] = [
  {
    kind: "booking",
    title: "Bookings",
    detail: "An email when a booking is confirmed, and a note when a coach accepts a request",
    channels: ["email", "app"],
  },
  {
    kind: "message",
    title: "Messages",
    detail: "From coaches and group channels",
    channels: ["email", "app"],
  },
  {
    kind: "notes",
    title: "Session notes",
    detail: "When a coach shares feedback",
    channels: ["app"],
  },
  {
    kind: "reminder",
    title: "Session reminders",
    detail: "On your notifications list 24 hours before",
    channels: ["app"],
  },
];

export const DELETE_WORD = "DELETE";
export const DELETION_GRACE_DAYS = 14;
