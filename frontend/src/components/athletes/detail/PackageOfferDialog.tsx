/**
 * Send a package offer (Working Copy): pick one of the coach's packages and an optional note.
 * It goes to the family as a message in the athlete's thread.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { bookingRequestsAPI } from "@/api/bookingRequests";
import { chatAPI } from "@/api/chat";
import { Field, ModalBody, ModalFooter, ModalHeader } from "@/components/coach-session/parts";
import { cap, spDialog } from "@/components/coach-session/styles";
import { input, primaryButton, secondaryButton } from "@/components/schedule/styles";
import { useAuth } from "@/contexts/AuthContext";
import { useCoachPackages } from "@/hooks/useCoachPackages";
import { cn } from "@/lib/utils";
import { money } from "@/utils/payments";

export const PackageOfferDialog = ({
  open,
  athleteId,
  first,
  to,
  current,
  onClose,
  onSent,
  onError,
}: {
  open: boolean;
  athleteId: string;
  first: string;
  /** Who gets the message: the parent, or the athlete when they're 18+. */
  to: string;
  /** Name of the package they have now, picked first when it's still offered. */
  current: string | null;
  onClose: () => void;
  onSent: () => void;
  onError: (error: unknown) => void;
}) => {
  const { user, userProfile } = useAuth();
  const packages = useCoachPackages(open ? userProfile?.coach_id ?? undefined : undefined);
  const list = useMemo(() => packages.data ?? [], [packages.data]);
  const [pkg, setPkg] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) setNote("");
  }, [open]);
  useEffect(() => {
    if (open && list.length && !list.some((p) => p.id === pkg)) setPkg((list.find((p) => p.package_name === current) ?? list[0]).id);
  }, [open, list, pkg, current]);

  const send = useMutation({
    mutationFn: async () => {
      const p = list.find((x) => x.id === pkg);
      if (!p || !user) throw new Error("Pick a package");
      const text = `${note.trim() || "Here is a package if you would like to keep going."} ${p.package_name} for ${money(Number(p.total_price))}. Buy it from my profile or reply here.`;
      const conversationId = await bookingRequestsAPI.openConversation(athleteId);
      const { error } = await chatAPI.sendMessage(conversationId, user.id, text);
      if (error) throw new Error(error.message);
    },
    onSuccess: onSent,
    onError,
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={spDialog}>
        <ModalHeader title="Send a package offer" sub={`To ${to}`} />
        <ModalBody>
          {packages.isLoading ? <p className={cap}>Loading packages…</p> : null}
          {!packages.isLoading && !list.length ? <p className={cap}>You have no packages yet. Add one on My profile.</p> : null}
          {list.length ? (
            <Field title="Package">
              <select className={input} value={pkg} onChange={(e) => setPkg(e.target.value)}>
                {list.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.package_name}, {money(Number(p.total_price))}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field title="Message" optional>
            <textarea
              className={cn(input, "h-auto py-2")}
              rows={3}
              maxLength={1000}
              value={note}
              placeholder={`${first}'s package is almost used up. Here's the next one if you'd like to keep going.`}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        </ModalBody>
        <ModalFooter>
          <button type="button" className={secondaryButton} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={primaryButton} disabled={!pkg || send.isPending} onClick={() => send.mutate()}>
            Send offer
          </button>
        </ModalFooter>
      </DialogContent>
    </Dialog>
  );
};
