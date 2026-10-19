/**
 * + Add on a group (Working Copy): pick one of the coach's athletes and how it's paid. A credit
 * or paid outside AthaNext books them straight in; otherwise they get a link to book and pay.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { rosterAPI } from "@/api/roster";
import { scheduleAPI } from "@/api/schedule";
import { useAuth } from "@/contexts/AuthContext";
import { choice, input, primaryButton, secondaryButton } from "@/components/schedule/styles";
import { money } from "@/utils/booking";
import { plural, sessionLink } from "@/utils/schedule";
import { Field, ModalBody, ModalFooter, ModalHeader } from "./parts";
import { cap, spDialog } from "./styles";

type Payment = "credit" | "link" | "outside";

export const AddToGroupDialog = ({
  open,
  occurrenceId,
  title,
  sub,
  price,
  bookedIds,
  onClose,
  onAdded,
  onError,
}: {
  open: boolean;
  occurrenceId: string;
  title: string;
  sub: string;
  price: number;
  bookedIds: string[];
  onClose: () => void;
  onAdded: (message: string) => void;
  onError: (error: unknown) => void;
}) => {
  const { userProfile } = useAuth();
  const [athleteId, setAthleteId] = useState("");
  const [payment, setPayment] = useState<Payment | null>(null);
  useEffect(() => {
    if (open) {
      setAthleteId("");
      setPayment(null);
    }
  }, [open]);

  const roster = useQuery({ queryKey: ["coach-roster"], enabled: open, queryFn: () => rosterAPI.roster() });
  const options = useQuery({
    queryKey: ["roster-book-payment", athleteId],
    enabled: open && Boolean(athleteId),
    queryFn: () => rosterAPI.bookPayment(athleteId),
  });
  const athletes = (roster.data ?? []).filter((a) => !bookedIds.includes(a.id));
  const athlete = athletes.find((a) => a.id === athleteId);
  const first = athlete?.name.split(" ")[0] ?? "";
  const opts = options.data;
  const credits = opts?.credits ?? 0;
  const pay: Payment = opts?.paysDirect ? "link" : payment ?? (credits ? "credit" : "link");
  const choices: { value: Payment; label: string; ok: boolean }[] = [
    { value: "credit", label: credits ? `Use a credit (${plural(credits, "credit")} left)` : "No credits left", ok: credits > 0 },
    { value: "link", label: "Send a link to pay", ok: true },
    { value: "outside", label: "Paid outside AthaNext", ok: Boolean(opts?.ownClient) },
  ];

  const add = useMutation({
    mutationFn: async () => {
      if (pay === "credit" || pay === "outside") {
        await rosterAPI.book(athleteId, [occurrenceId], pay);
        return `${first} is in ${title}`;
      }
      const link = sessionLink(null, userProfile?.coach_id ?? "", occurrenceId);
      await scheduleAPI.offerSession(
        [occurrenceId],
        [athleteId],
        false,
        opts?.paysDirect
          ? `${first}, there's a spot for you in ${title} (${money(price)}, you pay me directly). Book it here: ${link}`
          : `${first}, there's a spot for you in ${title} (${money(price)}). Book it here: ${link}`
      );
      return `Sent ${first} a link to book`;
    },
    onSuccess: onAdded,
    onError,
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={spDialog}>
        <ModalHeader title={`Add to ${title}`} sub={sub} />
        <ModalBody>
          <Field title="Athlete">
            <select className={input} value={athleteId} onChange={(e) => { setAthleteId(e.target.value); setPayment(null); }}>
              <option value="">{roster.isLoading ? "Loading…" : athletes.length ? "Choose an athlete" : "No athletes to add"}</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          {athlete && opts ? (
            opts.paysDirect ? (
              <p className={cap}>{first} books from a link and pays you directly.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                <span className="text-label-xsm text-dark-300">Payment</span>
                <div className="flex flex-wrap gap-2">
                  {choices.map((c) => (
                    <button key={c.value} type="button" className={choice(pay === c.value)} disabled={!c.ok} aria-pressed={pay === c.value} onClick={() => setPayment(c.value)}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          ) : null}
        </ModalBody>
        <ModalFooter>
          <button type="button" className={secondaryButton} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={primaryButton} disabled={!athlete || !opts || add.isPending} onClick={() => add.mutate()}>
            {pay === "link" ? "Send link" : `Add ${first || "athlete"}`}
          </button>
        </ModalFooter>
      </DialogContent>
    </Dialog>
  );
};
