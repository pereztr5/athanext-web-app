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

/**
 * The run's date as "Nov 5", read in UTC (the zone the job runs in), with no time, so the banner
 * and the deletion email always name the same day. A local zone would move it a day for anyone
 * at UTC-8 or further west. accountDeletion.test.ts checks both agree.
 */
export const formatDeletionDate = (requestedAt: string | Date) =>
  scheduledDeletionAt(requestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
