/**
 * Cancel this session? (Working Copy): what the families get back, and a required reason.
 * Paid bookings come back as a session credit with the coach; a package credit goes back.
 */
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { coachSessionAPI } from "@/api/coachSession";
import { dangerButton, input, secondaryButton } from "@/components/schedule/styles";
import { Field, InfoBox, ModalBody, ModalFooter, ModalHeader } from "./parts";
import { spDialog } from "./styles";

const REASONS = ["Weather", "Field unavailable", "I am sick", "Schedule conflict", "Other"];

export const CancelDialog = ({
  open,
  occurrenceId,
  sub,
  group,
  paymentStatus,
  onClose,
  onCancelled,
  onError,
}: {
  open: boolean;
  occurrenceId: string;
  sub: string;
  group: boolean;
  /** The 1-on-1 booking's payment, for what comes back. */
  paymentStatus: string | null;
  onClose: () => void;
  onCancelled: (result: { sent: number; credits: number }) => void;
  onError: (error: unknown) => void;
}) => {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
    }
  }, [open]);

  const cancel = useMutation({
    mutationFn: () => coachSessionAPI.cancel(occurrenceId, reason),
    onSuccess: onCancelled,
    onError,
  });

  const outcome = group
    ? "Every family who paid gets a session credit and is notified."
    : paymentStatus === "credit"
      ? "The package credit goes back and the family is notified."
      : paymentStatus === "paid"
        ? "The family gets a session credit and is notified."
        : "The family is notified. Nothing was charged in the app.";

  const submit = () => {
    if (!reason) {
      setError("Choose a reason");
      return;
    }
    cancel.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={spDialog}>
        <ModalHeader title="Cancel this session?" sub={sub} />
        <ModalBody>
          <InfoBox>{outcome}</InfoBox>
          <Field title="Reason" error={error}>
            <select
              className={input}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError(null);
              }}
            >
              <option value="">Choose a reason</option>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
        </ModalBody>
        <ModalFooter>
          <button type="button" className={secondaryButton} onClick={onClose}>
            Keep session
          </button>
          <button type="button" className={dangerButton} disabled={cancel.isPending} onClick={submit}>
            Cancel session
          </button>
        </ModalFooter>
      </DialogContent>
    </Dialog>
  );
};
