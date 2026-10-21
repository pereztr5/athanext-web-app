import { DELETION_GRACE_DAYS } from "@/utils/settings";

/** run_due_account_deletions() runs daily at 07:30 UTC. */
const JOB_UTC_MINUTES = 7 * 60 + 30;

/**
 * When the daily job actually deletes the account: the first 07:30 UTC run at or after
 * deletion_requested_at + 14 days. Mirrors backend/supabase/functions/_shared/account_emails.ts.
 */
export const scheduledDeletionAt = (requestedAt: string | Date): Date => {
  const due = new Date(new Date(requestedAt).getTime() + DELETION_GRACE_DAYS * 86_400_000);
  const run = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate(), 0, JOB_UTC_MINUTES));
  if (run.getTime() < due.getTime()) run.setUTCDate(run.getUTCDate() + 1);
  return run;
};

export const formatDeletionDate = (requestedAt: string, timeZone?: string) =>
  scheduledDeletionAt(requestedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", ...(timeZone ? { timeZone } : {}) });
