/**
 * "With {academy}" on a coach profile (Working Copy): academy packages that include this coach,
 * with the saving vs single sessions. Families can buy from here; the coach sees them read only.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orgPackagesAPI, type OrgPackage } from "@/api/organizations";
import { primaryButton, smallButton } from "@/components/schedule/styles";
import { useAuth } from "@/contexts/AuthContext";
import { useFeeConfig } from "@/hooks/useFeeConfig";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { packageSaving, savingLine } from "@/utils/organizations";
import { money } from "@/utils/booking";
import { feeAmountText } from "@/utils/feeDisplay";
import { FEE_LABELS, feeLine, toCents } from "@/utils/fees";

const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

const saving = (p: OrgPackage) =>
  savingLine(
    packageSaving(
      p,
      Object.entries(p.coachPrices ?? {}).map(([id, price]) => ({ id, name: id, price })),
      p.groupPrices ?? []
    ),
    ""
  );

export const CoachAcademyPackages = ({ coachId, canBuy }: { coachId: string; canBuy: boolean }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { config, error } = useFeeConfig();
  const [buying, setBuying] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["coach-org-packages", coachId], queryFn: () => orgPackagesAPI.forCoach(coachId), enabled: Boolean(coachId) });
  const packages = query.data ?? [];
  if (!packages.length) return null;
  const orgs = [...new Set(packages.map((p) => p.orgName ?? "Academy"))];

  const buy = async (id: string) => {
    if (!user) {
      window.location.assign("/auth?mode=signin");
      return;
    }
    setBuying(id);
    try {
      window.location.assign(await orgPackagesAPI.buy(id));
    } catch (e) {
      toast({ title: "Couldn't open checkout", description: (e as Error).message, variant: "destructive" });
      setBuying(null);
    }
  };

  return (
    <>
      {orgs.map((org) => (
        <div key={org} className="flex flex-col gap-2">
          <span className="text-label-xsm text-dark-300">With {org}</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {packages
              .filter((p) => (p.orgName ?? "Academy") === org)
              .map((p) => {
                const line = saving(p);
                // Academy packages: list price + the platform fee only (card processing is absorbed).
                const fees = config ? feeLine(toCents(p.price), "org_package", config) : null;
                return (
                  <div key={p.id} className="flex flex-col gap-1.5 rounded-card border border-light-525 bg-light px-3.5 py-4">
                    <b className="text-label-sm">{p.name}</b>
                    <span className="text-caption text-dark-300">
                      {dollars(p.price / Math.max(1, p.sessionCount))} a session ·{" "}
                      {p.renewsMonthly ? "Renews monthly" : `Valid ${p.validityDays} days`}
                    </span>
                    {line ? <span className="text-label-xsm text-success-700">{line}</span> : null}
                    <div className="mt-1 flex items-end justify-between gap-2">
                      <span className="flex flex-col">
                        <span className="text-highlight">{feeAmountText(Boolean(fees), error, money((fees?.totalCents ?? 0) / 100))}</span>
                        {fees?.platformCents ? (
                          <span className="text-caption text-dark-300">
                            list {money(fees.listCents / 100)} + {money(fees.platformCents / 100)} {FEE_LABELS.platform.toLowerCase()}
                          </span>
                        ) : null}
                      </span>
                      {canBuy ? (
                        <button type="button" className={cn(primaryButton, smallButton)} disabled={buying !== null} onClick={() => void buy(p.id)}>
                          {buying === p.id ? "Opening…" : "Buy"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </>
  );
};
