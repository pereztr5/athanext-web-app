import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Camp } from "@/api/packages";
import { packagesAPI } from "@/api/packages";
import { BrandPill } from "@/components/brand";
import { label, secondaryButton, smallButton, textButton } from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CampBubbles } from "./CampBubbles";
import { campMoney, formatCampDates, formatDailyTime } from "./format";
import { useCamps } from "./useCamps";

/** Camps on the coach's edit profile, separate from session packages. */
export const CampEditorList = ({
  coachId,
  mostBookedId,
  onEdit,
}: {
  coachId: string;
  mostBookedId: string | null;
  onEdit: (camp: Camp) => void;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const camps = useCamps(coachId, true);
  const [pending, setPending] = useState<string | null>(null);

  const setActive = async (camp: Camp, active: boolean) => {
    setPending(camp.id);
    const result = await packagesAPI.updateCoachPackage(camp.id, { is_active: active });
    setPending(null);
    if (result.error || !result.data) {
      toast({ title: "That didn't save", description: result.error?.message || "Try again.", variant: "destructive" });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["coach-camps", coachId] });
    toast({ title: active ? "Camp listed" : "Camp hidden" });
  };

  if (camps.isLoading) return null;
  if (camps.isError) {
    return (
      <p role="alert" className="text-caption text-error-700">
        Camps could not be loaded.
      </p>
    );
  }
  const list = camps.data ?? [];
  if (!list.length) return null;

  return (
    <div className="flex flex-col gap-3">
      <span className={label}>Camps</span>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
        {list.map((camp) => {
          const dates = formatCampDates(camp.startsOn, camp.endsOn);
          const time = formatDailyTime(camp.dailyStart, camp.dailyEnd);
          const named = new Set(camp.coCoaches.map((coach) => coach.id));
          return (
            <div key={camp.id} className="flex flex-col gap-1.5 rounded-control bg-light-400 px-4 py-[14px]">
              {camp.id === mostBookedId ? (
                <BrandPill tone="blue" className="self-start">
                  Most booked
                </BrandPill>
              ) : null}
              {!camp.isActive ? (
                <BrandPill tone="muted" className="self-start">
                  Hidden
                </BrandPill>
              ) : null}
              <span className={cn("text-label-sm", camp.isActive ? "text-dark" : "text-dark-300")}>{camp.name}</span>
              <span className={cn("text-highlight", camp.isActive ? "text-dark" : "text-dark-300")}>
                {campMoney(camp.totalPriceCents / 100)}
              </span>
              <span className="text-caption text-dark-300">{[dates ?? "Dates not set", time].filter(Boolean).join(" · ")}</span>
              <CampBubbles coaches={camp.coCoaches} extra={camp.coCoachIds.filter((id) => !named.has(id)).length} />
              <div className="flex items-center gap-3 pt-1">
                <button type="button" className={cn(secondaryButton, smallButton)} onClick={() => onEdit(camp)}>
                  Edit
                </button>
                {camp.isActive ? (
                  <button type="button" className={cn(textButton, "text-dark-300")} disabled={pending === camp.id} onClick={() => void setActive(camp, false)}>
                    Hide
                  </button>
                ) : (
                  <button type="button" className={textButton} disabled={pending === camp.id} onClick={() => void setActive(camp, true)}>
                    Show
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
