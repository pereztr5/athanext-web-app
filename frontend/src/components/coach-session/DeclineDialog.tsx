/**
 * Decline request (Working Copy): a required reason and an optional message to the family.
 * The decline goes through the booking request API (a held card is released); the reason and
 * message follow.
 */
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { bookingRequestsAPI } from "@/api/bookingRequests";
import { coachSessionAPI } from "@/api/coachSession";
import { dangerButton, input, secondaryButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { Field, ModalBody, ModalFooter, ModalHeader } from "./parts";
import { cap, spDialog } from "./styles";

const REASONS = ["That time no longer works", "Outside my coaching focus", "Fully booked this season", "Other"];

export const DeclineDialog = ({
  open,
  bookingId,
  sub,
  onClose,
  onDeclined,
  onError,
}: {
  open: boolean;
  bookingId: string | null;
  sub: string;
  onClose: () => void;
  onDeclined: () => void;
  onError: (error: unknown) => void;
}) => {
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setReason("");
      setMessage("");
      setError(null);
    }
  }, [open]);

  const decline = useMutation({
    mutationFn: async () => {
      await bookingRequestsAPI.respond(bookingId!, false);
      // The request is declined either way; the note is extra.
      await coachSessionAPI.declineNote(bookingId!, reason, message.trim()).catch(() => undefined);
    },
    onSuccess: onDeclined,
    onError,
  });

  const submit = () => {
    if (!reason) {
      setError("Choose a reason");
      return;
    }
    decline.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={spDialog}>
        <ModalHeader title="Decline request" sub={sub} />
        <ModalBody>
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
          <Field title="Message to the family" optional>
            <textarea
              className={cn(input, "h-auto py-2")}
              rows={3}
              value={message}
              placeholder="Suggest another time or coach"
              onChange={(e) => setMessage(e.target.value)}
            />
          </Field>
          <p className={cap}>The slot opens again for other families.</p>
        </ModalBody>
        <ModalFooter>
          <button type="button" className={secondaryButton} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={dangerButton} disabled={decline.isPending || !bookingId} onClick={submit}>
            Decline request
          </button>
        </ModalFooter>
      </DialogContent>
    </Dialog>
  );
};
