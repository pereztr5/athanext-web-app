/** Shared helpers for free intro calls. */
import { errorMessage } from "@/utils/errorMessage";
import { formatClock } from "@/utils/schedule";
import { formatDateInZone } from "@/utils/viewerTime";

export const INTRO_KEYS = {
  settings: ["intro-settings"] as const,
  coach: (coachId: string) => ["coach-intro", coachId] as const,
  enabled: ["intro-enabled-coaches"] as const,
  home: ["coach-intro-calls"] as const,
};

export const mText = "text-label-sm text-dark";
export const capText = "text-caption text-dark-300";

export const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] ?? "";

/** "Thu, Oct 12 at 5:00 pm" in the viewer's zone. */
export const introWhen = (iso: string, timeZone: string) => {
  const at = new Date(iso);
  return `${formatDateInZone(at, timeZone, { weekday: "short", month: "short", day: "numeric" })} at ${formatClock(at, timeZone)}`;
};

export const errorText = (err: unknown, fallback: string) => errorMessage(err, fallback);
