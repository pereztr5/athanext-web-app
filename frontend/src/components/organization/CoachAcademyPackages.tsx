/**
 * "With {academy}" on a coach profile (Working Copy): academy packages that include this coach,
 * with the saving vs single sessions. Families can buy from here; the coach sees them read only.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orgPackagesAPI, type OrgPackage } from "@/api/organizations";
import { smallButton, secondaryButton } from "@/components/schedule/styles";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { packageSaving, savingLine } from "@/utils/organizations";

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
          <span className="text-[12px] font-medium leading-[13px] text-[#767980]">With {org}</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {packages
              .filter((p) => (p.orgName ?? "Academy") === org)
              .map((p) => {
                const line = saving(p);
                return (
                  <div key={p.id} className="flex flex-col gap-1.5 rounded-[10px] bg-[#F1F1E6] px-[14px] py-4">
                    <b className="text-[14px] font-medium">{p.name}</b>
                    <span className="text-[12px] leading-[14px] text-[#767980]">
                      {dollars(p.price / Math.max(1, p.sessionCount))} a session · {p.renewsMonthly ? "Renews monthly" : `Valid ${p.validityDays} days`}
                    </span>
                    {line ? <span className="text-[12px] font-medium leading-[14px] text-[#1E7431]">{line}</span> : null}
                    <div className="mt-1 flex items-end justify-between gap-2">
                      <span className="text-[28px] font-bold leading-[30px] tracking-[-0.05em]">{dollars(p.price)}</span>
                      {canBuy ? (
                        <button type="button" className={cn(secondaryButton, smallButton)} disabled={buying !== null} onClick={() => void buy(p.id)}>
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
