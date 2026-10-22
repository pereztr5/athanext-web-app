// Account emails (Account settings): deletion scheduled, deletion cancelled, coach deactivated.
// Pure helpers so the copy and the deletion date can be tested without sending anything.

export type AccountEmailEvent = "deletion_requested" | "deletion_cancelled" | "coach_deactivated";

export const ACCOUNT_EMAIL_EVENTS: readonly AccountEmailEvent[] = ["deletion_requested", "deletion_cancelled", "coach_deactivated"];

export const DELETION_GRACE_DAYS = 14;
/** run_due_account_deletions() runs daily at 07:30 UTC (cron 'delete-requested-accounts'). */
const JOB_UTC_MINUTES = 7 * 60 + 30;

/**
 * When the daily job will actually delete the account: the first 07:30 UTC run at or after
 * deletion_requested_at + 14 days. Mirrors frontend/src/utils/accountDeletion.ts.
 */
export const scheduledDeletionAt = (requestedAt: string | Date): Date => {
  const due = new Date(new Date(requestedAt).getTime() + DELETION_GRACE_DAYS * 86_400_000);
  const run = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate(), 0, JOB_UTC_MINUTES));
  if (run.getTime() < due.getTime()) run.setUTCDate(run.getUTCDate() + 1);
  return run;
};

/**
 * The run's date as "Nov 5", read in UTC (the zone the job runs in), with no time. A local
 * zone would move it a day for anyone at UTC-8 or further west. Mirrors the frontend.
 */
export const formatDeletionDate = (requestedAt: string | Date) =>
  scheduledDeletionAt(requestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const wrap = (title: string, paragraphs: string[]) =>
  `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1A202C;">
    <h2 style="color:#0054B4;">${title}</h2>
    ${paragraphs.map((p) => `<p>${p}</p>`).join("\n    ")}
    <p style="color:#686B72;font-size:13px;">Questions? Reply to this email or write to support@athanext.com.</p>
  </div>`;

export type AccountEmailInput = {
  event: AccountEmailEvent;
  name?: string | null;
  /** deletion_requested_at, for deletion_requested. */
  requestedAt?: string | null;
  appOrigin: string;
};

export const buildAccountEmail = ({ event, name, requestedAt, appOrigin }: AccountEmailInput) => {
  const first = escapeHtml((name ?? "").trim().split(/\s+/)[0] || "there");
  const signIn = `${appOrigin.replace(/\/$/, "")}/auth`;
  const settings = `${appOrigin.replace(/\/$/, "")}/settings`;
  if (event === "deletion_requested") {
    const when = formatDeletionDate(requestedAt ?? new Date());
    return {
      subject: `Your AthaNext account will be deleted on ${when}`,
      html: wrap("Your account is scheduled for deletion", [
        `Hi ${first},`,
        `You asked us to delete your AthaNext account. It will be deleted on <strong>${escapeHtml(when)}</strong>. Upcoming sessions are cancelled then, and your personal details are removed. Coaches keep a record of past sessions without your name.`,
        `Changed your mind? <a href="${signIn}">Sign in</a> and choose <strong>Keep my account</strong>.`,
      ]),
    };
  }
  if (event === "deletion_cancelled") {
    return {
      subject: "Your AthaNext account is staying",
      html: wrap("Your account won't be deleted", [
        `Hi ${first},`,
        "You chose to keep your AthaNext account, so nothing will be deleted. Your sessions, coaches and messages are all still there.",
        `Didn't do this? <a href="${settings}?tab=security">Change your password</a> and let us know.`,
      ]),
    };
  }
  return {
    subject: "Your AthaNext coach account is deactivated",
    html: wrap("Your account is deactivated", [
      `Hi ${first},`,
      "Your profile is off the marketplace and families can no longer book you. Upcoming sessions stay on your calendar until you cancel them.",
      `You can reactivate any time: <a href="${settings}?tab=security">sign in and choose Reactivate</a>.`,
    ]),
  };
};
