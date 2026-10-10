/**
 * Academy packages (Working Copy, Organization page): the card families see on the org page,
 * and the owner's New / Edit package sheet with the saving check against single sessions.
 */
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { orgPackagesAPI, type OrgPackage } from "@/api/organizations";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToastAction } from "@/components/ui/toast";
import { dialogContent, input, label, primaryButton, secondaryButton, smallButton } from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { cn, getInitials } from "@/lib/utils";
import { packageSaving, savingLine, type PackageSaving } from "@/utils/organizations";

export type PackageCoach = { id: string; name: string; price: number; photo?: string | null };

const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

const Chip = ({ coach }: { coach: PackageCoach }) => (
  <span className="inline-flex h-7 items-center gap-1.5 rounded-[14px] border border-[#EAEADF] bg-[#F7F7F0] pl-1 pr-[10px] text-[12px] font-medium">
    <span className="flex size-5 items-center justify-center overflow-hidden rounded-full bg-[#F1F1E6] text-[9px] text-[#484D56]">
      {coach.photo ? <img src={coach.photo} alt="" className="size-full object-cover" /> : getInitials(coach.name)}
    </span>
    {coach.name}
  </span>
);

/** The package card on the org page (Working Copy `.og-pk`). */
export const OrgPackageCard = ({
  pkg,
  coaches,
  groupPrices,
  onBuy,
  buying,
}: {
  pkg: OrgPackage;
  coaches: PackageCoach[];
  groupPrices: number[];
  onBuy: () => void;
  buying?: boolean;
}) => {
  const k = packageSaving(pkg, coaches, groupPrices);
  const who = coaches.filter((c) => pkg.coachIds.includes(c.id));
  const line = savingLine(k);
  return (
    <div className="flex flex-col gap-[10px] rounded-[10px] border border-[#EAEADF] bg-[#F1F1E6] p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[14px] font-medium">{pkg.name}</span>
          <span className="text-[12px] leading-[14px] text-[#767980]">
            {dollars(k.per)} a session · {pkg.renewsMonthly ? "renews monthly" : `valid ${pkg.validityDays} days`}
            {pkg.kind === "group" ? " · group sessions" : ""}
          </span>
        </span>
        <span className="flex-none text-[28px] font-bold leading-[30px] tracking-[-0.05em]">{dollars(pkg.price)}</span>
      </div>
      {pkg.kind === "group" ? (
        <span className="text-[12px] leading-[14px] text-[#767980]">
          Works with group sessions from {who.length > 3 ? "any academy coach" : who.map((c) => c.name.split(" ")[0]).join(", ")}
        </span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {who.map((c) => (
            <Chip key={c.id} coach={c} />
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-medium leading-[14px] text-[#1E7431]">{line}</span>
        <button type="button" className={cn(primaryButton, smallButton)} disabled={buying} onClick={onBuy}>
          {buying ? "Opening…" : "Buy"}
        </button>
      </div>
    </div>
  );
};

type Form = { name: string; count: string; price: string; valid: string; kind: OrgPackage["kind"]; coachIds: string[] };

const toForm = (pkg: OrgPackage | null, coaches: PackageCoach[]): Form =>
  pkg
    ? { name: pkg.name, count: String(pkg.sessionCount), price: String(pkg.price), valid: String(pkg.validityDays), kind: pkg.kind, coachIds: [...pkg.coachIds] }
    : { name: "", count: "8", price: "600", valid: "90", kind: "individual", coachIds: coaches.slice(0, 2).map((c) => c.id) };

const Check2 = ({ k, count, kind }: { k: PackageSaving; count: number; kind: OrgPackage["kind"] }) => {
  const bad = k.rows.filter((r) => r.save < 0);
  return (
    <div className={cn("flex flex-col gap-2 rounded-[8px] border px-[14px] py-3", bad.length ? "border-[#FCEFDA] bg-[#FDF7EC]" : "border-[#EAEADF] bg-[#F1F1E6]")}>
      <span className="text-[14px] font-medium">
        {dollars(k.per)} a session.{" "}
        {bad.length ? (
          <span className="text-[#906A29]">
            {kind === "group"
              ? "Some group sessions cost less on their own."
              : `${bad.map((r) => r.name.split(" ")[0]).join(" and ")} ${bad.length === 1 ? "costs" : "cost"} less as single sessions.`}
          </span>
        ) : (
          <span className="text-[#1E7431]">{savingLine(k) || "No savings to show yet"}.</span>
        )}
      </span>
      {k.rows.length ? (
        <div className="flex flex-col">
          {k.rows.map((r) => (
            <div key={r.key} className="flex items-center gap-[10px] border-t border-[#EAEADF] py-1.5 text-[14px]">
              <span className="flex-1">{r.name}</span>
              <span className="text-[12px] text-[#767980]">
                {count} single {dollars(r.single)}
              </span>
              <b className={cn("font-medium", r.save < 0 ? "text-[#906A29]" : "text-[#1E7431]")}>{r.save < 0 ? `${dollars(-r.save)} more` : `saves ${dollars(r.save)}`}</b>
            </div>
          ))}
        </div>
      ) : (
        <span className="text-[12px] leading-[14px] text-[#767980]">No upcoming group sessions to compare with yet.</span>
      )}
      <span className="text-[12px] leading-[14px] text-[#767980]">
        {bad.length
          ? `Families would pay more with this package. Lower the price${kind === "group" ? "" : ` or remove ${bad.map((r) => r.name.split(" ")[0]).join(" and ")}`}.`
          : "Families see the saving worked out from these numbers."}
      </span>
    </div>
  );
};

/** New / Edit academy package sheet (Working Copy `org-pkg`). */
export const OrgPackageDialog = ({
  open,
  pkg,
  coaches,
  groupPrices,
  onClose,
}: {
  open: boolean;
  pkg: OrgPackage | null;
  coaches: PackageCoach[];
  /** Upcoming group prices per coach, for the group pass check. */
  groupPrices: Record<string, number[]>;
  onClose: () => void;
}) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [f, setF] = useState<Form>(() => toForm(pkg, coaches));
  useEffect(() => {
    if (open) setF(toForm(pkg, coaches));
  }, [open, pkg, coaches]);

  const draft = {
    kind: f.kind,
    sessionCount: Math.max(1, Number(f.count) || 1),
    price: Math.max(1, Number(f.price) || 1),
    coachIds: f.coachIds,
  };
  const k = packageSaving(draft, coaches, f.coachIds.flatMap((id) => groupPrices[id] ?? []));
  const bad = k.rows.some((r) => r.save < 0);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["org-packages"] });
    qc.invalidateQueries({ queryKey: ["org-page-extras"] });
  };

  const save = useMutation({
    mutationFn: () =>
      orgPackagesAPI.save({
        id: pkg?.id,
        name: f.name.trim(),
        kind: f.kind,
        sessionCount: draft.sessionCount,
        price: draft.price,
        validityDays: Math.max(1, Number(f.valid) || 90),
        coachIds: f.coachIds,
      }),
    onSuccess: (saved) => {
      refresh();
      toast({ title: `${saved.name} saved. It shows on the academy page and on each included coach's profile` });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Couldn't save the package", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: () => orgPackagesAPI.remove(pkg!.id),
    onSuccess: () => {
      refresh();
      const removed = pkg!;
      onClose();
      toast({
        title: `${removed.name} removed`,
        action: (
          <ToastAction altText={`Bring back ${removed.name}`} onClick={() => void orgPackagesAPI.restore(removed.id).then(refresh)}>
            Undo
          </ToastAction>
        ),
      });
    },
    onError: (e: Error) => toast({ title: "Couldn't remove the package", description: e.message, variant: "destructive" }),
  });

  const field = (key: "name" | "count" | "price" | "valid", text: string, type: "text" | "number", prefix?: string) => (
    <label className="flex flex-col gap-1.5">
      <span className={label}>{text}</span>
      {prefix ? (
        <span className="flex items-center rounded-[8px] bg-[#F1F1E6]">
          <span className="pl-3 text-[14px] text-[#767980]">{prefix}</span>
          <input className={cn(input, "bg-transparent pl-1")} type={type} min={1} value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} />
        </span>
      ) : (
        <input className={input} type={type} min={type === "number" ? 1 : undefined} value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} />
      )}
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className={cn(dialogContent, "max-w-[560px]")}>
        <DialogHeader className="border-b border-[#EAEADF] px-5 pb-4 pt-5 text-left">
          <DialogTitle className="text-[20px] font-semibold tracking-[-0.04em]">{pkg ? "Edit academy package" : "New academy package"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-5 py-4">
          {field("name", "Name", "text")}
          <div className="grid grid-cols-2 gap-3">
            {field("count", "Sessions", "number")}
            {field("price", "Price", "number", "$")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {f.kind === "group" ? (
              <label className="flex flex-col gap-1.5">
                <span className={label}>Valid for</span>
                <span className={cn(input, "flex items-center text-[#484D56]")}>Renews monthly</span>
              </label>
            ) : (
              field("valid", "Valid for (days)", "number")
            )}
            <label className="flex flex-col gap-1.5">
              <span className={label}>Type</span>
              <select className={input} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Form["kind"] })}>
                <option value="individual">1-on-1 sessions</option>
                <option value="group">Group sessions</option>
              </select>
            </label>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={label}>Coaches it works with</span>
            <div className="flex flex-wrap gap-2">
              {coaches.map((c) => {
                const on = f.coachIds.includes(c.id);
                const single = f.kind === "group" ? (groupPrices[c.id] ?? [])[0] ?? 0 : c.price;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setF({ ...f, coachIds: on ? f.coachIds.filter((x) => x !== c.id) : [...f.coachIds, c.id] })}
                    className={cn(
                      "inline-flex h-[30px] items-center gap-1.5 rounded-[8px] border px-3 text-[14px] font-medium",
                      on ? "border-[#1A202C] bg-[#F7F7F0]" : "border-[#EAEADF] bg-[#F4F4EB]"
                    )}
                  >
                    {on ? <Check className="size-4" strokeWidth={1.5} aria-hidden="true" /> : null}
                    {c.name.split(" ")[0]} · {dollars(single)} {f.kind === "group" ? "group" : "single"}
                  </button>
                );
              })}
            </div>
          </div>
          <Check2 k={k} count={draft.sessionCount} kind={f.kind} />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#EAEADF] px-5 py-4">
          {pkg ? (
            <button type="button" className="mr-auto text-[14px] font-medium text-[#972B2B]" disabled={remove.isPending} onClick={() => remove.mutate()}>
              Remove
            </button>
          ) : null}
          <button type="button" className={secondaryButton} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={primaryButton}
            disabled={bad || !f.name.trim() || !f.coachIds.length || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : "Save package"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
