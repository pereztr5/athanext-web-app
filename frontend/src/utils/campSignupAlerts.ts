/**
 * New camp sign-ups for the coach (bell items of kind "camp", the Camps nav count and the
 * "2 new sign-ups" line on Home). The server counts them in get_my_new_camp_signups.
 */
export type NewCampSignups = { total: number; camps: Record<string, number> };

export const NO_NEW_CAMP_SIGNUPS: NewCampSignups = { total: 0, camps: {} };

const count = (value: unknown) => {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

/** Anything malformed reads as zero, so a bad payload never shows a count. */
export const parseNewCampSignups = (raw: unknown): NewCampSignups => {
  if (!raw || typeof raw !== "object") return NO_NEW_CAMP_SIGNUPS;
  const row = raw as { total?: unknown; camps?: unknown };
  const camps: Record<string, number> = {};
  if (row.camps && typeof row.camps === "object" && !Array.isArray(row.camps)) {
    for (const [id, n] of Object.entries(row.camps as Record<string, unknown>)) {
      const c = count(n);
      if (c) camps[id] = c;
    }
  }
  const sum = Object.values(camps).reduce((a, b) => a + b, 0);
  return { total: Math.max(count(row.total), sum), camps };
};

/** "1 new sign-up", "3 new sign-ups"; null for none. */
export const newSignupsLabel = (n: number | null | undefined): string | null => {
  const c = count(n);
  if (!c) return null;
  return `${c} new sign-up${c === 1 ? "" : "s"}`;
};

/** Short nav badge: "2 new", "9+ new". */
export const newSignupsBadge = (n: number | null | undefined): string | null => {
  const c = count(n);
  if (!c) return null;
  return `${c > 9 ? "9+" : c} new`;
};
