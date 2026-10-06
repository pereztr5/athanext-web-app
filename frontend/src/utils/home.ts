/** Coach Home money strip helpers (ATH-76). */

/** Totals for the chosen period and the one before it; null change when there was nothing before. */
export const periodTotals = (days: { amount: number }[], period: number) => {
  const current = days.slice(-period).reduce((n, d) => n + d.amount, 0);
  const previous = days.slice(-period * 2, -period).reduce((n, d) => n + d.amount, 0);
  return { current, previous, change: previous ? Math.round(((current - previous) / previous) * 100) : null };
};
