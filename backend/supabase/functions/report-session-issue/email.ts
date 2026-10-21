// Pure email builders for report-session-issue: kept apart so they can be tested without a server.

export type IssueReason = "safety" | "coach_no_show" | "payment" | "other";

export const REASON_LABELS: Record<IssueReason, string> = {
  safety: "Safety concern",
  coach_no_show: "Coach didn't show",
  payment: "Payment problem",
  other: "Something else",
};

export const reasonLabel = (reason: string) => REASON_LABELS[reason as IssueReason] ?? "Something else";

export const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Links in the emails point at the app the family used, or the default site. */
export const resolveSiteUrl = (origin: unknown, fallback: string): string => {
  if (typeof origin !== "string") return fallback;
  try {
    const url = new URL(origin);
    const host = url.hostname;
    if (host === "localhost" || host === "127.0.0.1") return url.origin;
    if (host === "athanext.com" || host.endsWith(".athanext.com") || host.endsWith("athanext-staging.vercel.app")) return url.origin;
  } catch {
    // fall through
  }
  return fallback;
};

export interface IssueReport {
  id: string;
  reason: string;
  details: string;
  createdAt: string;
  bookingId: string | null;
  occurrenceId: string | null;
  bookingStatus: string | null;
  paymentStatus: string | null;
  sessionTitle: string | null;
  sessionWhen: string | null;
  place: string | null;
  price: number | null;
  coachName: string;
  coachEmail: string | null;
  coachLink: string | null;
  athleteName: string;
  reporterName: string;
  reporterEmail: string | null;
  sessionLink: string | null;
}

export const supportSubject = (r: Pick<IssueReport, "reason" | "coachName" | "athleteName">) =>
  `${r.reason === "safety" ? "URGENT: " : ""}Session issue: ${reasonLabel(r.reason)} (${r.coachName} / ${r.athleteName})`;

const row = (label: string, value: string | null | undefined) =>
  value ? `<tr><td style="padding:4px 12px 4px 0;color:#686B72;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:4px 0;">${escapeHtml(value)}</td></tr>` : "";

const linkRow = (label: string, href: string | null) =>
  href ? `<tr><td style="padding:4px 12px 4px 0;color:#686B72;">${escapeHtml(label)}</td><td style="padding:4px 0;"><a href="${escapeHtml(href)}">${escapeHtml(href)}</a></td></tr>` : "";

export const supportHtml = (r: IssueReport) => {
  const urgent = r.reason === "safety";
  return `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1A202C;">
    ${urgent ? `<p style="background:#FDECEC;color:#B42318;padding:10px 12px;border-radius:6px;font-weight:bold;">Safety concern. Please respond now.</p>` : ""}
    <h2 style="color:#0054B4;margin:0 0 12px;">${escapeHtml(reasonLabel(r.reason))}</h2>
    <p style="white-space:pre-line;border-left:3px solid #D0D5DD;padding-left:12px;">${escapeHtml(r.details)}</p>
    <table style="border-collapse:collapse;font-size:14px;margin-top:12px;">
      ${row("Reported by", `${r.reporterName}${r.reporterEmail ? ` <${r.reporterEmail}>` : ""}`)}
      ${row("Athlete", r.athleteName)}
      ${row("Coach", `${r.coachName}${r.coachEmail ? ` <${r.coachEmail}>` : ""}`)}
      ${row("Session", r.sessionTitle)}
      ${row("When", r.sessionWhen)}
      ${row("Where", r.place)}
      ${row("Price", r.price != null ? `$${r.price.toFixed(2)}` : null)}
      ${row("Booking status", r.bookingStatus)}
      ${row("Payment status", r.paymentStatus)}
      ${row("Reported at", r.createdAt)}
      ${row("Report ID", r.id)}
      ${row("Booking ID", r.bookingId)}
      ${row("Session ID", r.occurrenceId)}
      ${linkRow("Session page", r.sessionLink)}
      ${linkRow("Coach profile", r.coachLink)}
    </table>
    <p style="color:#686B72;font-size:13px;">Reply to the family within one business day. The report is in session_issue_reports with status "new".</p>
  </div>`;
};

export const supportText = (r: IssueReport) =>
  [
    r.reason === "safety" ? "SAFETY CONCERN. Please respond now.\n" : "",
    `${reasonLabel(r.reason)}`,
    "",
    r.details,
    "",
    `Reported by: ${r.reporterName}${r.reporterEmail ? ` <${r.reporterEmail}>` : ""}`,
    `Athlete: ${r.athleteName}`,
    `Coach: ${r.coachName}${r.coachEmail ? ` <${r.coachEmail}>` : ""}`,
    r.sessionTitle ? `Session: ${r.sessionTitle}` : "",
    r.sessionWhen ? `When: ${r.sessionWhen}` : "",
    r.bookingStatus ? `Booking status: ${r.bookingStatus} / payment ${r.paymentStatus ?? "unknown"}` : "",
    `Report ID: ${r.id}`,
    r.bookingId ? `Booking ID: ${r.bookingId}` : "",
    r.sessionLink ? `Session page: ${r.sessionLink}` : "",
  ]
    .filter((line, i, all) => line !== "" || all[i - 1] !== "")
    .join("\n");

export const familySubject = "We got your report";

export const familyHtml = (r: Pick<IssueReport, "reporterName" | "reason" | "sessionTitle" | "sessionWhen" | "coachName">) => {
  const first = r.reporterName.split(" ")[0] || "there";
  const session = [r.sessionTitle, r.sessionWhen].filter(Boolean).join(", ");
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1A202C;">
    <h2 style="color:#0054B4;">We got your report</h2>
    <p>Hi ${escapeHtml(first)},</p>
    <p>Thanks for telling us. Someone from AthaNext will reply within one business day.</p>
    <p style="color:#686B72;">${escapeHtml(reasonLabel(r.reason))}${session ? ` · ${escapeHtml(session)} with ${escapeHtml(r.coachName)}` : ""}</p>
    ${r.reason === "safety" ? `<p><b>If anyone is in danger right now, call 911.</b></p>` : ""}
    <p style="color:#686B72;font-size:13px;">You can reply to this email to add anything.</p>
  </div>`;
};
