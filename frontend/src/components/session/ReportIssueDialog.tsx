/**
 * Report an issue with a session (from the session page). The button is outlined in
 * red. Sending saves the report and emails AthaNext support right away; the family gets an email
 * confirmation too.
 */
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CircleCheck, Flag } from "@/components/icons";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { sessionIssuesAPI } from "@/api/sessionIssues";
import { dialogContent, input, label, meta, primaryButton, secondaryButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { ISSUE_DETAILS_MAX, ISSUE_REASONS, issueErrors, type IssueReason } from "@/utils/sessionIssues";

/** Red-outlined "Report an issue" button. */
export const reportIssueButton =
  "inline-flex h-control items-center justify-center gap-2 whitespace-nowrap rounded-control border border-error-600 bg-transparent px-4 text-label font-medium tracking-[-0.03em] text-error-700 transition-colors hover:bg-error-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error-600 disabled:cursor-not-allowed disabled:border-light-525 disabled:text-dark-200 [&_svg]:size-4 [&_svg]:shrink-0";

export const ReportIssueButton = ({ onClick, className, small }: { onClick: () => void; className?: string; small?: boolean }) => (
  <button
    type="button"
    className={cn(reportIssueButton, small && "h-control-sm px-3 text-label-sm", className)}
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
  >
    <Flag strokeWidth={1.5} aria-hidden="true" />
    Report an issue
  </button>
);

export const ReportIssueDialog = ({
  bookingId,
  sessionLabel,
  onClose,
}: {
  /** Null keeps the dialog closed. */
  bookingId: string | null;
  /** "Finishing with Michael, Tue Oct 21". */
  sessionLabel?: string | null;
  onClose: () => void;
}) => {
  const open = Boolean(bookingId);
  const [reason, setReason] = useState<IssueReason | null>(null);
  const [details, setDetails] = useState("");
  const [errors, setErrors] = useState<{ reason?: string; details?: string; send?: string }>({});
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason(null);
    setDetails("");
    setErrors({});
    setSent(false);
  }, [open, bookingId]);

  const send = useMutation({
    mutationFn: () => sessionIssuesAPI.report(bookingId!, reason!, details),
    onSuccess: () => setSent(true),
    onError: (err: unknown) => setErrors({ send: err instanceof Error ? err.message : "That didn't send. Try again" }),
  });

  const submit = () => {
    const next = issueErrors(reason, details);
    setErrors(next);
    if (!Object.keys(next).length) send.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !send.isPending && onClose()}>
      <DialogContent className={dialogContent}>
        {sent ? (
          <div className="flex flex-col items-start gap-3 px-5 pb-5 pt-6 sm:px-[25px]" role="status">
            <CircleCheck className="size-6 text-success-700" strokeWidth={1.5} aria-hidden="true" />
            <DialogTitle className="text-section">We got your report</DialogTitle>
            <DialogDescription className="text-body-m text-dark-300">
              Someone from AthaNext will reply within one business day. We sent a copy to your email.
            </DialogDescription>
            {reason === "safety" ? (
              <p className="rounded-control border border-error-300 bg-error-50 px-3 py-2.5 text-body-m text-error-700">
                If anyone is in danger right now, call 911.
              </p>
            ) : null}
            <button type="button" className={cn(primaryButton, "self-end")} onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
              <DialogTitle className="text-section">Report an issue</DialogTitle>
              <DialogDescription className={meta}>
                {sessionLabel ? `${sessionLabel}. ` : ""}This goes straight to the AthaNext team, not the coach.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 px-5 pb-5 sm:px-[25px]">
              <fieldset className="flex flex-col gap-2">
                <legend className={cn(label, "mb-2")}>What happened?</legend>
                <RadioGroup
                  value={reason ?? ""}
                  onValueChange={(value) => {
                    setReason(value as IssueReason);
                    setErrors((x) => ({ ...x, reason: undefined }));
                  }}
                  className="gap-1.5"
                >
                  {ISSUE_REASONS.map((r) => (
                    <label
                      key={r.value}
                      htmlFor={`issue-${r.value}`}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-control border px-3 py-2.5",
                        reason === r.value ? "border-primary bg-primary-50" : "border-light-525 bg-light-300 hover:bg-light-200"
                      )}
                    >
                      <RadioGroupItem id={`issue-${r.value}`} value={r.value} className="mt-0.5" />
                      <span className="flex flex-col gap-0.5">
                        <span className="text-label-sm text-dark">{r.label}</span>
                        <span className={meta}>{r.hint}</span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
                {errors.reason ? <span className="text-caption text-error-700">{errors.reason}</span> : null}
              </fieldset>
              <label className="flex flex-col gap-1.5">
                <span className={label}>Details</span>
                <textarea
                  className={cn(input, "h-auto min-h-[110px] py-2")}
                  rows={4}
                  maxLength={ISSUE_DETAILS_MAX}
                  value={details}
                  placeholder="What happened, and when?"
                  onChange={(e) => {
                    setDetails(e.target.value);
                    setErrors((x) => ({ ...x, details: undefined }));
                  }}
                />
                {errors.details ? <span className="text-caption text-error-700">{errors.details}</span> : null}
              </label>
              {errors.send ? <p className="text-caption text-error-700">{errors.send}</p> : null}
              <div className="flex justify-end gap-2">
                <button type="button" className={secondaryButton} onClick={onClose} disabled={send.isPending}>
                  Cancel
                </button>
                <button type="button" className={primaryButton} onClick={submit} disabled={send.isPending}>
                  {send.isPending ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
