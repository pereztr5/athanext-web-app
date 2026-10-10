/** Shared helpers for free intro calls. */
import { formatClock } from "@/utils/schedule";
import { formatDateInZone } from "@/utils/viewerTime";

export const INTRO_KEYS = {
  settings: ["intro-settings"] as const,
  coach: (coachId: string) => ["coach-intro", coachId] as const,
  enabled: ["intro-enabled-coaches"] as const,
  home: ["coach-intro-calls"] as const,
};

export const mText = "text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]";
export const capText = "text-[12px] leading-[18px] text-[#767980]";

export const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] ?? "";

/** "Thu, Oct 12 at 5:00 pm" in the viewer's zone. */
export const introWhen = (iso: string, timeZone: string) => {
  const at = new Date(iso);
  return `${formatDateInZone(at, timeZone, { weekday: "short", month: "short", day: "numeric" })} at ${formatClock(at, timeZone)}`;
};

export const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);
