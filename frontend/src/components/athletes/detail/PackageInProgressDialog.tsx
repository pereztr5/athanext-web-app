/**
 * Add or edit a package already in progress (WC4 #24): sessions used before AthaNext,
 * price, paid outside or still owed.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { rosterAPI, type PackageProgress } from "@/api/roster";
import { Field, ModalBody, ModalFooter, ModalHeader } from "@/components/coach-session/parts";
import { cap, spDialog } from "@/components/coach-session/styles";
import { input, primaryButton, secondaryButton } from "@/components/schedule/styles";
import { useAuth } from "@/contexts/AuthContext";
import { useCoachPackages } from "@/hooks/useCoachPackages";
import { cn } from "@/lib/utils";
import { money } from "@/utils/payments";

const OTHER = "__other__";

export const PackageInProgressDialog = ({
  open,
  athleteId,
  first,
  current,
  /** Invited / own-client families can use Still owed (invoice). Marketplace cannot. */
  isClient,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean;
  athleteId: string;
  first: string;
  current: PackageProgress | null;
  isClient: boolean;
  onClose: () => void;
  onSaved: () => void;
  onError: (error: unknown) => void;
}) => {
  const { userProfile } = useAuth();
  const packages = useCoachPackages(open ? userProfile?.coach_id ?? undefined : undefined);
  const list = useMemo(() => packages.data ?? [], [packages.data]);
  const [pkg, setPkg] = useState(OTHER);
  const [customName, setCustomName] = useState("");
  const [total, setTotal] = useState(8);
  const [prior, setPrior] = useState(0);
  const [price, setPrice] = useState("");
  const [outside, setOutside] = useState<"paid" | "owed">("paid");

  useEffect(() => {
    if (!open) return;
    if (current) {
      setPkg(current.packageId ?? OTHER);
      setCustomName(current.packageId ? "" : current.name);
      setTotal(current.total);
      setPrior(current.prior);
      setPrice(String(current.price));
      setOutside(current.outside === "owed" && isClient ? "owed" : "paid");
      return;
    }
    setPkg(list[0]?.id ?? OTHER);
    setCustomName("");
    setTotal(list[0] ? Number(list[0].session_count) || 8 : 8);
    setPrior(0);
    setPrice(list[0] ? String(Number(list[0].total_price) || "") : "");
    setOutside("paid");
  }, [open, current, list, isClient]);

  useEffect(() => {
    if (!open || current || pkg === OTHER) return;
    const p = list.find((x) => x.id === pkg);
    if (!p) return;
    setTotal(Number(p.session_count) || 8);
    setPrice(String(Number(p.total_price) || ""));
  }, [pkg, open, current, list]);

  const left = Math.max(0, total - prior);
  const priceNum = Number(price);
  const owedOk = outside !== "owed" || (isClient && priceNum > 0 && priceNum <= 10000);
  const save = useMutation({
    mutationFn: () =>
      rosterAPI.upsertPackageInProgress({
        athleteId,
        packageId: pkg === OTHER ? null : pkg,
        customName: pkg === OTHER ? customName : null,
        sessionsTotal: total,
        priorUsed: prior,
        price: priceNum,
        outside: outside === "owed" && !isClient ? "paid" : outside,
      }),
    onSuccess: onSaved,
    onError,
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={spDialog}>
        <ModalHeader
          title={current ? "Edit package in progress" : "Add a package in progress"}
          sub={`For ${first}. Sessions already used stay off AthaNext.`}
        />
        <ModalBody>
          <Field title="Package">
            <select className={input} value={pkg} onChange={(e) => setPkg(e.target.value)}>
              {list.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.package_name}, {money(Number(p.total_price))}
                </option>
              ))}
              <option value={OTHER}>Something else</option>
            </select>
          </Field>
          {pkg === OTHER ? (
            <Field title="Name">
              <input className={input} value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="For example, Fall 8-pack" />
            </Field>
          ) : null}
          <Field title="Sessions in the package">
            <input
              className={input}
              type="number"
              min={1}
              max={200}
              value={total}
              onChange={(e) => setTotal(Math.max(1, Number(e.target.value) || 1))}
            />
          </Field>
          <Field title="Sessions already used">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={cn(secondaryButton, "h-9 w-9 px-0")}
                onClick={() => setPrior((n) => Math.max(0, n - 1))}
                aria-label="Fewer used"
              >
                −
              </button>
              <input
                className={cn(input, "text-center")}
                type="number"
                min={0}
                max={Math.max(0, total - 1)}
                value={prior}
                onChange={(e) => setPrior(Math.min(total - 1, Math.max(0, Number(e.target.value) || 0)))}
              />
              <button
                type="button"
                className={cn(secondaryButton, "h-9 w-9 px-0")}
                onClick={() => setPrior((n) => Math.min(total - 1, n + 1))}
                aria-label="More used"
              >
                +
              </button>
            </div>
            <p className={cap}>Before they joined AthaNext</p>
          </Field>
          <Field title={Number(price) !== Number(list.find((p) => p.id === pkg)?.total_price) ? "What they paid for the package" : "Price"}>
            <input className={input} type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <Field title="Payment">
            <div className="flex flex-col gap-2">
              {(
                [
                  ["paid", "Already paid outside AthaNext"],
                  ...(isClient ? ([["owed", "Still owed"]] as const) : []),
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  className={cn(
                    "rounded-control border px-3 py-2.5 text-left text-body-m",
                    outside === v ? "border-primary bg-primary-50" : "border-light-525 bg-light-400"
                  )}
                  onClick={() => setOutside(v)}
                >
                  {label}
                </button>
              ))}
            </div>
            {!isClient ? (
              <p className={cap}>Marketplace families buy packages in the app. Still owed is only for families you invited.</p>
            ) : null}
          </Field>
          <p className="rounded-control border border-light-525 bg-light-400 px-3 py-2.5 text-body-m text-dark-400">
            {left} of {total} sessions left. Their next {left} booking{left === 1 ? "" : "s"} use this package before
            anything is charged.
          </p>
        </ModalBody>
        <ModalFooter>
          <button type="button" className={secondaryButton} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={primaryButton}
            disabled={save.isPending || (pkg === OTHER && !customName.trim()) || !Number.isFinite(priceNum) || priceNum < 0 || !owedOk}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : "Save package"}
          </button>
        </ModalFooter>
      </DialogContent>
    </Dialog>
  );
};
