/** Report an issue: the reasons a family can pick and the checks before sending. */

export type IssueReason = "safety" | "coach_no_show" | "payment" | "other";

export const ISSUE_REASONS: { value: IssueReason; label: string; hint: string }[] = [
  { value: "safety", label: "Safety concern", hint: "Something made you or your athlete feel unsafe" },
  { value: "coach_no_show", label: "Coach didn't show", hint: "The coach didn't arrive or join the call" },
  { value: "payment", label: "Payment problem", hint: "A charge, refund or credit looks wrong" },
  { value: "other", label: "Something else", hint: "Anything else about this session" },
];

export const ISSUE_DETAILS_MIN = 10;
export const ISSUE_DETAILS_MAX = 2000;

export const issueErrors = (reason: IssueReason | null, details: string): { reason?: string; details?: string } => {
  const errors: { reason?: string; details?: string } = {};
  const text = details.trim();
  if (!reason) errors.reason = "Choose what the issue is about";
  if (text.length < ISSUE_DETAILS_MIN) errors.details = "Tell us a bit more about what happened";
  else if (text.length > ISSUE_DETAILS_MAX) errors.details = `Use ${ISSUE_DETAILS_MAX} characters or fewer`;
  return errors;
};
