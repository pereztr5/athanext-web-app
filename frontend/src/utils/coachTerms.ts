/** Coach terms live in public.coach_terms (same shape as terms_and_conditions). */
export type CoachTermsRow = {
  id: string;
  title: string | null;
  content: string | null;
  version: string | null;
  last_updated: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type CoachTermsDoc = {
  title: string;
  content: string;
  version: string | null;
  /** YYYY-MM-DD, or null when no usable date. */
  lastUpdated: string | null;
};

const isoDay = (raw: string | null | undefined) =>
  raw && /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : null;

/** Null when there is no published copy (no row, or an empty body): the page shows "being updated". */
export const toCoachTermsDoc = (row: CoachTermsRow | null | undefined): CoachTermsDoc | null => {
  if (!row) return null;
  const content = (row.content ?? "").trim();
  if (!content) return null;
  return {
    title: row.title?.trim() || "Coach terms",
    content,
    version: row.version?.trim() || null,
    lastUpdated: isoDay(row.last_updated) ?? isoDay(row.updated_at) ?? isoDay(row.created_at),
  };
};
