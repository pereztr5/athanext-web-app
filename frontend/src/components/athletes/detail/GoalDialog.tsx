/** Edit goal on the coach's athlete page (Working Copy): the season goal, one short line. */
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { rosterAPI } from "@/api/roster";
import { Field, ModalBody, ModalFooter, ModalHeader } from "@/components/coach-session/parts";
import { spDialog } from "@/components/coach-session/styles";
import { input, primaryButton, secondaryButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";

export const GoalDialog = ({
  open,
  athleteId,
  first,
  goal,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean;
  athleteId: string;
  first: string;
  goal: string | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (error: unknown) => void;
}) => {
  const [value, setValue] = useState("");
  useEffect(() => {
    if (open) setValue(goal ?? "");
  }, [open, goal]);

  const save = useMutation({
    mutationFn: () => rosterAPI.saveGoal(athleteId, value.trim()),
    onSuccess: onSaved,
    onError,
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={spDialog}>
        <ModalHeader title={`Goal for ${first}`} />
        <ModalBody>
          <Field title="Season goal">
            <textarea
              className={cn(input, "h-auto py-2")}
              rows={2}
              maxLength={300}
              value={value}
              placeholder="For example, earn a starting spot this season"
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>
        </ModalBody>
        <ModalFooter>
          <button type="button" className={secondaryButton} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={primaryButton} disabled={save.isPending} onClick={() => save.mutate()}>
            Save
          </button>
        </ModalFooter>
      </DialogContent>
    </Dialog>
  );
};
